"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, Phone, ShieldCheck, Sparkles } from "lucide-react";
import PhoneInput from "@/components/PhoneInput";
import type { ValidationResult } from "@/lib/phone/validate";

// ---------------------------------------------------------------------------
// /signup — phone-first three-step flow (S-101, S-105, S-110, S-104)
//   step 1: phone → SMS OTP
//   step 2: code → verify
//   step 3 (new user): displayName + birthdate (age gate) → first 7 contacts
// ---------------------------------------------------------------------------

type Step = "phone" | "code" | "profile" | "contacts" | "done";

function getStoredCountry(): string {
  if (typeof window === "undefined") return "si";
  return localStorage.getItem("copyme.signup.country") ?? "si";
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 1 — phone
  const [phone, setPhone] = useState<ValidationResult | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);

  // step 2 — code
  const [code, setCode] = useState("");
  const [signupTicket, setSignupTicket] = useState<string | null>(null);

  // step 3 — profile
  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState("");

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
      const r = await fetch("/api/auth/phone/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupTicket,
          displayName: displayName.trim(),
          countryIso2: phone.country.iso2,
          birthdate,
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
                    Pick a display name and confirm your birthdate.
                  </p>
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
          <a href="/terms" className="underline hover:text-slate-600">Terms</a> and{" "}
          <a href="/privacy" className="underline hover:text-slate-600">Privacy</a>.
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
