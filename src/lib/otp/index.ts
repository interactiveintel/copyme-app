// Provider-agnostic OTP backend (S-103).
//
// Single `sendOtp(phone)` interface; the implementation is selected by env:
//   OTP_PROVIDER=twilio       — production Twilio
//   OTP_PROVIDER=messagebird  — fallback (S-103 AC: failure on primary auto-flips)
//   OTP_PROVIDER=mock         — dev: writes the code to the server log
//
// We instantiate primary + fallback up front and try fallback on primary
// failure. Metrics are emitted to the existing observability pipeline.

import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { addBreadcrumb } from "@/lib/observability";
import { sendViaVerify, checkViaVerify } from "./verify-api";

// When OTP_PROVIDER=twilio-verify, we delegate entirely to Twilio Verify:
// Twilio generates the code, sends the SMS, and validates the submitted
// code. We bypass our local phone_otp table for this path because Twilio
// owns the state — duplicating it would create drift bugs.
const isVerifyApiConfigured = (): boolean =>
  (process.env.OTP_PROVIDER ?? "").trim().toLowerCase() === "twilio-verify";

const OTP_LIFETIME_MS = 10 * 60 * 1000; // 10 min
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30s (S-101 AC)

// ---- Provider interface --------------------------------------------------

export interface OtpProvider {
  name: string;
  send(phoneE164: string, code: string): Promise<{ ok: true } | { ok: false; reason: string }>;
}

class MockProvider implements OtpProvider {
  name = "mock";
  async send(phoneE164: string, code: string) {
    console.log(`[otp:mock] → ${phoneE164}: code = ${code}`);
    return { ok: true } as const;
  }
}

// v4.16.34: fail-CLOSED default for production. The old default for an
// unset OTP_PROVIDER was MockProvider, which returns ok:true and logs
// the code — so in prod a misconfig faked "code sent" while no SMS
// went out, stranding every new signup at the OTP screen with no
// signal. This provider returns a clean ok:false so the caller surfaces
// a real error. (Twilio Verify, when configured, is used UPSTREAM of
// the provider layer, so this only triggers when nothing is set.)
class DisabledProvider implements OtpProvider {
  name = "disabled";
  async send() {
    return { ok: false as const, reason: "OTP_NOT_CONFIGURED" };
  }
}

class TwilioProvider implements OtpProvider {
  name = "twilio";
  async send(phoneE164: string, code: string) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) {
      return { ok: false as const, reason: "TWILIO_NOT_CONFIGURED" };
    }
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const body = new URLSearchParams({
        To: phoneE164,
        From: from,
        Body: `Your CopyMe code is ${code}. It expires in 10 minutes.`,
      });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false as const, reason: `TWILIO_${res.status}_${text.slice(0, 100)}` };
      }
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, reason: `TWILIO_NETWORK_${(err as Error).message}` };
    }
  }
}

class MessageBirdProvider implements OtpProvider {
  name = "messagebird";
  async send(phoneE164: string, code: string) {
    const key = process.env.MESSAGEBIRD_API_KEY;
    const originator = process.env.MESSAGEBIRD_ORIGINATOR ?? "CopyMe";
    if (!key) return { ok: false as const, reason: "MESSAGEBIRD_NOT_CONFIGURED" };
    try {
      const res = await fetch("https://rest.messagebird.com/messages", {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: [phoneE164.replace(/^\+/, "")],
          originator,
          body: `Your CopyMe code is ${code}. It expires in 10 minutes.`,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false as const, reason: `MESSAGEBIRD_${res.status}_${text.slice(0, 100)}` };
      }
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, reason: `MESSAGEBIRD_NETWORK_${(err as Error).message}` };
    }
  }
}

function pick(name: string | undefined): OtpProvider {
  switch (name) {
    case "twilio": return new TwilioProvider();
    case "messagebird": return new MessageBirdProvider();
    case "mock": return new MockProvider();
    case undefined:
    default:
      // v4.16.34: no explicit provider. Mock (fake success) only in
      // non-production; fail-closed in prod so a missing OTP_PROVIDER
      // can't silently strand signups.
      return process.env.NODE_ENV === "production"
        ? new DisabledProvider()
        : new MockProvider();
  }
}

const PRIMARY = pick(process.env.OTP_PROVIDER);
// Fallback is opt-in via OTP_FALLBACK_PROVIDER. Previously this defaulted
// to MockProvider when unset, which meant any Twilio failure (e.g. trial-
// mode unverified-number rejection) silently fell back to mock + returned
// ok:true to the caller — so users saw "code sent" but no SMS arrived
// and they got permanently stuck. We now only fall back when an
// explicit *real* second provider is configured.
const FALLBACK =
  process.env.OTP_FALLBACK_PROVIDER
    ? pick(process.env.OTP_FALLBACK_PROVIDER)
    : null;

// ---- Hashing helpers ----------------------------------------------------

export function hashPhone(e164: string): string {
  return createHash("sha256").update(e164.toLowerCase()).digest("hex");
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

function generateCode(): string {
  // 6 digits with secure RNG, leading-zero preserved.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// ---- Public API ---------------------------------------------------------

export interface SendOtpResult {
  ok: boolean;
  reason?: string;
  /** Provider that ultimately delivered (or attempted last). */
  provider: string;
  /** When the user is eligible to request a new code. */
  cooldownUntil: Date;
}

/**
 * Issue an OTP for the given E.164 phone. Stores a hashed copy in
 * `phone_otps` and dispatches the SMS via primary→fallback.
 *
 * When OTP_PROVIDER=twilio-verify, delegates entirely to Twilio Verify
 * (Twilio generates + sends + later validates the code). We still keep a
 * minimal phone_otp row in that case purely as a cooldown ledger — the
 * codeHash is a sentinel so the verify path knows to take the Verify
 * branch.
 */
export async function sendOtp(
  phoneE164: string,
  ip?: string | null,
): Promise<SendOtpResult> {
  // Cooldown: refuse to issue another code within 30s.
  const phoneHash = hashPhone(phoneE164);
  const recent = await prisma.phoneOtp.findFirst({
    where: { phoneHash },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  if (recent && now.getTime() - recent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const cooldownUntil = new Date(recent.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS);
    addBreadcrumb("otp.cooldown_blocked", { phoneHash });
    return { ok: false, reason: "COOLDOWN", provider: "n/a", cooldownUntil };
  }

  // --- Twilio Verify path -------------------------------------------------
  if (isVerifyApiConfigured()) {
    const result = await sendViaVerify(phoneE164);
    // Write a sentinel cooldown row so the cooldown check above is
    // honored on subsequent requests. The codeHash is fixed because
    // Twilio Verify owns the real code — we never compare against this.
    await prisma.phoneOtp.create({
      data: {
        phoneHash,
        codeHash: "verify-api-managed",
        ipHash: hashIp(ip),
        expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
      },
    });
    addBreadcrumb("otp.send_attempt", {
      provider: "twilio-verify",
      ok: String(result.ok),
    });
    return {
      ok: result.ok,
      reason: result.ok ? undefined : result.reason,
      provider: "twilio-verify",
      cooldownUntil: new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS),
    };
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(now.getTime() + OTP_LIFETIME_MS);

  await prisma.phoneOtp.create({
    data: {
      phoneHash,
      codeHash,
      ipHash: hashIp(ip),
      expiresAt,
    },
  });

  // Try primary; fall back on failure only if an explicit second provider
  // is configured (FALLBACK !== null). Without a real fallback, surface
  // the primary error to the caller so the user knows to try again
  // rather than getting a silent success.
  let result = await PRIMARY.send(phoneE164, code);
  let providerUsed = PRIMARY.name;
  if (!result.ok && FALLBACK && FALLBACK.name !== PRIMARY.name) {
    addBreadcrumb("otp.primary_failed", { provider: PRIMARY.name, reason: result.reason });
    result = await FALLBACK.send(phoneE164, code);
    providerUsed = FALLBACK.name;
  } else if (!result.ok) {
    addBreadcrumb("otp.send_failed_no_fallback", { provider: PRIMARY.name, reason: result.reason });
  }

  addBreadcrumb("otp.send_attempt", {
    provider: providerUsed,
    ok: String(result.ok),
  });

  return {
    ok: result.ok,
    reason: result.ok ? undefined : ("reason" in result ? result.reason : undefined),
    provider: providerUsed,
    cooldownUntil: new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS),
  };
}

export interface VerifyOtpResult {
  ok: boolean;
  reason?: "EXPIRED" | "MAX_ATTEMPTS" | "WRONG_CODE" | "NO_OTP";
}

/**
 * Verify a code. Increments the attempt counter on each call; consumes
 * the OTP on success.
 *
 * When OTP_PROVIDER=twilio-verify, defers to Twilio Verify's
 * VerificationCheck API — Twilio owns the code state, attempt counter,
 * and expiry. We still flip our local phone_otp row to consumed on
 * success so the cooldown ledger reflects the resolved state.
 */
export async function verifyOtp(
  phoneE164: string,
  code: string,
): Promise<VerifyOtpResult> {
  const phoneHash = hashPhone(phoneE164);

  // --- Twilio Verify path -------------------------------------------------
  if (isVerifyApiConfigured()) {
    const result = await checkViaVerify(phoneE164, code);
    if (result.ok) {
      await prisma.phoneOtp.updateMany({
        where: { phoneHash, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      addBreadcrumb("otp.verify_ok", { phoneHash, via: "twilio-verify" });
      return { ok: true };
    }
    addBreadcrumb("otp.verify_failed", {
      phoneHash,
      via: "twilio-verify",
      reason: result.reason ?? "UNKNOWN",
    });
    // Map Verify-specific reasons onto our existing enum so downstream
    // UI code doesn't need a separate codepath.
    switch (result.reason) {
      case "NO_VERIFICATION":
        return { ok: false, reason: "NO_OTP" };
      case "MAX_ATTEMPTS":
        return { ok: false, reason: "MAX_ATTEMPTS" };
      case "WRONG_CODE":
        return { ok: false, reason: "WRONG_CODE" };
      default:
        return { ok: false, reason: "WRONG_CODE" };
    }
  }

  // --- Legacy local-codeHash path -----------------------------------------
  const otp = await prisma.phoneOtp.findFirst({
    where: { phoneHash, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false, reason: "NO_OTP" };
  if (otp.expiresAt < new Date()) return { ok: false, reason: "EXPIRED" };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "MAX_ATTEMPTS" };

  const matches = await bcrypt.compare(code, otp.codeHash);
  if (!matches) {
    await prisma.phoneOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    addBreadcrumb("otp.verify_wrong_code", { phoneHash });
    return { ok: false, reason: "WRONG_CODE" };
  }

  await prisma.phoneOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });
  addBreadcrumb("otp.verify_ok", { phoneHash });
  return { ok: true };
}
