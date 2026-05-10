"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Mic, ScanLine, Activity } from "lucide-react";

// Privacy controls panel (S-145). One screen consolidating opt-outs that
// existed scattered across S-124, S-125, S-135. Each row links to the
// relevant Terms section.

const STORAGE_KEY = "copyme.privacy";

const DEFAULTS = {
  presence: true,        // Online indicator visible to others
  lastSeen: false,       // "Last seen" timestamp visible
  readReceipts: true,    // Send + see read receipts
  typing: true,          // "typing…" visible to others
  transcripts: false,    // Background transcribe my voice clips
  discoverable: false,   // Findable via interest-tag search (S-211)
};

export type PrivacyPrefs = typeof DEFAULTS;

export function readPrefs(): PrivacyPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { ...DEFAULTS, ...raw };
  } catch {
    return DEFAULTS;
  }
}

export function writePrefs(p: PrivacyPrefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

const ROWS: Array<{
  key: keyof PrivacyPrefs;
  label: string;
  hint: string;
  termsAnchor: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    key: "presence",
    label: "Show online status",
    hint: "Other users see when you're active.",
    termsAnchor: "/terms#privacy",
    icon: Activity,
  },
  {
    key: "lastSeen",
    label: "Show last-seen time",
    hint: "Others see how recently you were online. Default: off.",
    termsAnchor: "/terms#privacy",
    icon: Eye,
  },
  {
    key: "readReceipts",
    label: "Read receipts",
    hint: "Mutual: turn off and you won't see others' either.",
    termsAnchor: "/terms#privacy",
    icon: EyeOff,
  },
  {
    key: "typing",
    label: "Show 'typing…'",
    hint: "Others see when you're composing a reply.",
    termsAnchor: "/terms#privacy",
    icon: Activity,
  },
  {
    key: "transcripts",
    label: "Auto-transcribe my voice clips",
    hint: "Background AI transcript stored alongside your clips for accessibility.",
    termsAnchor: "/terms#ai-features",
    icon: Mic,
  },
  {
    key: "discoverable",
    label: "Findable via interest search",
    hint: "Lets people discover you via shared interest tags.",
    termsAnchor: "/terms#discovery",
    icon: ScanLine,
  },
];

export default function PrivacyControls() {
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULTS);

  useEffect(() => setPrefs(readPrefs()), []);

  function set<K extends keyof PrivacyPrefs>(k: K, v: PrivacyPrefs[K]) {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    writePrefs(next);
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
      {ROWS.map((row) => (
        <div key={row.key} className="px-4 py-3 flex items-start gap-3">
          <row.icon size={18} className="text-purple-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900">{row.label}</div>
            <div className="text-xs text-slate-500">
              {row.hint}{" "}
              <a href={row.termsAnchor} className="text-purple-600 hover:underline">
                Read in Terms
              </a>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[row.key]}
            onClick={() => set(row.key, !prefs[row.key])}
            className={`shrink-0 w-10 h-6 rounded-full transition-colors ${
              prefs[row.key] ? "bg-gradient-to-r from-indigo-500 to-pink-500" : "bg-slate-200"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                prefs[row.key] ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
