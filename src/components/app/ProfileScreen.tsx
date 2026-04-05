"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Settings, Eye, EyeOff, Edit3, Crown, MapPin, Sparkles, Users, MessageSquare } from "lucide-react";
import Avatar from "../ui/Avatar";
import GlassCard from "../ui/GlassCard";
import GradientButton from "../ui/GradientButton";
import { useAuth } from "@/lib/auth-context";
import { MOCK_PROFILES } from "@/lib/mock-data";

interface Profile {
  id: string;
  displayName: string;
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
  const { user, authFetch } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationVisible, setLocationVisible] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Demo profile fallback when no real user data is available
  const isDemo = !profile;

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

  const activeProfile = profile ?? demoProfile;

  const displayName = activeProfile.displayName || user?.displayName || "User";
  const tier = activeProfile.accountTier || "basic";
  const interests = activeProfile.interests || [];
  const desc = activeProfile.descriptions?.[0];

  const demoStats = { contacts: 10, groups: 3 };
  const demoRuleOf7 = { messages: 5, contacts: 7, interests: 7 };

  const locationEntries = activeProfile.location
    ? [
        { level: "Global", value: activeProfile.location.globalArea },
        { level: "Country", value: activeProfile.location.countryPhoneCode },
        { level: "Region", value: activeProfile.location.region },
        { level: "City", value: activeProfile.location.cityZip },
        { level: "Local", value: activeProfile.location.localDescription },
      ].filter((l) => l.value)
    : [];

  return (
    <div className="flex flex-col h-full pb-20 overflow-y-auto">
      {/* Header with gradient mesh */}
      <div className="relative pt-12 pb-8 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" />
        <div className="absolute top-0 left-1/4 w-40 h-40 rounded-full bg-purple-200/30 blur-[60px]" />
        <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full bg-indigo-200/30 blur-[60px]" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
            <motion.button whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/80 shadow-sm flex items-center justify-center">
              <Settings size={18} className="text-slate-500" />
            </motion.button>
          </div>

          <div className="flex flex-col items-center">
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
              <Avatar name={displayName} size="xl" online showStatus />
            )}
            <h2 className="text-xl font-bold text-slate-900 mt-3">{displayName}</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <Crown size={12} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-400 capitalize">{tier} Plan</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 -mt-2">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: "Contacts", value: isDemo ? String(demoStats.contacts) : "—" },
            { icon: MessageSquare, label: "Groups", value: isDemo ? String(demoStats.groups) : "—" },
            { icon: Crown, label: "Plan", value: tier },
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
        {locationEntries.length > 0 && (
          <GlassCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-purple-400" />
                  <span className="text-sm font-semibold text-slate-900">Location</span>
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
        )}

        {/* Interests */}
        <GlassCard>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-slate-900">Interests</span>
              <span className="text-[10px] text-slate-400 ml-auto">{interests.length}/7 slots</span>
            </div>
            {interests.length > 0 ? (
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
        {desc && (
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
        )}

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
                label="Messages"
                color="gradMsg"
              />
              <CircularProgress
                value={isDemo ? demoRuleOf7.contacts : 0}
                max={7}
                label="Contacts"
                color="gradCon"
              />
              <CircularProgress
                value={isDemo ? demoRuleOf7.interests : interests.length}
                max={7}
                label="Interests"
                color="gradInt"
              />
            </div>
          </div>
        </GlassCard>

        {/* Upgrade CTA */}
        <GlassCard>
          <div className="p-5 text-center">
            <Crown size={28} className="text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900 mb-1">Unlock Premium</p>
            <p className="text-xs text-slate-500 mb-4">Get unlimited messages, more contacts, and AI features</p>
            <GradientButton className="mx-auto">Upgrade Plan</GradientButton>
          </div>
        </GlassCard>

        {/* Edit profile */}
        <GradientButton variant="outline" className="w-full mb-4">
          <Edit3 size={16} /> Edit Profile
        </GradientButton>
      </div>
    </div>
  );
}
