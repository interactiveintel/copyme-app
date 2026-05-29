// POST /api/auth/phone/complete — finalize sign-up after OTP verify.
// Closes S-101 (display name), S-105 (avatar slot), S-110 (age gate).
//
// Body: {
//   signupTicket, displayName, countryIso2, birthdate (ISO date),
//   avatarUrl?, referralCode?
// }
// Returns: { ok, accessToken, refreshToken, sessionId, deviceId, user }

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { consumeSignupTicket } from "@/lib/otp/signup-ticket";
// v4.16.6 (F6a follow-up): auto-default VAP currency from the
// captured ISO-2 country code so EU signups don't land in USD.
import { currencyForCountryIso2 } from "@/lib/phone-currency";
import { checkAge } from "@/lib/age-gate";
import { issueSession } from "@/lib/sessions";
import { prisma } from "@/lib/db";
import {
  betaInviteRequired,
  validateInviteCode,
  redeemInviteCode,
} from "@/lib/invite-code";

export const runtime = "nodejs";

function defaultAvatarFor(name: string): string {
  // Deterministic gradient avatar URL — server-rendered as a tiny SVG
  // route under /api/avatars/<seed>.svg. Same shape as InboxScreen mock.
  const seed = createHash("sha256").update(name).digest("hex").slice(0, 8);
  return `/api/avatars/${seed}.svg`;
}

export async function POST(req: NextRequest) {
  let body: {
    signupTicket?: string;
    displayName?: string;
    countryIso2?: string;
    birthdate?: string;
    avatarUrl?: string;
    referralCode?: string;
    inviteCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const { signupTicket, displayName, countryIso2, birthdate, avatarUrl, referralCode, inviteCode } = body;
  if (!signupTicket || !displayName || !countryIso2 || !birthdate) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  // Display name (S-105): ≤24 chars (matches schema), trimmed.
  const trimmed = displayName.trim();
  if (trimmed.length === 0 || trimmed.length > 24) {
    return NextResponse.json({ error: "BAD_DISPLAY_NAME" }, { status: 400 });
  }

  // Age gate (S-110).
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) {
    return NextResponse.json({ error: "BAD_BIRTHDATE" }, { status: 400 });
  }
  const gate = checkAge(countryIso2, dob);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: "UNDER_AGE",
        minAge: gate.minAge,
        ageProvided: gate.ageProvided,
        appealUrl: "/appeal/age",
      },
      { status: 403 },
    );
  }

  // Beta gate (v4.12.0). Validate BEFORE consuming the OTP ticket so a
  // user with a typo in their invite code can fix it without re-doing
  // the SMS step.
  let inviteCodeId: string | null = null;
  if (betaInviteRequired()) {
    if (!inviteCode) {
      return NextResponse.json({ error: "INVITE_CODE_REQUIRED" }, { status: 403 });
    }
    const v = await validateInviteCode(inviteCode);
    if (!v.valid) {
      return NextResponse.json(
        { error: "INVITE_CODE_INVALID", reason: v.reason },
        { status: 403 },
      );
    }
    inviteCodeId = v.codeId;
  }

  // Consume the ticket → phoneHash.
  const phoneHash = consumeSignupTicket(signupTicket);
  if (!phoneHash) {
    return NextResponse.json({ error: "INVALID_TICKET" }, { status: 401 });
  }

  // Resolve referrer (S-246 lays the foundation).
  let referredById: string | null = null;
  if (referralCode) {
    const ref = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (ref) referredById = ref.id;
  }

  // We satisfy `passwordHash` (NOT NULL) with a high-entropy random value
  // to keep the column happy until the email/password path is removed in
  // S-194 launch cleanup. Phone-only users will never use it.
  const placeholderPassword = randomBytes(48).toString("base64");

  // If the client uploaded an avatar before completing sign-up, the blob URL
  // is in `avatarUrl`. Otherwise we leave it null — UI falls back to the
  // deterministic gradient.
  const avatarUrlClean =
    avatarUrl && /^https:\/\/[a-z0-9.-]+\.vercel-storage\.com\//i.test(avatarUrl)
      ? avatarUrl
      : null;

  const user = await prisma.user.create({
    data: {
      displayName: trimmed,
      phoneHash,
      passwordHash: placeholderPassword,
      avatarUrl: avatarUrlClean,
      referredById,
      // v4.16.6: Eurozone phones → EUR, everyone else → USD.
      preferredCurrency: currencyForCountryIso2(countryIso2),
    },
    select: { id: true, displayName: true, avatarUrl: true },
  });

  // Redeem the invite code now that the user row exists. Best-effort: a
  // race that loses on the increment shouldn't undo the signup — the
  // user is already in. We log the race so ops can spot pattern abuse.
  if (inviteCodeId) {
    redeemInviteCode(inviteCodeId, user.id).catch((err) => {
      console.warn("[phone/complete] invite-code redeem race:", err instanceof Error ? err.message : err);
    });
  }

  const tokens = await issueSession({
    userId: user.id,
    userAgent: req.headers.get("user-agent") ?? undefined,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || defaultAvatarFor(user.displayName),
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    sessionId: tokens.sessionId,
    deviceId: tokens.deviceId,
  });
}
