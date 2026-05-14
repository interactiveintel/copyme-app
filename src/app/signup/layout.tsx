// Env-gated wrapper around /signup (the phone-OTP flow).
//
// Background: phone-OTP signup needs an SMS provider (Twilio / MessageBird).
// When OTP_PROVIDER is unset or "mock", the OTP code is never delivered to
// the user — they get stuck at "enter the code we sent you." So until a
// real provider is configured we redirect /signup → /app, where the
// AuthScreen email+password flow handles signups instead.
//
// Marketing CTAs already point to /app, so this just protects the dead
// path. The moment OTP_PROVIDER is set to a real provider on Vercel, this
// guard short-circuits and the existing phone-OTP page renders again — no
// code change required.

import { redirect } from "next/navigation";

const REAL_PROVIDERS = new Set(["twilio", "messagebird"]);

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  const provider = (process.env.OTP_PROVIDER ?? "").trim().toLowerCase();
  if (!REAL_PROVIDERS.has(provider)) {
    redirect("/app");
  }
  return <>{children}</>;
}
