"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, MapPin, Briefcase, GraduationCap, Users } from "lucide-react";
import Avatar from "../ui/Avatar";
import GlassCard from "../ui/GlassCard";
import GradientButton from "../ui/GradientButton";
import AppBrand from "./AppBrand";
import { useAuth } from "@/lib/auth-context";
import { MOCK_PROFILES } from "@/lib/mock-data";

interface SearchResult {
  id: string;
  displayName: string;
  profileType: string;
  location: { globalArea: string | null; region: string | null; cityZip: string | null } | null;
  interests: string[];
  relevanceScore: number;
}

const filters = [
  { id: "near", label: "Near Me", icon: MapPin },
  { id: "interests", label: "Same Interests", icon: Users },
  { id: "business", label: "Business", icon: Briefcase },
  { id: "education", label: "Education", icon: GraduationCap },
] as const;

export default function SearchScreen() {
  const { authFetch } = useAuth();
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [aiMode, setAiMode] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const suggestedConnections = useMemo(() => {
    return Object.values(MOCK_PROFILES).map((p) => ({
      id: p.id,
      displayName: p.displayName,
      bio: p.bio,
      interests: p.interests,
      location: p.location,
      avatarUrl: p.avatarUrl,
      online: p.online,
      relevanceScore: Math.round(70 + Math.random() * 25),
    }));
  }, []);

  const toggleFilter = (id: string) => {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await authFetch("/api/search/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          filters: {
            nearMe: activeFilters.includes("near"),
            sameInterests: activeFilters.includes("interests"),
            category: activeFilters.includes("business") ? "business" : activeFilters.includes("education") ? "education" : undefined,
          },
          aiMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.data?.results ?? []);
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  };

  const formatLocation = (loc: { globalArea: string | null; region: string | null; cityZip: string | null } | null) => {
    if (!loc) return null;
    return [loc.globalArea, loc.region, loc.cityZip].filter(Boolean).join(", ");
  };

  return (
    <div className="flex flex-col h-full pb-20">
      <div className="px-4 pt-10 pb-4">
        <AppBrand className="mb-2" />
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Discover</h1>

        {/* Search input */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="Search for people, interests..."
            className="w-full bg-slate-100 border border-slate-200 rounded-2xl pl-11 pr-12 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/40 transition-colors"
          />
          <button onClick={handleSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
            <Sparkles size={18} className="text-purple-400" />
          </button>
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
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length === 0 && searched ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Search size={32} className="text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">No users found</p>
            <p className="text-slate-300 text-xs mt-1">Try a different search term</p>
          </div>
        ) : results.length === 0 && !searched ? (
          <>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Suggested Connections
            </h2>
            {suggestedConnections.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <GlassCard hover>
                  <div className="p-4 flex items-center gap-4">
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="w-12 h-12 rounded-full object-cover bg-slate-100"
                      />
                      {user.online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
                        <span className="text-[10px] font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
                          {user.relevanceScore}% match
                        </span>
                      </div>
                      {user.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="text-slate-400" />
                          <p className="text-[11px] text-slate-500">{formatLocation(user.location)}</p>
                        </div>
                      )}
                      {user.bio && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate">{user.bio}</p>
                      )}
                      {user.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {user.interests.slice(0, 4).map((interest) => (
                            <span
                              key={interest}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-purple-600 border border-purple-500/20"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <GradientButton size="sm">Connect</GradientButton>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </>
        ) : (
          results.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <GlassCard hover>
                <div className="p-4 flex items-center gap-4">
                  <Avatar name={user.displayName} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
                    {user.location && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-slate-400" />
                        <p className="text-[11px] text-slate-500">{formatLocation(user.location)}</p>
                      </div>
                    )}
                    {user.interests.length > 0 && (
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
                    )}
                  </div>
                  <GradientButton size="sm">Connect</GradientButton>
                </div>
              </GlassCard>
            </motion.div>
          ))
        )}

        {/* Upgrade banner */}
        {results.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
