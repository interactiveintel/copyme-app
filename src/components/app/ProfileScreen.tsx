"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Eye,
  EyeOff,
  Edit3,
  Crown,
  MapPin,
  Sparkles,
  Users,
  MessageSquare,
  X,
  Plus,
  Save,
  LogOut,
  AlertTriangle,
  Trash2,
  Camera,
  ShieldOff,
  Phone,
  Wallet,
  Lock,
  Globe,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import GlassCard from "../ui/GlassCard";
import GradientButton from "../ui/GradientButton";
import AppBrand from "./AppBrand";
import ReferralBanner from "./ReferralBanner";
import BlockedUsersSheet from "./BlockedUsersSheet";
import CallHistorySheet from "./CallHistorySheet";
import NewGroupCallSheet from "./NewGroupCallSheet";
import { joinActiveCall } from "./GlobalCallListener";
import { compressImage } from "@/lib/image-compress";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/i18n/client";

interface Profile {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  profileType: string;
  accountTier: string;
  vapEnabled: boolean;
  preferredCurrency: string;
  lastActivityAt: string | null;
  createdAt: string;
  location: {
    globalArea: string | null;
    countryPhoneCode: string | null;
    region: string | null;
    cityZip: string | null;
    localDescription: string | null;
    locationVisible: boolean;
  } | null;
  interests: Array<{ slotNumber: number; interestText: string }>;
  descriptions: Array<{
    category: string;
    level: string | null;
    location: string | null;
    institution: string | null;
    typeDescription: string | null;
  }>;
}

function CircularProgress({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = (value / max) * 100;
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" stroke="rgba(0,0,0,0.06)" strokeWidth="4" fill="none" />
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke={`url(#${color})`}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
          <defs>
            <linearGradient id={color} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="50%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-slate-900">{value}/{max}</span>
        </div>
      </div>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}

export default function ProfileScreen() {
  const { user, authFetch, logout } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationVisible, setLocationVisible] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editInterests, setEditInterests] = useState<Array<{ slotNumber: number; interestText: string }>>([]);
  const [newInterest, setNewInterest] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blockedSheetOpen, setBlockedSheetOpen] = useState(false);
  // v4.15.7: Sprint 5 — call history sheet, opened from Settings.
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);
  // v4.15.12 (Sprint 6): group-call picker, opened from Settings.
  const [groupCallOpen, setGroupCallOpen] = useState(false);
  const [deleteStage, setDeleteStage] = useState<"closed" | "confirm" | "deleting" | "done">("closed");
  const [deleteError, setDeleteError] = useState("");
  // Avatar upload (v4.14.1 — beta tester Joze couldn't change his
  // profile pic post-signup because this UI never existed).
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  // v4.16.2 (F6a): currency picker in Settings. Inflight flag so the
  // toggle disables itself during the network round-trip; error string
  // surfaces under the row on failure.
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  // v4.16.13 (Tier S Phase 2): E2E opt-in toggle in Settings. The
  // toggle drives PUT/DELETE /api/e2e/bundle. Real key material lives
  // client-side in the libsignal store; until a native client wires
  // libsignal in the browser, the published bundle is a placeholder
  // and the lock indicator is informational only.
  const [e2eEnabled, setE2eEnabled] = useState(false);
  const [e2eSaving, setE2eSaving] = useState(false);
  const [e2eError, setE2eError] = useState<string | null>(null);
  // v4.16.22: language picker. preferredLocale drives BOTH the UI
  // strings AND the send-time auto-translation gate (messages
  // translate when sender/receiver locales differ). Until this row
  // existed, no UI could change it — every account stayed "en" and
  // translation never fired for anyone.
  const [langSaving, setLangSaving] = useState(false);
  const [langError, setLangError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const res = await authFetch("/api/users/me");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.data);
          setLocationVisible(data.data?.location?.locationVisible ?? true);
        }
      } catch {
        // network error
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authFetch]);

  // v4.16.13: fetch E2E opt-in state on mount. 404 = not enrolled
  // (toggle off); 200 = enrolled (toggle on). All other statuses
  // leave the toggle in the default-off state.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const res = await authFetch("/api/e2e/bundle");
        if (!alive) return;
        if (res.ok) setE2eEnabled(true);
        else if (res.status === 404) setE2eEnabled(false);
      } catch {
        /* network — keep default */
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, authFetch]);

  // Placeholder bundle for the E2E toggle. Browser libsignal isn't
  // available (0.94 = native Node only), so the published bundle is
  // a marker — a real key bundle gets published when a native client
  // bundles libsignal and re-PUTs through this same endpoint.
  function makePlaceholderBundle(): { bundle: string; registrationId: number } {
    return {
      bundle: JSON.stringify({
        kind: "placeholder",
        createdAt: new Date().toISOString(),
        note: "Awaiting native-client key publication",
      }),
      // 32-bit unsigned random; matches libsignal's reg-ID space.
      registrationId: Math.floor(Math.random() * 0xffff_ffff),
    };
  }

  // v4.16.22: change app + translation language. Updates the client
  // strings immediately (setLocale writes localStorage) and persists
  // to the User row so the send-time translation gate sees it.
  const handleLanguageChange = async (next: "en" | "si" | "es" | "de" | "fr") => {
    setLangError(null);
    setLocale(next);
    if (!user) return; // demo mode — client-only flip
    setLangSaving(true);
    try {
      const res = await authFetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLocale: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setLangError(data?.error?.message || "Couldn't save language. Try again.");
      }
    } catch {
      setLangError("Network error. Try again.");
    } finally {
      setLangSaving(false);
    }
  };

  const handleE2EToggle = async (next: boolean) => {
    if (!user) {
      setE2eEnabled(next);
      return;
    }
    setE2eError(null);
    setE2eSaving(true);
    const prev = e2eEnabled;
    setE2eEnabled(next);
    try {
      const res = next
        ? await authFetch("/api/e2e/bundle", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(makePlaceholderBundle()),
          })
        : await authFetch("/api/e2e/bundle", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setE2eEnabled(prev);
        setE2eError(data?.error?.message || "Couldn't update encryption setting. Try again.");
      }
    } catch {
      setE2eEnabled(prev);
      setE2eError("Network error. Try again.");
    } finally {
      setE2eSaving(false);
    }
  };

  // Demo profile fallback when no real user data is available
  const demoProfile = useMemo<Profile>(() => ({
    id: "demo_paul",
    displayName: "Paul Pereira",
    profileType: "personal",
    accountTier: "premium",
    vapEnabled: true,
    preferredCurrency: "USD",
    lastActivityAt: new Date().toISOString(),
    createdAt: "2024-01-15T00:00:00.000Z",
    location: {
      globalArea: "Americas",
      countryPhoneCode: "United States",
      region: "Florida",
      cityZip: "Miami",
      localDescription: null,
      locationVisible: true,
    },
    interests: [
      { slotNumber: 1, interestText: "technology" },
      { slotNumber: 2, interestText: "entrepreneurship" },
      { slotNumber: 3, interestText: "AI" },
      { slotNumber: 4, interestText: "photography" },
      { slotNumber: 5, interestText: "travel" },
      { slotNumber: 6, interestText: "design" },
      { slotNumber: 7, interestText: "music" },
    ],
    descriptions: [
      {
        category: "Business",
        level: "Executive",
        location: null,
        institution: "CopyMe Inc.",
        typeDescription: "Founder & CEO",
      },
    ],
  }), []);

  const [localProfile, setLocalProfile] = useState<Profile | null>(null);

  const startEditing = () => {
    const p = profile ?? localProfile ?? demoProfile;
    setEditName(p.displayName);
    setEditCity(p.location?.cityZip || "");
    setEditRegion(p.location?.region || "");
    setEditCountry(p.location?.countryPhoneCode || "");
    setEditInterests([...p.interests]);
    setNewInterest("");
    const d = p.descriptions?.[0];
    setEditCategory(d?.category || "");
    setEditLevel(d?.level || "");
    setEditInstitution(d?.institution || "");
    setEditDetail(d?.typeDescription || "");
    setEditMode(true);
  };

  const cancelEditing = () => {
    setSaveError("");
    setEditMode(false);
  };

  // -------------------------------------------------------------------------
  // Account deletion (GDPR right to erasure)
  // -------------------------------------------------------------------------

  // v4.16.2 (F6a): flip preferredCurrency. PUT /api/users/me updates
  // the User row AND propagates to any existing VapAccount in one
  // round-trip (server-side updateMany). Local profile state is
  // updated immediately so the picker reflects the new selection
  // before the response lands.
  const handleCurrencyChange = async (next: "USD" | "EUR") => {
    if (!user) {
      // Demo mode — flip the local view only, no network.
      setLocalProfile((p) => (p ? { ...p, preferredCurrency: next } : p));
      return;
    }
    setCurrencyError(null);
    setCurrencySaving(true);
    const prev = (profile ?? localProfile)?.preferredCurrency;
    // Optimistic update
    setProfile((p) => (p ? { ...p, preferredCurrency: next } : p));
    try {
      const res = await authFetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCurrency: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // Rollback
        setProfile((p) => (p && prev ? { ...p, preferredCurrency: prev } : p));
        setCurrencyError(data?.error?.message || "Couldn't update currency. Try again.");
      }
    } catch {
      setProfile((p) => (p && prev ? { ...p, preferredCurrency: prev } : p));
      setCurrencyError("Network error. Try again.");
    } finally {
      setCurrencySaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    if (!user) {
      // Demo mode: just close the modal — there's nothing to delete.
      setSettingsOpen(false);
      setDeleteStage("closed");
      return;
    }
    setDeleteStage("deleting");
    try {
      const res = await authFetch("/api/users/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setDeleteStage("confirm");
        setDeleteError(data?.error?.message || "Couldn't delete your account. Try again.");
        return;
      }
      setDeleteStage("done");
      // Give the user a moment to read the confirmation before we log them
      // out and send them back to the landing page.
      setTimeout(() => {
        logout();
        window.location.href = "/";
      }, 1500);
    } catch {
      setDeleteStage("confirm");
      setDeleteError("Network error. Please try again.");
    }
  };

  const saveEditing = async () => {
    setSaveError("");
    const p = profile ?? localProfile ?? demoProfile;
    const updated: Profile = {
      ...p,
      displayName: editName.trim() || p.displayName,
      location: {
        globalArea: p.location?.globalArea || null,
        countryPhoneCode: editCountry.trim() || p.location?.countryPhoneCode || null,
        region: editRegion.trim() || p.location?.region || null,
        cityZip: editCity.trim() || p.location?.cityZip || null,
        localDescription: p.location?.localDescription || null,
        locationVisible: p.location?.locationVisible ?? true,
      },
      interests: editInterests,
      descriptions: [{
        category: editCategory.trim() || p.descriptions?.[0]?.category || "Business",
        level: editLevel.trim() || p.descriptions?.[0]?.level || null,
        location: p.descriptions?.[0]?.location || null,
        institution: editInstitution.trim() || p.descriptions?.[0]?.institution || null,
        typeDescription: editDetail.trim() || p.descriptions?.[0]?.typeDescription || null,
      }],
    };

    // Authenticated user: persist via API. Demo mode keeps local state only.
    if (user) {
      setSaving(true);
      try {
        const payload = {
          displayName: updated.displayName,
          location: {
            globalArea: updated.location?.globalArea ?? undefined,
            countryPhoneCode: updated.location?.countryPhoneCode ?? undefined,
            region: updated.location?.region ?? undefined,
            cityZip: updated.location?.cityZip ?? undefined,
            localDescription: updated.location?.localDescription ?? undefined,
            locationVisible: updated.location?.locationVisible,
          },
          interests: updated.interests,
          descriptions: updated.descriptions,
        };
        const res = await authFetch("/api/users/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setSaveError(data?.error?.message || "Couldn't save profile. Please try again.");
          return;
        }
        setProfile(data.data);
      } catch {
        setSaveError("Network error. Please try again.");
        return;
      } finally {
        setSaving(false);
      }
    } else {
      // Demo fallback
      if (profile) setProfile(updated);
      else setLocalProfile(updated);
    }

    setEditMode(false);
  };

  // Upload a new avatar. Multipart → /api/uploads/avatar, which sniffs
  // + EXIF-strips the bytes server-side and persists the Blob URL on
  // the user row. On success we refetch /api/users/me so the new URL
  // is reflected immediately without a page reload.
  //
  // v4.15.8 (F3): client-side compression. Joze couldn't upload his
  // Samsung front-camera shot because it blew past the 2MB cap. Now
  // we resize + recompress to fit ~1.8MB before posting, so the
  // server only ever sees a friendly-sized image.
  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      setAvatarError("Sign in to upload a photo.");
      return;
    }
    setAvatarUploading(true);
    try {
      let uploadFile = file;
      try {
        uploadFile = await compressImage(file);
      } catch {
        // Decode/encode failed (corrupt image or unsupported format
        // like raw HEIC on older Safari). Fall through to upload the
        // original — the server's 2MB cap will still catch oversize.
      }
      if (uploadFile.size > 2 * 1024 * 1024) {
        setAvatarError("Image is too large even after compression. Try a different photo.");
        return;
      }
      const form = new FormData();
      form.append("file", uploadFile);
      const res = await authFetch("/api/uploads/avatar", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setAvatarError(data?.error === "TOO_LARGE" ? "Image must be under 2 MB." : "Upload failed. Try a different image.");
        return;
      }
      // Refetch the canonical profile so avatarUrl propagates everywhere
      // that reads `profile`. Cheap because /api/users/me is fast.
      const refreshed = await authFetch("/api/users/me");
      if (refreshed.ok) {
        const d = await refreshed.json();
        setProfile(d.data);
      } else {
        // Optimistic fallback so the user sees their pic immediately even
        // if the refetch flaked.
        setProfile((prev) => (prev ? { ...prev, avatarUrl: data.url } : prev));
      }
    } catch {
      setAvatarError("Network error. Try again.");
    } finally {
      setAvatarUploading(false);
      // Clear the input so picking the same file twice still triggers onChange.
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const addInterest = () => {
    const text = newInterest.trim().toLowerCase();
    if (!text || editInterests.length >= 7) return;
    if (editInterests.some((i) => i.interestText === text)) return;
    const nextSlot = editInterests.length > 0 ? Math.max(...editInterests.map((i) => i.slotNumber)) + 1 : 1;
    setEditInterests([...editInterests, { slotNumber: nextSlot, interestText: text }]);
    setNewInterest("");
  };

  const removeInterest = (slotNumber: number) => {
    setEditInterests(editInterests.filter((i) => i.slotNumber !== slotNumber));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // "Demo" should ONLY apply when there's no authenticated user at all.
  // Previously `isDemo = !profile` was true any time /api/users/me failed
  // for a signed-in user — and the fallback was the hardcoded
  // "Paul Pereira" `demoProfile` with Paul's photo + Miami location.
  // That leaked the founder's identity to anyone whose profile fetch
  // hit a network blip. See `feedback_dev_placeholder_leaks.md` in
  // Claude memory + v4.13.16 ChatScreen fix.
  const isDemo = !profile && !user;

  // For authenticated users without a fetched profile, build a minimal
  // profile from the auth context so we render *their* identity, not
  // Paul's. demoProfile is reserved for the truly-unauthenticated case
  // (which shouldn't happen since ProfileScreen is auth-gated, but
  // defensive).
  const authFallbackProfile: Profile | null = user
    ? {
        id: user.id,
        displayName: user.displayName,
        profileType: "personal",
        accountTier: user.accountTier ?? "basic",
        vapEnabled: false,
        preferredCurrency: "USD",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        location: null,
        interests: [],
        descriptions: [],
      }
    : null;

  const activeProfile =
    profile ?? localProfile ?? authFallbackProfile ?? demoProfile;

  const displayName = activeProfile.displayName || user?.displayName || "User";
  const tier = activeProfile.accountTier || "basic";
  const interests = activeProfile.interests || [];
  const desc = activeProfile.descriptions?.[0];

  const demoStats = { contacts: 10, groups: 3 };
  const demoRuleOf7 = { messages: 5, contacts: 7, interests: 7 };

  const locationEntries = activeProfile.location
    ? [
        { level: t("profile.location.global"), value: activeProfile.location.globalArea },
        { level: t("profile.location.country"), value: activeProfile.location.countryPhoneCode },
        { level: t("profile.location.region"), value: activeProfile.location.region },
        { level: t("profile.location.city"), value: activeProfile.location.cityZip },
        { level: t("profile.location.local"), value: activeProfile.location.localDescription },
      ].filter((l) => l.value)
    : [];

  return (
    <div className="flex flex-col h-full pb-28 overflow-y-auto">
      {/* Header with gradient mesh */}
      <div className="relative pt-10 pb-8 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" />
        <div className="absolute top-0 left-1/4 w-40 h-40 rounded-full bg-purple-200/30 blur-[60px]" />
        <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full bg-indigo-200/30 blur-[60px]" />

        <div className="relative z-10">
          <AppBrand className="mb-2" />
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-slate-900">{t("profile.header.title")}</h1>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setSettingsOpen(true);
                setDeleteStage("closed");
                setDeleteError("");
              }}
              aria-label="Open settings"
              className="w-9 h-9 rounded-full bg-white/80 shadow-sm flex items-center justify-center"
            >
              <Settings size={18} className="text-slate-500" />
            </motion.button>
          </div>

          <div className="flex flex-col items-center">
            {/* Hidden file input — triggered by the camera badge overlay. */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarPick}
            />
            <div className="relative">
              {isDemo ? (
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[3px]">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/avatars/paul-1.jpg"
                        alt={displayName}
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                  </div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white" />
                </div>
              ) : (
                <Avatar
                  name={displayName}
                  size="xl"
                  src={activeProfile.avatarUrl ?? undefined}
                  online
                  showStatus
                />
              )}
              {/* Camera overlay — only for authenticated users. Tap to
                  open the file picker. Spinner overlays while uploading. */}
              {user && (
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg flex items-center justify-center border-2 border-white disabled:opacity-60"
                  aria-label="Change profile photo"
                >
                  {avatarUploading ? (
                    <span className="w-3 h-3 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera size={12} className="text-white" />
                  )}
                </button>
              )}
            </div>
            {avatarError && (
              <p className="mt-2 text-[11px] text-rose-500">{avatarError}</p>
            )}
            {editMode ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-xl font-bold text-slate-900 mt-3 bg-white/80 border border-purple-300 rounded-xl px-3 py-1 text-center focus:outline-none focus:border-purple-500 transition-colors w-48"
              />
            ) : (
              <h2 className="text-xl font-bold text-slate-900 mt-3">{displayName}</h2>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <Crown size={12} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-400 capitalize">{tier} {t("profile.planSuffix")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 -mt-2">
        {/* Referral promo (Tier C9 / S-246) — hides itself for paid tiers */}
        <ReferralBanner />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: t("profile.stats.contacts"), value: isDemo ? String(demoStats.contacts) : "—" },
            { icon: MessageSquare, label: t("profile.stats.groups"), value: isDemo ? String(demoStats.groups) : "—" },
            { icon: Crown, label: t("profile.planSuffix"), value: tier },
          ].map((stat, i) => (
            <GlassCard key={i}>
              <div className="p-3 text-center">
                <stat.icon size={16} className="text-purple-400 mx-auto mb-1" />
                <p className="text-base font-bold text-slate-900 capitalize">{stat.value}</p>
                <p className="text-[10px] text-slate-500">{stat.label}</p>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Location */}
        {editMode ? (
          <GlassCard>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={14} className="text-purple-400" />
                <span className="text-sm font-semibold text-slate-900">{t("profile.section.location")}</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "City", value: editCity, setter: setEditCity },
                  { label: "Region", value: editRegion, setter: setEditRegion },
                  { label: "Country", value: editCountry, setter: setEditCountry },
                ].map((field) => (
                  <div key={field.label} className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 w-14 shrink-0">{field.label}</span>
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      placeholder={field.label}
                      className="flex-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        ) : locationEntries.length > 0 ? (
          <GlassCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-purple-400" />
                  <span className="text-sm font-semibold text-slate-900">{t("profile.section.location")}</span>
                </div>
                <button
                  onClick={() => setLocationVisible(!locationVisible)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {locationVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              <div className="space-y-2">
                {locationEntries.map((loc, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 w-12 shrink-0">{loc.level}</span>
                    <div className="w-1 h-1 rounded-full bg-purple-500/40" />
                    <span className="text-xs text-slate-500">{loc.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        ) : null}

        {/* Interests */}
        <GlassCard>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-slate-900">{t("profile.section.interests")}</span>
              <span className="text-[10px] text-slate-400 ml-auto">{t("profile.interests.slots", { n: editMode ? editInterests.length : interests.length })}</span>
            </div>
            {editMode ? (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {editInterests.map((interest) => (
                    <span
                      key={interest.slotNumber}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 text-purple-600 border border-purple-500/20 flex items-center gap-1.5"
                    >
                      {interest.interestText}
                      <button onClick={() => removeInterest(interest.slotNumber)} className="hover:text-red-500 transition-colors">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                {editInterests.length < 7 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addInterest(); }}
                      placeholder="Add interest..."
                      className="flex-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400 transition-colors"
                    />
                    <button onClick={addInterest} className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center hover:bg-purple-200 transition-colors">
                      <Plus size={14} className="text-purple-600" />
                    </button>
                  </div>
                )}
              </>
            ) : interests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <span
                    key={interest.slotNumber}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 text-purple-600 border border-purple-500/20"
                  >
                    {interest.interestText}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No interests added yet</p>
            )}
          </div>
        </GlassCard>

        {/* Description */}
        {editMode ? (
          <GlassCard>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Edit3 size={14} className="text-purple-400" />
                <span className="text-sm font-semibold text-slate-900">About</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Category", value: editCategory, setter: setEditCategory },
                  { label: "Level", value: editLevel, setter: setEditLevel },
                  { label: "Institution", value: editInstitution, setter: setEditInstitution },
                  { label: "Detail", value: editDetail, setter: setEditDetail },
                ].map((field) => (
                  <div key={field.label} className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 w-16 shrink-0">{field.label}</span>
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      placeholder={field.label}
                      className="flex-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        ) : desc ? (
          <GlassCard>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Edit3 size={14} className="text-purple-400" />
                <span className="text-sm font-semibold text-slate-900">About</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Category", value: desc.category },
                  { label: "Level", value: desc.level },
                  { label: "Institution", value: desc.institution },
                  { label: "Detail", value: desc.typeDescription },
                ]
                  .filter((item) => item.value)
                  .map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 w-16 shrink-0">{item.label}</span>
                      <span className="text-xs text-slate-500 capitalize">{item.value}</span>
                    </div>
                  ))}
              </div>
            </div>
          </GlassCard>
        ) : null}

        {/* Rule of 7 Status */}
        <GlassCard gradient>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Crown size={14} className="text-amber-400" />
              <span className="text-sm font-semibold text-slate-900">Rule of 7 Status</span>
            </div>
            <div className="flex justify-around">
              <CircularProgress
                value={isDemo ? demoRuleOf7.messages : 0}
                max={7}
                label={t("profile.stats.messages")}
                color="gradMsg"
              />
              <CircularProgress
                value={isDemo ? demoRuleOf7.contacts : 0}
                max={7}
                label={t("profile.stats.contacts")}
                color="gradCon"
              />
              <CircularProgress
                value={isDemo ? demoRuleOf7.interests : interests.length}
                max={7}
                label={t("profile.stats.interests")}
                color="gradInt"
              />
            </div>
          </div>
        </GlassCard>

        {/* Upgrade CTA */}
        <GlassCard>
          <div className="p-5 text-center">
            <Crown size={28} className="text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900 mb-1">{t("profile.upgrade.title")}</p>
            <p className="text-xs text-slate-500 mb-4">{t("profile.upgrade.subtitle")}</p>
            <GradientButton className="mx-auto">{t("profile.upgrade.cta")}</GradientButton>
          </div>
        </GlassCard>

        {/* Edit profile */}
        {editMode ? (
          <>
            {saveError && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">
                <p className="text-xs text-rose-700">{saveError}</p>
              </div>
            )}
            <div className="flex gap-3 mb-4">
              <GradientButton
                variant="outline"
                className="flex-1"
                onClick={cancelEditing}
                disabled={saving}
              >
                <X size={16} /> Cancel
              </GradientButton>
              <GradientButton
                className="flex-1"
                onClick={saveEditing}
                disabled={saving}
                loading={saving}
              >
                <Save size={16} /> {saving ? "Saving..." : "Save"}
              </GradientButton>
            </div>
          </>
        ) : (
          <GradientButton variant="outline" className="w-full mb-4" onClick={startEditing}>
            <Edit3 size={16} /> Edit Profile
          </GradientButton>
        )}
      </div>

      {/* Settings modal */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (deleteStage === "deleting") return; // block dismiss mid-delete
              setSettingsOpen(false);
              setDeleteStage("closed");
            }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6"
            >
              {deleteStage === "done" ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <Trash2 size={22} className="text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Account deleted</h3>
                  <p className="text-sm text-slate-500">Redirecting you to the home page…</p>
                </div>
              ) : deleteStage === "confirm" || deleteStage === "deleting" ? (
                <>
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                      <AlertTriangle size={18} className="text-rose-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Delete your account?</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        This permanently deletes your profile, messages, contacts, and tokens.
                        We&apos;ll keep anonymized operational logs for up to 12 months as
                        described in our{" "}
                        <Link href="/privacy" className="underline text-purple-600">
                          Privacy Policy
                        </Link>
                        . This cannot be undone.
                      </p>
                    </div>
                  </div>

                  {deleteError && (
                    <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">
                      <p className="text-xs text-rose-700">{deleteError}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteStage("closed")}
                      disabled={deleteStage === "deleting"}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteStage === "deleting"}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 disabled:opacity-60"
                    >
                      {deleteStage === "deleting" ? "Deleting..." : "Delete permanently"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-slate-900">{t("profile.settings.title")}</h3>
                    <button
                      onClick={() => setSettingsOpen(false)}
                      className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
                      aria-label="Close settings"
                    >
                      <X size={16} className="text-slate-500" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <Link
                      href="/privacy"
                      className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 text-sm text-slate-700"
                    >
                      <span>{t("profile.settings.privacy")}</span>
                      <span className="text-xs text-slate-400">→</span>
                    </Link>
                    <Link
                      href="/terms"
                      className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 text-sm text-slate-700"
                    >
                      <span>{t("profile.settings.terms")}</span>
                      <span className="text-xs text-slate-400">→</span>
                    </Link>
                    {/* v4.16.2 (F6a): VAP wallet currency picker. Joze
                        (Slovenia) was stuck in USD because the schema
                        defaulted that way and no UI existed to switch.
                        Updates User.preferredCurrency AND propagates to
                        the existing VapAccount in one round-trip. */}
                    {(() => {
                      const cur = (profile ?? localProfile ?? demoProfile).preferredCurrency;
                      return (
                        <div className="px-3 py-3 rounded-xl hover:bg-slate-50">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-sm text-slate-700">
                              <Wallet size={14} className="text-slate-500" />
                              Wallet currency
                            </span>
                            <div className="flex bg-slate-100 rounded-full p-0.5">
                              {(["USD", "EUR"] as const).map((opt) => {
                                const active = cur === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    disabled={currencySaving || active}
                                    onClick={() => void handleCurrencyChange(opt)}
                                    className={`px-3 py-1 rounded-full text-[11px] font-semibold tabular-nums transition-all ${
                                      active
                                        ? "bg-white text-purple-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                    } ${currencySaving && !active ? "opacity-40" : ""}`}
                                    aria-pressed={active}
                                  >
                                    {opt === "USD" ? "$ USD" : "€ EUR"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {currencyError && (
                            <p className="mt-1.5 text-[11px] text-rose-600">{currencyError}</p>
                          )}
                        </div>
                      );
                    })()}
                    {/* v4.16.22: language picker. Drives UI strings AND
                        the send-time translation gate — messages auto-
                        translate when you and your contact have
                        different languages set here. */}
                    <div className="px-3 py-3 rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm text-slate-700">
                          <Globe size={14} className="text-slate-500" />
                          Language
                        </span>
                        <select
                          value={locale}
                          disabled={langSaving}
                          onChange={(e) => void handleLanguageChange(e.target.value as "en" | "si" | "es" | "de" | "fr")}
                          className="bg-slate-100 rounded-full px-3 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-60"
                          aria-label="App and translation language"
                        >
                          <option value="en">English</option>
                          <option value="si">Slovenščina</option>
                          <option value="es">Español</option>
                          <option value="de">Deutsch</option>
                          <option value="fr">Français</option>
                        </select>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Messages auto-translate when your contact uses a different language.
                      </p>
                      {langError && (
                        <p className="mt-1 text-[11px] text-rose-600">{langError}</p>
                      )}
                    </div>
                    {/* v4.16.13 (Tier S Phase 2): E2E opt-in toggle.
                        Flips a placeholder bundle on the user row so
                        pairE2EReady evaluates true and the lock
                        indicator lights up in ChatScreen. Real key
                        material lands when a native client publishes
                        a libsignal bundle through the same endpoint. */}
                    <div className="px-3 py-3 rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm text-slate-700">
                          <Lock size={14} className="text-slate-500" />
                          End-to-end encryption
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleE2EToggle(!e2eEnabled)}
                          disabled={e2eSaving}
                          className={`w-10 h-5 rounded-full relative transition-all ${
                            e2eEnabled
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                              : "bg-slate-200"
                          } ${e2eSaving ? "opacity-60" : ""}`}
                          aria-pressed={e2eEnabled}
                          aria-label="Toggle end-to-end encryption"
                        >
                          <motion.div
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                            animate={{ left: e2eEnabled ? 22 : 2 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {e2eEnabled
                          ? "Lock icon shows in chats with peers who also enabled this. Native key material publishes when the mobile app installs."
                          : "Opt into E2E to enable the lock indicator in compatible chats."}
                      </p>
                      {e2eError && (
                        <p className="mt-1 text-[11px] text-rose-600">{e2eError}</p>
                      )}
                    </div>
                    {user && (
                      <button
                        onClick={() => {
                          setSettingsOpen(false);
                          setGroupCallOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 text-sm text-slate-700"
                      >
                        <span className="flex items-center gap-2">
                          <Users size={14} className="text-slate-500" /> Start group call
                        </span>
                        <span className="text-xs text-slate-400">→</span>
                      </button>
                    )}
                    {user && (
                      <button
                        onClick={() => {
                          setSettingsOpen(false);
                          setCallHistoryOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 text-sm text-slate-700"
                      >
                        <span className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-500" /> Call history
                        </span>
                        <span className="text-xs text-slate-400">→</span>
                      </button>
                    )}
                    {user && (
                      <button
                        onClick={() => {
                          setSettingsOpen(false);
                          setBlockedSheetOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 text-sm text-slate-700"
                      >
                        <span className="flex items-center gap-2">
                          <ShieldOff size={14} className="text-slate-500" /> Blocked users
                        </span>
                        <span className="text-xs text-slate-400">→</span>
                      </button>
                    )}
                    {user && (
                      <button
                        onClick={() => {
                          logout();
                          window.location.href = "/";
                        }}
                        className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 text-sm text-slate-700"
                      >
                        <span className="flex items-center gap-2">
                          <LogOut size={14} className="text-slate-500" /> {t("profile.settings.signout")}
                        </span>
                        <span className="text-xs text-slate-400">→</span>
                      </button>
                    )}
                  </div>

                  <div className="mt-5 pt-5 border-t border-slate-100">
                    <button
                      onClick={() => setDeleteStage("confirm")}
                      className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-rose-50 text-sm text-rose-600"
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 size={14} /> Delete account
                      </span>
                      <span className="text-xs text-rose-400">→</span>
                    </button>
                    {!user && (
                      <p className="mt-2 px-3 text-[11px] text-slate-400">
                        Sign in to delete a real account — demo mode has nothing to delete.
                      </p>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocked users sheet — opened from Settings. */}
      <AnimatePresence>
        {blockedSheetOpen && user && (
          <BlockedUsersSheet
            authFetch={authFetch}
            onClose={() => setBlockedSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Call history sheet — opened from Settings (v4.15.7). */}
      <AnimatePresence>
        {callHistoryOpen && user && (
          <CallHistorySheet
            authFetch={authFetch}
            onClose={() => setCallHistoryOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* New group call picker — opened from Settings (v4.15.12). */}
      <AnimatePresence>
        {groupCallOpen && user && (
          <NewGroupCallSheet
            authFetch={authFetch}
            onClose={() => setGroupCallOpen(false)}
            onCallStarted={(call) => {
              // GlobalCallListener mounts CallSheet on this event.
              joinActiveCall({
                callId: call.callId,
                peerName: "Group call",
                callType: "voice", // overridden by useTracks at render time
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
