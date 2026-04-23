"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Bell, BellOff, X, Share2, Copy, Check, Gift } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWebPush } from "@/lib/use-web-push";

// ---------------------------------------------------------------------------
// HomeNudges — compact strip shown at the top of InboxScreen.
//
// Renders:
//   - streak badge   ("🔥 3-day streak")          when streakDays > 0
//   - push CTA       ("Turn on notifications")    when supported + off
//   - invite card    ("Invite a friend")          for authed users
//
// All dismissible within a session; authoritative state comes from the
// server. The invite card uses navigator.share if available (mobile),
// falls back to copy-to-clipboard.
// ---------------------------------------------------------------------------

const PUSH_CTA_DISMISS_KEY = "copyme_push_cta_dismissed_at";
const INVITE_CTA_DISMISS_KEY = "copyme_invite_cta_dismissed_at";

function dismissedRecently(key: string): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
}

function pushCtaDismissedRecently(): boolean {
  return dismissedRecently(PUSH_CTA_DISMISS_KEY);
}

interface ReferralStatus {
  code: string;
  invitedCount: number;
  inviteUrl: string;
}

export default function HomeNudges() {
  const { user, authFetch } = useAuth();
  const push = useWebPush();
  const [streak, setStreak] = useState<number | null>(null);
  const [ctaDismissed, setCtaDismissed] = useState<boolean>(() =>
    pushCtaDismissedRecently(),
  );
  const [inviteDismissed, setInviteDismissed] = useState<boolean>(() =>
    dismissedRecently(INVITE_CTA_DISMISS_KEY),
  );
  const [referral, setReferral] = useState<ReferralStatus | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStreak = useCallback(async () => {
    if (!user) {
      setStreak(null);
      return;
    }
    try {
      const res = await authFetch("/api/users/me");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.data?.streakDays === "number") {
        setStreak(data.data.streakDays);
      }
    } catch {
      // ignore
    }
  }, [user, authFetch]);

  const fetchReferral = useCallback(async () => {
    if (!user) {
      setReferral(null);
      return;
    }
    try {
      const res = await authFetch("/api/users/me/referral");
      if (!res.ok) return;
      const data = await res.json();
      if (data?.data?.code) setReferral(data.data as ReferralStatus);
    } catch {
      /* ignore */
    }
  }, [user, authFetch]);

  useEffect(() => {
    fetchStreak();
    fetchReferral();
  }, [fetchStreak, fetchReferral]);

  const dismissPushCta = () => {
    try {
      localStorage.setItem(PUSH_CTA_DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage blocked is fine */
    }
    setCtaDismissed(true);
  };

  const dismissInviteCta = () => {
    try {
      localStorage.setItem(INVITE_CTA_DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setInviteDismissed(true);
  };

  const shareInvite = async () => {
    if (!referral) return;
    const text = `Join me on CopyMe — communication that actually means something. ${referral.inviteUrl}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "CopyMe", text, url: referral.inviteUrl });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(referral.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied; surface nothing — best-effort */
    }
  };

  const showStreak = typeof streak === "number" && streak > 0;
  const showPushCta =
    user &&
    !ctaDismissed &&
    (push.status === "off");
  const showInviteCta = user && !inviteDismissed && !!referral;

  if (!showStreak && !showPushCta && !showInviteCta) return null;

  return (
    <div className="px-4 mb-3 space-y-2">
      {showStreak && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200"
        >
          <Flame size={14} className="text-amber-500" />
          <span className="text-xs font-semibold text-amber-700">
            {streak}-day streak
          </span>
          <span className="text-[10px] text-amber-500/80">
            {streak === 1 ? "Nice — keep going" : `Don’t break it`}
          </span>
        </motion.div>
      )}

      <AnimatePresence>
        {showPushCta && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <Bell size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900">Turn on notifications</p>
              <p className="text-[11px] text-slate-500">
                Get a ping when a message arrives. No spam.
              </p>
            </div>
            <button
              onClick={push.enable}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
            >
              Enable
            </button>
            <button
              onClick={dismissPushCta}
              aria-label="Dismiss"
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {push.status === "denied" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
          <BellOff size={12} />
          Notifications are blocked in your browser settings. Enable them there to re-activate.
        </div>
      )}

      <AnimatePresence>
        {showInviteCta && referral && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 border border-purple-200 shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
              <Gift size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900">
                {referral.invitedCount > 0
                  ? `You've invited ${referral.invitedCount} ${referral.invitedCount === 1 ? "friend" : "friends"} 🎉`
                  : "Invite a friend"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                Code <span className="font-mono font-semibold text-purple-700">{referral.code}</span>
                {" — "}share your invite link
              </p>
            </div>
            <button
              onClick={shareInvite}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {copied ? <Check size={11} /> : (typeof navigator !== "undefined" && "share" in navigator ? <Share2 size={11} /> : <Copy size={11} />)}
              {copied ? "Copied" : "Share"}
            </button>
            <button
              onClick={dismissInviteCta}
              aria-label="Dismiss"
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
