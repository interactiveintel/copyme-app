"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, Phone, ShieldCheck, Sparkles } from "lucide-react";
import PhoneInput from "@/components/PhoneInput";
import type { ValidationResult } from "@/lib/phone/validate";

// ---------------------------------------------------------------------------
// /signup — phone-first three-step flow (S-101, S-105, S-110, S-104)
//   step 1: phone → SMS OTP
//   step 2: code → verify
//   step 3 (new user): displayName + birthdate (age gate) → first 7 contacts
//
// Referral code (Tier C9 / S-246): if the URL has ?ref=<code>, we stash it in
// localStorage so it survives the OTP round-trip and forward it to
// /api/auth/phone/complete on account creation.
// ---------------------------------------------------------------------------

type Step = "invite" | "phone" | "code" | "profile" | "contacts" | "done";

const REFERRAL_STORAGE_KEY = "copyme.signup.ref";
const INVITE_STORAGE_KEY = "copyme.signup.inviteCode";

// Beta gate (v4.12.0). Server-authoritative; the public flag mirror lets
// us decide whether to render the invite step before the user starts.
function betaInviteRequired(): boolean {
  return process.env.NEXT_PUBLIC_BETA_INVITE_REQUIRED === "1";
}

function getStoredCountry(): string {
  if (typeof window === "undefined") return "si";
  return localStorage.getItem("copyme.signup.country") ?? "si";
}

function getStoredReferral(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFERRAL_STORAGE_KEY);
}

function clearStoredReferral() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // When the beta gate is on, start at the invite step; otherwise straight
  // to phone (existing behavior). The Stepper component below knows about
  // the new step too.
  const initialStep: Step = betaInviteRequired() ? "invite" : "phone";
  const [step, setStep] = useState<Step>(initialStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 0 (gated) — invite code
  const [inviteCode, setInviteCode] = useState("");
  const [inviteValidated, setInviteValidated] = useState<boolean>(false);

  // Capture ?ref=<code> on first render and persist across the OTP round-trip.
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && ref.trim().length > 0 && ref.length <= 32) {
      try {
        localStorage.setItem(REFERRAL_STORAGE_KEY, ref.trim());
      } catch {
        // Storage unavailable (private mode, quota) — skip; signup still works.
      }
    }
  }, [searchParams]);

  // Restore an invite code from a prior session (page reload between steps).
  // Doesn't auto-advance — user re-confirms by clicking Continue on the
  // invite step.
  useEffect(() => {
    if (typeof window === "undefined" || !betaInviteRequired()) return;
    const stored = localStorage.getItem(INVITE_STORAGE_KEY);
    if (stored) setInviteCode(stored);
  }, []);

  async function submitInvite() {
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      setError("Enter your invite code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/invite/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await r.json();
      if (!r.ok || !data.valid) {
        const reason = data?.reason ?? "INVALID";
        setError(
          reason === "EXPIRED"
            ? "That invite code has expired."
            : reason === "EXHAUSTED"
              ? "That invite code has already been used."
              : reason === "RATE_LIMITED"
                ? "Too many attempts — try again in a moment."
                : "We don't recognize that code. Double-check and try again.",
        );
        return;
      }
      try { localStorage.setItem(INVITE_STORAGE_KEY, trimmed); } catch { /* ignore */ }
      setInviteValidated(true);
      setStep("phone");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // step 1 — phone
  const [phone, setPhone] = useState<ValidationResult | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);

  // step 2 — code
  const [code, setCode] = useState("");
  const [signupTicket, setSignupTicket] = useState<string | null>(null);

  // step 3 — profile
  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  /** Optional avatar — uploaded to Vercel Blob via /api/auth/uploads/avatar
   *  after the account is created. The blob URL is then PUT to /api/users/me/avatar. */
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // step 4 — contacts
  const [contactsRaw, setContactsRaw] = useState("");

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  async function sendOtp() {
    if (!phone || !phone.valid) {
      setError("Enter a valid phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164: phone.e164 }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.reason ?? data.error ?? "Could not send code. Try again.");
        return;
      }
      const cd = Math.max(1, Math.ceil((new Date(data.cooldownUntil).getTime() - Date.now()) / 1000));
      setCooldownSec(cd);
      localStorage.setItem("copyme.signup.country", phone.country.iso2);
      setStep("code");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!phone || !phone.valid) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164: phone.e164, code }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.reason ?? data.error ?? "Code didn't match.");
        return;
      }
      if (data.status === "signin") {
        storeSession(data);
        router.push("/app");
      } else {
        setSignupTicket(data.signupTicket);
        setStep("profile");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function completeProfile() {
    if (!phone || !phone.valid || !signupTicket) return;
    if (displayName.trim().length === 0 || displayName.trim().length > 24) {
      setError("Pick a display name (1–24 characters).");
      return;
    }
    if (!birthdate) {
      setError("Add your birthdate so we can check the age requirement for your country.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const referralCode = getStoredReferral();
      const r = await fetch("/api/auth/phone/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupTicket,
          displayName: displayName.trim(),
          countryIso2: phone.country.iso2,
          birthdate,
          ...(referralCode ? { referralCode } : {}),
          ...(inviteValidated && inviteCode ? { inviteCode: inviteCode.trim() } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        if (data.error === "UNDER_AGE") {
          setError(
            `You must be at least ${data.minAge} in ${phone.country.name} to use CopyMe. ` +
            `If this is wrong, you can appeal at /appeal/age.`,
          );
          return;
        }
        setError(data.error ?? "Could not finish sign-up.");
        return;
      }
      storeSession(data);
      // Referral code (if any) was just consumed by the server — drop it
      // from local storage so we don't re-send it next time.
      clearStoredReferral();

      // Optional avatar upload (after session exists so /api/uploads/avatar
      // authenticates). Failure here is non-fatal — UI falls back to the
      // deterministic gradient.
      if (avatarFile) {
        try {
          const fd = new FormData();
          fd.append("file", avatarFile);
          await fetch("/api/uploads/avatar", {
            method: "POST",
            headers: { Authorization: `Bearer ${data.accessToken}` },
            body: fd,
          });
        } catch {
          /* ignore — user keeps their default gradient */
        }
      }

      setStep("contacts");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function importContacts(skip = false) {
    setBusy(true);
    setError(null);
    try {
      const phones = skip
        ? []
        : contactsRaw
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);
      const token = localStorage.getItem("copyme.access");
      await fetch("/api/auth/onboarding/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phonesE164: phones }),
      });
      router.push("/app");
    } catch {
      setError("Couldn't save contacts — you can add them later in Profile.");
    } finally {
      setBusy(false);
    }
  }

  function storeSession(data: {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    deviceId: string;
    user: { id: string; displayName: string };
  }) {
    // Two writes because the codebase has two consumers:
    //   1. AuthProvider (`src/lib/auth-context.tsx`) reads ONE key
    //      `copyme_auth` as JSON {user, accessToken, refreshToken}.
    //      Without this, /app loads the AuthScreen instead of the
    //      inbox after a successful phone-OTP sign-in.
    //   2. Legacy business pages (/business/surveys/*) still read the
    //      flat `copyme.access` token directly. Keep those working
    //      until they migrate to useAuth().
    localStorage.setItem(
      "copyme_auth",
      JSON.stringify({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }),
    );
    localStorage.setItem("copyme.access", data.accessToken);
    localStorage.setItem("copyme.refresh", data.refreshToken);
    localStorage.setItem("copyme.session", data.sessionId);
    localStorage.setItem("copyme.device", data.deviceId);
    localStorage.setItem("copyme.user", JSON.stringify(data.user));
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1 mb-2">
            <span className="text-3xl font-extrabold text-slate-900">Copy</span>
            <span className="text-3xl font-extrabold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Me
            </span>
          </div>
          <p className="text-sm text-slate-500">Your World&apos;s chart of Communication.</p>
        </div>

        <motion.div
          layout
          className="rounded-2xl bg-white shadow-xl border border-slate-100 p-6 sm:p-8"
        >
          {/* Step header */}
          <Stepper current={step} />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="mt-6"
            >
              {step === "invite" && (
                <div>
                  <h1 className="text-lg font-semibold text-slate-900 mb-1 inline-flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-500" />
                    You&apos;re invited
                  </h1>
                  <p className="text-sm text-slate-500 mb-4">
                    CopyMe is in private beta. Enter the invite code from the
                    person who told you about us.
                  </p>
                  <input
                    autoFocus
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitInvite();
                    }}
                    placeholder="BETA-XXXXXXX"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={32}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-mono tracking-wide placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                  <Button onClick={submitInvite} busy={busy} disabled={!inviteCode.trim()}>
                    Continue
                    <ArrowRight size={16} />
                  </Button>
                  <p className="text-xs text-slate-400 mt-3 text-center">
                    Don&apos;t have one yet?{" "}
                    <a
                      href="mailto:hello@copyme1.com?subject=Beta%20access"
                      className="text-purple-600 hover:underline"
                    >
                      ask us for one
                    </a>
                    .
                  </p>
                </div>
              )}

              {step === "phone" && (
                <div>
                  <h1 className="text-lg font-semibold text-slate-900 mb-1 inline-flex items-center gap-2">
                    <Phone size={18} className="text-purple-500" />
                    Sign up with your phone
                  </h1>
                  <p className="text-sm text-slate-500 mb-4">
                    No email, no password. We send a one-time code by SMS.
                  </p>
                  <PhoneInput defaultIso2={getStoredCountry()} onChange={setPhone} />
                  <Button onClick={sendOtp} busy={busy} disabled={!phone?.valid || cooldownSec > 0}>
                    {cooldownSec > 0 ? `Resend in ${cooldownSec}s` : "Send code"}
                    <ArrowRight size={16} />
                  </Button>
                </div>
              )}

              {step === "code" && (
                <div>
                  <h1 className="text-lg font-semibold text-slate-900 mb-1 inline-flex items-center gap-2">
                    <ShieldCheck size={18} className="text-purple-500" />
                    Enter the code
                  </h1>
                  <p className="text-sm text-slate-500 mb-4">
                    We sent a 6-digit code to {phone?.valid ? phone.e164 : "your phone"}.
                  </p>
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full text-center tracking-[0.5em] font-mono text-xl rounded-xl border border-slate-200 px-3 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="••••••"
                  />
                  <Button onClick={verifyCode} busy={busy} disabled={code.length !== 6}>
                    Verify
                    <ArrowRight size={16} />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep("phone")}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <ArrowLeft size={12} /> Use a different number
                  </button>
                </div>
              )}

              {step === "profile" && (
                <div>
                  <h1 className="text-lg font-semibold text-slate-900 mb-1 inline-flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-500" />
                    Almost there
                  </h1>
                  <p className="text-sm text-slate-500 mb-4">
                    Pick a display name, confirm your birthdate, and (optionally) add a photo.
                  </p>

                  {/* Avatar — optional. Falls back to a generated gradient. */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarPreview}
                          alt="Avatar preview"
                          className="w-16 h-16 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
                          {displayName.trim().charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                    <label className="text-xs font-medium text-purple-600 hover:text-purple-700 cursor-pointer">
                      {avatarPreview ? "Change photo" : "Add a photo (optional)"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 2 * 1024 * 1024) {
                            setError("Photo too large — keep it under 2 MB.");
                            return;
                          }
                          setAvatarFile(f);
                          setAvatarPreview(URL.createObjectURL(f));
                        }}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">Display name</span>
                    <input
                      autoFocus
                      maxLength={24}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Paul"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="block mt-4">
                    <span className="text-xs font-medium text-slate-600">Birthdate</span>
                    <input
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <Button onClick={completeProfile} busy={busy} disabled={!displayName || !birthdate}>
                    Create account
                    <ArrowRight size={16} />
                  </Button>
                </div>
              )}

              {step === "contacts" && (
                <div>
                  <h1 className="text-lg font-semibold text-slate-900 mb-1">
                    Add up to 7 contacts
                  </h1>
                  <p className="text-sm text-slate-500 mb-4">
                    Comma- or newline-separated phone numbers. Already on CopyMe?
                    They&apos;ll show up in your inbox right away.
                  </p>
                  <textarea
                    rows={5}
                    value={contactsRaw}
                    onChange={(e) => setContactsRaw(e.target.value)}
                    placeholder={"+386 31 234 567\n+1 415 555 0142"}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => importContacts(true)}
                      disabled={busy}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Skip
                    </button>
                    <Button onClick={() => importContacts(false)} busy={busy}>
                      Add contacts
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {error}
            </p>
          )}
        </motion.div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-slate-600">Terms</Link> and{" "}
          <Link href="/privacy" className="underline hover:text-slate-600">Privacy</Link>.
        </p>
      </div>
    </main>
  );
}

function Stepper({ current }: { current: Step }) {
  const order: Step[] = ["phone", "code", "profile", "contacts"];
  return (
    <div className="flex items-center gap-2">
      {order.map((s, i) => {
        const idx = order.indexOf(current);
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`h-1 flex-1 rounded-full ${
                done || active
                  ? "bg-gradient-to-r from-primary to-accent-pink"
                  : "bg-slate-200"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

function Button({
  onClick,
  children,
  busy,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 disabled:opacity-50"
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : children}
    </button>
  );
}
