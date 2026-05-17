// Twilio Verify API integration.
//
// Verify is a separate Twilio product from raw SMS — purpose-built for
// OTP. We use it when OTP_PROVIDER=twilio-verify because:
//   1. Verify uses Twilio's pre-verified pooled numbers, so it sidesteps
//      Toll-Free Verification and A2P 10DLC compliance friction entirely.
//   2. Twilio owns code generation, storage, and validation — we just
//      ask "send me a code" and "is this code right?" We don't store
//      OTP hashes ourselves on this path.
//   3. Built-in fraud detection, automatic carrier-route fallback,
//      retries on failure.
//
// Cost: ~$0.05 per successful verification (vs ~$0.008 per raw SMS).
// Failures are free. For OTP-as-onboarding this is well worth it.
//
// Setup: one-time `POST /v2/Services` to create a Verify Service.
// SID stored in TWILIO_VERIFY_SERVICE_SID env var.

interface VerifyEnv {
  sid: string;
  token: string;
  serviceSid: string;
}

function readEnv(): VerifyEnv | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !serviceSid) return null;
  return { sid, token, serviceSid };
}

function authHeader(env: VerifyEnv): string {
  return `Basic ${Buffer.from(`${env.sid}:${env.token}`).toString("base64")}`;
}

export interface VerifySendResult {
  ok: boolean;
  /** "pending", "approved", "canceled" — typically "pending" on success. */
  status?: string;
  /** Short reason string on failure (Twilio error message, truncated). */
  reason?: string;
}

/**
 * Ask Twilio Verify to send an OTP via SMS to the given E.164 number.
 * Returns ok:true if Twilio accepted the request; the SMS arrival is
 * carrier-dependent thereafter. Status "pending" is the normal success
 * state.
 */
export async function sendViaVerify(phoneE164: string): Promise<VerifySendResult> {
  const env = readEnv();
  if (!env) {
    return { ok: false, reason: "VERIFY_NOT_CONFIGURED" };
  }
  const url = `https://verify.twilio.com/v2/Services/${env.serviceSid}/Verifications`;
  const body = new URLSearchParams({ To: phoneE164, Channel: "sms" });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(env),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    code?: number;
  };
  if (!res.ok) {
    return {
      ok: false,
      reason: `VERIFY_${res.status}_${(data.message ?? "").slice(0, 100)}`,
    };
  }
  return { ok: true, status: data.status };
}

export interface VerifyCheckResult {
  ok: boolean;
  /** "approved" on success; "pending" if code wrong but more attempts ok. */
  status?: string;
  reason?: "WRONG_CODE" | "EXPIRED" | "MAX_ATTEMPTS" | "NO_VERIFICATION" | "ERROR";
  /** Raw Twilio error string for diagnostics (not surfaced to user). */
  rawError?: string;
}

/**
 * Check a user-submitted code against Twilio Verify. Twilio owns the
 * code state — we don't compare hashes locally.
 *
 * Common outcomes:
 *   * 200 status:"approved" → ok:true (correct code, verification consumed)
 *   * 200 status:"pending"  → ok:false reason:"WRONG_CODE" (user can retry)
 *   * 404                   → ok:false reason:"NO_VERIFICATION" (expired/never-sent)
 *   * 429                   → ok:false reason:"MAX_ATTEMPTS"
 */
export async function checkViaVerify(
  phoneE164: string,
  code: string,
): Promise<VerifyCheckResult> {
  const env = readEnv();
  if (!env) {
    return { ok: false, reason: "ERROR", rawError: "VERIFY_NOT_CONFIGURED" };
  }
  const url = `https://verify.twilio.com/v2/Services/${env.serviceSid}/VerificationCheck`;
  const body = new URLSearchParams({ To: phoneE164, Code: code });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(env),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    code?: number;
  };

  if (res.status === 404) {
    return { ok: false, reason: "NO_VERIFICATION" };
  }
  if (res.status === 429) {
    return { ok: false, reason: "MAX_ATTEMPTS", rawError: data.message };
  }
  if (!res.ok) {
    return { ok: false, reason: "ERROR", rawError: data.message };
  }
  if (data.status === "approved") {
    return { ok: true, status: "approved" };
  }
  // status:"pending" means the code didn't match but Verify is still
  // accepting attempts on this verification.
  return { ok: false, reason: "WRONG_CODE", status: data.status };
}
