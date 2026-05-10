"use client";

import { useEffect, useState } from "react";
import { X, Download, Share, Plus } from "lucide-react";

// PWA install prompt (S-161) + iOS Safari install handoff (S-162).
//
// On Chromium / Edge: listens for `beforeinstallprompt` and shows our
// branded chip on the second visit. On iOS Safari: detects the UA and
// shows a one-time overlay with the Share → "Add to Home Screen" steps
// (Safari doesn't expose a programmatic install).

const VISIT_KEY = "copyme.pwa.visits";
const DISMISSED_KEY = "copyme.pwa.dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    const visits = Number(localStorage.getItem(VISIT_KEY) ?? "0") + 1;
    localStorage.setItem(VISIT_KEY, String(visits));

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS legacy:
      (typeof (navigator as { standalone?: boolean }).standalone === "boolean" &&
        (navigator as { standalone?: boolean }).standalone === true);

    if (standalone) return;

    if (isIos && isSafari && visits >= 2) {
      setShowIos(true);
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      if (visits >= 2) setInstallEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setInstallEvent(null);
    setShowIos(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  if (!installEvent && !showIos) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)]">
      <div className="rounded-2xl bg-white shadow-xl border border-slate-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white">
            <Download size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">Install CopyMe</h3>
            {installEvent && (
              <p className="text-xs text-slate-500 mt-0.5">
                Get a faster, full-screen experience with push notifications.
              </p>
            )}
            {showIos && (
              <p className="text-xs text-slate-500 mt-0.5">
                Tap <Share size={11} className="inline -mt-0.5" /> Share, then{" "}
                <Plus size={11} className="inline -mt-0.5" /> Add to Home Screen.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-slate-400 hover:text-slate-700 -mr-1 -mt-1"
          >
            <X size={16} />
          </button>
        </div>
        {installEvent && (
          <button
            type="button"
            onClick={install}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-sm font-semibold py-2.5"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
