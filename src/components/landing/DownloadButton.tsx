"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Monitor, Smartphone, X, Globe, Laptop } from "lucide-react";
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
        <InstallModal open={showModal} onClose={() => setShowModal(false)} />
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
        <InstallModal open={showModal} onClose={() => setShowModal(false)} />
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
      <InstallModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Install Instructions Modal
// ---------------------------------------------------------------------------

function InstallModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
            className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
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
            <p className="text-sm text-slate-400 text-center mb-8">
              Add CopyMe to your device for the best experience
            </p>

            {/* Platform Instructions */}
            <div className="space-y-3">
              <PlatformCard
                icon={<Globe size={20} />}
                platform="Chrome / Edge"
                instructions='Click the install icon (⊕) in the address bar, or Menu → "Install CopyMe"'
                gradient="from-blue-500 to-green-500"
              />
              <PlatformCard
                icon={<Laptop size={20} />}
                platform="Safari (Mac)"
                instructions='File → "Add to Dock" or Share → "Add to Home Screen"'
                gradient="from-slate-400 to-slate-300"
              />
              <PlatformCard
                icon={<Smartphone size={20} />}
                platform="Mobile"
                instructions='Tap Share → "Add to Home Screen" for an app-like experience'
                gradient="from-accent-pink to-secondary"
              />
              <PlatformCard
                icon={<Monitor size={20} />}
                platform="Desktop"
                instructions="Works on Windows, Mac, and Linux via Chrome, Edge, or Brave"
                gradient="from-primary to-accent-cyan"
              />
            </div>

            {/* Open in browser button */}
            <Link
              href="/app"
              className="mt-6 flex items-center justify-center gap-2 w-full rounded-full py-3 text-sm font-semibold text-white gradient-bg-animated transition-shadow hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]"
            >
              Open CopyMe in Browser
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PlatformCard({
  icon,
  platform,
  instructions,
  gradient,
}: {
  icon: React.ReactNode;
  platform: string;
  instructions: string;
  gradient: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{platform}</p>
        <p className="text-xs text-slate-500 mt-0.5">{instructions}</p>
      </div>
    </div>
  );
}
