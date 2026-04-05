"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Eye, EyeOff, Edit3, Crown, MapPin, Sparkles, Users, MessageSquare } from "lucide-react";
import Avatar from "../ui/Avatar";
import GlassCard from "../ui/GlassCard";
import GradientButton from "../ui/GradientButton";

const mockProfile = {
  name: "Alex Morgan",
  type: "Basic",
  contacts: 7,
  groups: 3,
  plan: "Basic",
  location: [
    { level: "Global", value: "North America" },
    { level: "Country", value: "United States (+1)" },
    { level: "Region", value: "California" },
    { level: "City", value: "San Francisco" },
    { level: "Local", value: "SoMa District" },
  ],
  interests: ["Photography", "AI Technology", "Travel", "Music Production", "Fitness", "Cooking", "Reading"],
  description: {
    category: "Business",
    level: "Senior",
    institution: "TechVentures Inc.",
    detail: "Product Design Lead",
  },
  limits: {
    messages: { used: 4, max: 7 },
    contacts: { used: 7, max: 7 },
    interests: { used: 7, max: 7 },
  },
};

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
  const [locationVisible, setLocationVisible] = useState(true);

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
            <Avatar name={mockProfile.name} size="xl" online showStatus />
            <h2 className="text-xl font-bold text-slate-900 mt-3">{mockProfile.name}</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <Crown size={12} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-400">{mockProfile.type} Plan</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 -mt-2">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: "Contacts", value: `${mockProfile.contacts}` },
            { icon: MessageSquare, label: "Groups", value: `${mockProfile.groups}` },
            { icon: Crown, label: "Plan", value: mockProfile.plan },
          ].map((stat, i) => (
            <GlassCard key={i}>
              <div className="p-3 text-center">
                <stat.icon size={16} className="text-purple-400 mx-auto mb-1" />
                <p className="text-base font-bold text-slate-900">{stat.value}</p>
                <p className="text-[10px] text-slate-500">{stat.label}</p>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Location */}
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
              {mockProfile.location.map((loc, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 w-12 shrink-0">{loc.level}</span>
                  <div className="w-1 h-1 rounded-full bg-purple-500/40" />
                  <span className="text-xs text-slate-500">{loc.value}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Interests */}
        <GlassCard>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-slate-900">Interests</span>
              <span className="text-[10px] text-slate-400 ml-auto">{mockProfile.interests.length}/7 slots</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {mockProfile.interests.map((interest) => (
                <span
                  key={interest}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 text-purple-600 border border-purple-500/20"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Description */}
        <GlassCard>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Edit3 size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-slate-900">About</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Category", value: mockProfile.description.category },
                { label: "Level", value: mockProfile.description.level },
                { label: "Institution", value: mockProfile.description.institution },
                { label: "Role", value: mockProfile.description.detail },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 w-16 shrink-0">{item.label}</span>
                  <span className="text-xs text-slate-500">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Rule of 7 Status */}
        <GlassCard gradient>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Crown size={14} className="text-amber-400" />
              <span className="text-sm font-semibold text-slate-900">Rule of 7 Status</span>
            </div>
            <div className="flex justify-around">
              <CircularProgress
                value={mockProfile.limits.messages.used}
                max={mockProfile.limits.messages.max}
                label="Messages"
                color="gradMsg"
              />
              <CircularProgress
                value={mockProfile.limits.contacts.used}
                max={mockProfile.limits.contacts.max}
                label="Contacts"
                color="gradCon"
              />
              <CircularProgress
                value={mockProfile.limits.interests.used}
                max={mockProfile.limits.interests.max}
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
