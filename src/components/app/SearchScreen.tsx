"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, MapPin, Briefcase, GraduationCap, Users } from "lucide-react";
import Avatar from "../ui/Avatar";
import GlassCard from "../ui/GlassCard";
import GradientButton from "../ui/GradientButton";

const filters = [
  { id: "near", label: "Near Me", icon: MapPin },
  { id: "interests", label: "Same Interests", icon: Users },
  { id: "business", label: "Business", icon: Briefcase },
  { id: "education", label: "Education", icon: GraduationCap },
] as const;

const mockResults = [
  {
    id: "1",
    name: "Lena Dubois",
    location: "North America, US",
    interests: ["Photography", "AI Tech", "Travel"],
    online: true,
  },
  {
    id: "2",
    name: "Emeka Nwankwo",
    location: "West Africa, NG",
    interests: ["Fintech", "Music", "Cooking"],
    online: true,
  },
  {
    id: "3",
    name: "Mei Ling",
    location: "East Asia, CN",
    interests: ["AI Tech", "Reading", "Fitness"],
    online: false,
  },
  {
    id: "4",
    name: "Carlos Rivera",
    location: "South America, BR",
    interests: ["Travel", "Photography", "Music"],
    online: true,
  },
  {
    id: "5",
    name: "Aisha Khan",
    location: "South Asia, IN",
    interests: ["Education", "Reading", "Cooking"],
    online: false,
  },
  {
    id: "6",
    name: "Noah Schmidt",
    location: "Europe, DE",
    interests: ["Business", "Fitness", "AI Tech"],
    online: true,
  },
  {
    id: "7",
    name: "Sakura Ito",
    location: "East Asia, JP",
    interests: ["Photography", "Music", "Travel"],
    online: true,
  },
];

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [aiMode, setAiMode] = useState(false);

  const toggleFilter = (id: string) => {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col h-full pb-20">
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Discover</h1>

        {/* Search input */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for people, interests..."
            className="w-full bg-slate-100 border border-slate-200 rounded-2xl pl-11 pr-12 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/40 transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Sparkles size={18} className="text-purple-400" />
          </div>
        </div>

        {/* AI Mode toggle */}
        <div className="flex items-center justify-between mt-4 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <span className="text-sm text-slate-500">AI Mode</span>
          </div>
          <button
            onClick={() => setAiMode(!aiMode)}
            className={`w-12 h-6 rounded-full relative transition-all ${
              aiMode
                ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                : "bg-slate-200"
            }`}
          >
            <motion.div
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
              animate={{ left: aiMode ? 28 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filters.map((f) => {
            const active = activeFilters.includes(f.id);
            const Icon = f.icon;
            return (
              <motion.button
                key={f.id}
                onClick={() => toggleFilter(f.id)}
                whileTap={{ scale: 0.95 }}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 border-transparent text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:text-slate-800"
                }`}
              >
                <Icon size={13} />
                {f.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3">
        {mockResults.map((user, i) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <GlassCard hover>
              <div className="p-4 flex items-center gap-4">
                <Avatar name={user.name} size="lg" online={user.online} showStatus />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-slate-400" />
                    <p className="text-[11px] text-slate-500">{user.location}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {user.interests.map((interest) => (
                      <span
                        key={interest}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-purple-600 border border-purple-500/20"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
                <GradientButton size="sm">Connect</GradientButton>
              </div>
            </GlassCard>
          </motion.div>
        ))}

        {/* Upgrade banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4"
        >
          <GlassCard gradient>
            <div className="p-5 text-center">
              <Sparkles size={24} className="text-purple-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900 mb-1">See More People</p>
              <p className="text-xs text-slate-500 mb-3">
                Upgrade to Premium for unlimited results and AI-powered matching
              </p>
              <GradientButton size="sm" className="mx-auto">
                Upgrade Now
              </GradientButton>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
