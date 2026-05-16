"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import { STRINGS } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface DownloadButtonProps {
  variant?: "navbar" | "hero" | "icon-only";
  className?: string;
  /** Optional translation lookup; falls back to STRINGS.en (English literal). */
  t?: (key: string) => string;
}

export default function DownloadButton({
  variant = "hero",
  className = "",
  t,
}: DownloadButtonProps) {
  const tt = t ?? ((key: string) => STRINGS.en[key] ?? key);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Listen for the PWA install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowModal(true);
    }
  };

  if (isInstalled) return null;

  // Icon-only variant (for navbar)
  if (variant === "icon-only") {
    return (
      <>
        <button
          onClick={handleInstall}
          className={`relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all group ${className}`}
          aria-label="Install CopyMe"
          title="Install CopyMe"
        >
          <Download size={18} />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-accent-pink to-secondary animate-pulse-glow" />
        </button>
        <InstallModal open={showModal} onClose={() => setShowModal(false)} deferredPrompt={deferredPrompt} />
      </>
    );
  }

  // Navbar variant
  if (variant === "navbar") {
    return (
      <>
        <button
          onClick={handleInstall}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm transition-all hover:bg-slate-50 group ${className}`}
        >
          <Download size={16} className="text-accent-pink group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">{tt("cta.install")}</span>
        </button>
        <InstallModal open={showModal} onClose={() => setShowModal(false)} deferredPrompt={deferredPrompt} />
      </>
    );
  }

  // Hero variant (large, prominent)
  return (
    <>
      <button
        onClick={handleInstall}
        className={`group relative inline-flex items-center gap-3 rounded-full px-8 py-3.5 text-base font-semibold text-white transition-all ${className}`}
      >
        {/* Animated gradient border */}
        <span className="absolute inset-0 rounded-full gradient-border" />
        <span className="absolute inset-[1px] rounded-full bg-white backdrop-blur-xl" />
        <span className="relative z-10 flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent-pink">
            <Download size={16} className="group-hover:animate-bounce" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-xs text-slate-500 font-medium">Download</span>
            <span className="text-sm font-bold text-slate-900">Install App</span>
          </span>
        </span>
      </button>
      <InstallModal open={showModal} onClose={() => setShowModal(false)} deferredPrompt={deferredPrompt} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Install Instructions Modal
//
// Shown when the browser hasn't fired `beforeinstallprompt` (yet, or at
// all). Detects the user's platform via UA so we can lead with the ONE
// instruction that applies, instead of dumping a generic 4-card menu that
// looks like a button list. Other platforms collapse into a "show all"
// section.
// ---------------------------------------------------------------------------

type PlatformKey = "chrome-desktop" | "chrome-android" | "samsung-internet" | "safari-mac" | "safari-ios" | "edge" | "firefox" | "other";

interface PlatformGuide {
  key: PlatformKey;
  label: string;
  /** Step-by-step instructions — rendered as a numbered list. */
  steps: string[];
  /** Optional — text that calls out where to look. */
  hint?: string;
}

const GUIDES: Record<PlatformKey, PlatformGuide> = {
  "chrome-desktop": {
    key: "chrome-desktop",
    label: "Chrome on desktop",
    steps: [
      "Look at the right end of your address bar — you should see a small install icon (⊕).",
      "Click it, then click \"Install\" in the dialog that appears.",
      "If you don't see the icon: open Chrome's menu (the ⋮ at the top right) → \"Install CopyMe…\".",
    ],
    hint: "Chrome needs ~30 seconds of activity on the page before showing the install prompt. Browse around a bit if it doesn't appear immediately.",
  },
  "chrome-android": {
    key: "chrome-android",
    label: "Chrome on Android",
    steps: [
      "Tap the ⋮ menu at the top right of Chrome.",
      "Tap \"Add to Home screen\" or \"Install app\".",
      "Confirm in the dialog.",
    ],
    hint: "If \"Install app\" is missing from the menu: hard-refresh this page (pull down with two fingers, or close & reopen the tab), wait 3–5 seconds, then retry.",
  },
  "samsung-internet": {
    key: "samsung-internet",
    label: "Samsung Internet (default browser on Samsung phones)",
    steps: [
      "Tap the ☰ menu at the bottom right of Samsung Internet.",
      "Tap \"Add page to\" → \"Home screen\".",
      "Confirm the name and tap Add.",
    ],
    hint: "Samsung Internet often shows up labeled \"Chrome\" — but it has its own install flow. If you also have real Chrome installed, opening this site there will give you the native \"Install app\" prompt.",
  },
  "safari-mac": {
    key: "safari-mac",
    label: "Safari on Mac",
    steps: [
      "In Safari's menu bar, click File → \"Add to Dock…\".",
      "Confirm the name and icon, then click Add.",
    ],
    hint: "Safari doesn't expose programmatic install. \"Add to Dock\" is the official path on macOS Sonoma and later.",
  },
  "safari-ios": {
    key: "safari-ios",
    label: "Safari on iPhone or iPad",
    steps: [
      "Tap the Share button (square with an arrow) at the bottom of Safari.",
      "Scroll down and tap \"Add to Home Screen\".",
      "Tap Add in the top-right corner.",
    ],
  },
  edge: {
    key: "edge",
    label: "Microsoft Edge",
    steps: [
      "Click the ⋯ menu at the top right of Edge.",
      "Click Apps → \"Install this site as an app\".",
      "Confirm in the dialog.",
    ],
  },
  firefox: {
    key: "firefox",
    label: "Firefox",
    steps: [
      "Firefox doesn't currently support installing web apps.",
      "To get the best experience, open CopyMe in Chrome, Edge, or Safari.",
    ],
  },
  other: {
    key: "other",
    label: "Other browsers",
    steps: [
      "Look for an \"Install\" or \"Add to Home Screen\" option in your browser's menu.",
      "If you don't see one, your browser may not support installable web apps.",
      "Chrome, Edge, Safari, and Brave all support installing CopyMe.",
    ],
  },
};

function detectPlatform(): PlatformKey {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // Order matters — these UA tokens overlap (Edge / Samsung / Opera all
  // contain "Chrome"), so check the specific browsers first.
  if (/SamsungBrowser/.test(ua)) return "samsung-internet";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox/.test(ua)) return "firefox";
  const isAndroid = /Android/.test(ua);
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (/Chrome/.test(ua) && isAndroid) return "chrome-android";
  if (/Chrome/.test(ua)) return "chrome-desktop";
  if (/Safari/.test(ua) && isIos) return "safari-ios";
  if (/Safari/.test(ua)) return "safari-mac";
  return "other";
}

/**
 * Live diagnostic snapshot of the four PWA install criteria. Surfaced
 * inside the install modal as a collapsed "Why isn't this working?"
 * panel — so when an install fails, the user (and a remote helper)
 * can see exactly which criterion the browser is unhappy about.
 */
interface InstallDiagnostics {
  https: boolean;
  serviceWorker: "active" | "registered" | "none" | "unsupported";
  manifestLinked: boolean;
  manifestReachable: boolean | "checking";
  beforeInstallPromptFired: boolean;
  standalone: boolean;
  userAgent: string;
}

function useInstallDiagnostics(deferredPrompt: unknown, open: boolean): InstallDiagnostics {
  const [diag, setDiag] = useState<InstallDiagnostics>(() => ({
    https: false,
    serviceWorker: "unsupported",
    manifestLinked: false,
    manifestReachable: "checking",
    beforeInstallPromptFired: false,
    standalone: false,
    userAgent: "",
  }));

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      const https = window.location.protocol === "https:";
      const manifestLinked = !!document.querySelector('link[rel="manifest"]');
      let manifestReachable: boolean | "checking" = false;
      try {
        const r = await fetch("/manifest.json", { cache: "no-store" });
        manifestReachable = r.ok;
      } catch {
        manifestReachable = false;
      }
      let serviceWorker: InstallDiagnostics["serviceWorker"] = "unsupported";
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration("/");
          if (reg?.active) serviceWorker = "active";
          else if (reg) serviceWorker = "registered";
          else serviceWorker = "none";
        } catch {
          serviceWorker = "none";
        }
      }
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (typeof (navigator as { standalone?: boolean }).standalone === "boolean" &&
          (navigator as { standalone?: boolean }).standalone === true);

      if (cancelled) return;
      setDiag({
        https,
        serviceWorker,
        manifestLinked,
        manifestReachable,
        beforeInstallPromptFired: !!deferredPrompt,
        standalone,
        userAgent: navigator.userAgent,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, deferredPrompt]);

  return diag;
}

function InstallModal({
  open,
  onClose,
  deferredPrompt,
}: {
  open: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
}) {
  const [platform, setPlatform] = useState<PlatformKey>("other");
  const [showAll, setShowAll] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const diag = useInstallDiagnostics(deferredPrompt, open);

  useEffect(() => {
    if (open) {
      setPlatform(detectPlatform());
      setShowAll(false);
      setShowDiag(false);
    }
  }, [open]);

  const primary = GUIDES[platform];
  const others = (Object.keys(GUIDES) as PlatformKey[]).filter((k) => k !== platform);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
            className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent-pink flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.4)]">
                <Download size={36} className="text-white" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
              Install <span className="gradient-text">CopyMe</span>
            </h3>
            <p className="text-sm text-slate-500 text-center mb-2">
              Looks like you&apos;re using <strong>{primary.label}</strong>.
            </p>
            <p className="text-xs text-slate-400 text-center mb-6">
              Follow the steps below — these are instructions, not buttons. Your browser does the actual install.
            </p>

            {/* Primary platform — numbered steps */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-purple-200 p-5 mb-4">
              <ol className="space-y-3 list-none">
                {primary.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent-pink text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
              {primary.hint && (
                <p className="mt-4 pl-9 text-xs text-purple-600/80 italic leading-relaxed">
                  💡 {primary.hint}
                </p>
              )}
            </div>

            {/* Diagnostics — live PWA install criteria checklist */}
            <button
              type="button"
              onClick={() => setShowDiag((v) => !v)}
              className="w-full text-xs text-slate-500 hover:text-slate-700 mb-2 underline-offset-2 hover:underline"
            >
              {showDiag ? "Hide" : "Why isn't this working?"}
            </button>
            {showDiag && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-3 text-xs space-y-1.5 font-mono">
                <DiagRow label="HTTPS" pass={diag.https} />
                <DiagRow
                  label="Service worker"
                  pass={diag.serviceWorker === "active"}
                  value={diag.serviceWorker}
                />
                <DiagRow label="Manifest linked in HTML" pass={diag.manifestLinked} />
                <DiagRow
                  label="Manifest reachable"
                  pass={diag.manifestReachable === true}
                  value={
                    diag.manifestReachable === "checking"
                      ? "checking..."
                      : String(diag.manifestReachable)
                  }
                />
                <DiagRow
                  label="Native install prompt available"
                  pass={diag.beforeInstallPromptFired}
                  value={diag.beforeInstallPromptFired ? "yes" : "not fired"}
                />
                <DiagRow label="Already installed (standalone)" pass={diag.standalone} neutral />
                <p className="text-[10px] text-slate-400 mt-2 break-all">
                  UA: {diag.userAgent}
                </p>
                {!diag.beforeInstallPromptFired && diag.serviceWorker === "active" && diag.manifestReachable === true && (
                  <p className="text-[11px] text-amber-700 mt-2">
                    All criteria pass but the native prompt didn&apos;t fire. Try a hard-refresh
                    (pull down with two fingers on mobile, or Cmd/Ctrl+Shift+R on desktop) — the
                    browser may have cached an older manifest. Then wait ~5 seconds and click Install again.
                  </p>
                )}
              </div>
            )}

            {/* Other platforms — collapsed by default */}
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full text-xs text-slate-500 hover:text-slate-700 mb-3 underline-offset-2 hover:underline"
            >
              {showAll ? "Hide" : "Show"} other platforms
            </button>
            {showAll && (
              <div className="space-y-2 mb-4">
                {others.map((k) => (
                  <details
                    key={k}
                    className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-700"
                  >
                    <summary className="cursor-pointer font-semibold text-slate-900">
                      {GUIDES[k].label}
                    </summary>
                    <ol className="mt-3 space-y-2 list-decimal list-inside text-xs text-slate-500">
                      {GUIDES[k].steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            )}

            {/* Open in browser button */}
            <Link
              href="/app"
              className="flex items-center justify-center gap-2 w-full rounded-full py-3 text-sm font-semibold text-white gradient-bg-animated transition-shadow hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]"
            >
              Or open CopyMe in your browser
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DiagRow({
  label,
  pass,
  value,
  neutral,
}: {
  label: string;
  pass: boolean;
  value?: string;
  neutral?: boolean;
}) {
  const icon = neutral ? "ℹ" : pass ? "✓" : "✗";
  const color = neutral
    ? "text-slate-400"
    : pass
      ? "text-emerald-600"
      : "text-rose-600";
  return (
    <div className="flex items-center gap-2">
      <span className={`${color} font-bold w-3`}>{icon}</span>
      <span className="text-slate-700 flex-1">{label}</span>
      {value && <span className={color}>{value}</span>}
    </div>
  );
}
