"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Cookie consent banner
//
// Minimal ePrivacy / GDPR-aligned consent UI. We distinguish two buckets:
//   - essential       always on (session + auth; no consent required)
//   - analytics       opt-in; set by the user
//
// State is stored in localStorage under `copyme_cookie_consent`:
//   {
//     version: 1,           // bump when the banner copy materially changes
//     essential: true,
//     analytics: true|false,
//     decidedAt: ISO date,
//   }
// ---------------------------------------------------------------------------

export const CONSENT_STORAGE_KEY = "copyme_cookie_consent";
export const CONSENT_VERSION = 1;

export interface CookieConsent {
  version: number;
  essential: true;
  analytics: boolean;
  decidedAt: string;
}

export function loadConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean) {
  const record: CookieConsent = {
    version: CONSENT_VERSION,
    essential: true,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    // Broadcast so any analytics init logic elsewhere can react without
    // having to re-read localStorage.
    window.dispatchEvent(new CustomEvent("copyme:consent", { detail: record }));
  } catch {
    /* storage may be disabled — banner will just show again next visit */
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) setVisible(true);
  }, []);

  // v4.14.3: signal banner presence via a data attribute on <html> so
  // mobile bottom-sticky CTAs (the auth screen Sign In button, the
  // VAP action sheet, etc.) can add padding-bottom and not get covered.
  // Previously the banner sat at z-50, bottom-4, full-width on mobile
  // and physically obscured the "Sign In" gradient button on /app —
  // first-time users saw "Sign I" with the cookie banner on top.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (visible) {
      document.documentElement.dataset.cookieBanner = "open";
    } else {
      delete document.documentElement.dataset.cookieBanner;
    }
    return () => {
      delete document.documentElement.dataset.cookieBanner;
    };
  }, [visible]);

  if (!visible) return null;

  const decide = (analytics: boolean) => {
    saveConsent(analytics);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="fixed inset-x-0 bottom-4 z-50 px-4 sm:left-auto sm:right-6 sm:w-full sm:max-w-md"
      >
        <div className="relative rounded-2xl bg-white shadow-2xl border border-slate-200 p-5">
          <button
            onClick={() => decide(false)}
            aria-label="Decline analytics and close"
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <Cookie size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">Cookies &amp; privacy</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                We use essential cookies to keep you signed in. With your permission, we&apos;d also
                like to use analytics cookies to improve CopyMe. You can change this any time.
              </p>

              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 space-y-2 text-[11px] text-slate-500"
                >
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="font-semibold text-slate-700">Essential</p>
                    <p>Auth session, Rule-of-7 state. Always on. Can&apos;t be disabled.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="font-semibold text-slate-700">Analytics</p>
                    <p>Anonymous product usage — e.g. how often users open the inbox. Off by default.</p>
                  </div>
                </motion.div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => decide(true)}
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-shadow"
                >
                  Accept all
                </button>
                <button
                  onClick={() => decide(false)}
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Essential only
                </button>
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[11px] text-slate-500 hover:text-slate-700 underline underline-offset-2"
                >
                  {expanded ? "Hide details" : "What are these?"}
                </button>
              </div>

              <p className="mt-2 text-[10px] text-slate-400">
                See our{" "}
                <Link href="/privacy" className="underline hover:text-slate-600">
                  Privacy Policy
                </Link>{" "}
                for details.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
