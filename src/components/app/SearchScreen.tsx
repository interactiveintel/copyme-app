"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  SearchX,
  Sparkles,
  MapPin,
  Briefcase,
  GraduationCap,
  Users,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import GlassCard from "../ui/GlassCard";
import GradientButton from "../ui/GradientButton";
import AppBrand from "./AppBrand";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/i18n/client";
import { MOCK_PROFILES } from "@/lib/mock-data";

interface SearchLocation {
  globalArea: string | null;
  region: string | null;
  cityZip: string | null;
}

interface SearchResult {
  id: string;
  displayName: string;
  profileType: string;
  location: SearchLocation | null;
  interests: string[];
  relevanceScore: number;
}

interface SearchScreenProps {
  onContact?: (userId: string) => void;
}

const filters = [
  { id: "near", labelKey: "search.filter.nearMe", icon: MapPin },
  { id: "interests", labelKey: "search.filter.sameInterests", icon: Users },
  { id: "business", labelKey: "search.filter.business", icon: Briefcase },
  { id: "education", labelKey: "search.filter.education", icon: GraduationCap },
] as const;

// Score breakdown from /api/search/users:
//   displayName match → +10
//   interest match    → +5
//   location match    → +3
// Cap at 18 (10 + 5 + 3) so a perfect match reads as 100% MATCH.
const MAX_SCORE = 18;

function scoreToPercent(score: number): number {
  return Math.min(100, Math.round((score / MAX_SCORE) * 100));
}

function profileTypeLabel(type: string): string {
  switch (type) {
    case "personal":
      return "Personal";
    case "social":
      return "Social";
    case "legal_entity":
      return "Business";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function formatLocation(loc: SearchLocation | null): string | null {
  if (!loc) return null;
  const parts = [loc.globalArea, loc.region, loc.cityZip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function computeMatchedFields(
  query: string,
  user: Pick<SearchResult, "displayName" | "interests" | "location">,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matched: string[] = [];

  if (user.displayName.toLowerCase().includes(q)) {
    matched.push("name");
  }

  const interestMatches = user.interests.filter((i) =>
    i.toLowerCase().includes(q),
  ).length;
  if (interestMatches === 1) matched.push("1 interest");
  else if (interestMatches > 1) matched.push(`${interestMatches} interests`);

  if (user.location) {
    const locationFields = [
      user.location.globalArea,
      user.location.region,
      user.location.cityZip,
    ];
    if (locationFields.some((f) => f?.toLowerCase().includes(q))) {
      matched.push("location");
    }
  }

  return matched;
}

// ---------------------------------------------------------------------------
// MatchBadge — gradient pill mirroring the Hero PhonePreview "92% MATCH"
// ---------------------------------------------------------------------------
function MatchBadge({ percent }: { percent: number }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide text-white shadow-sm bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 tabular-nums"
      aria-label={`${percent} percent match`}
    >
      {percent}% MATCH
    </span>
  );
}

// ---------------------------------------------------------------------------
// SearchResultCard — polished result row with match badge + why-this-match
// ---------------------------------------------------------------------------
interface SearchResultCardProps {
  user: SearchResult;
  query: string;
  index: number;
  onContact?: (userId: string) => void;
}

function SearchResultCard({
  user,
  query,
  index,
  onContact,
}: SearchResultCardProps) {
  const { t } = useLocale();
  const [whyOpen, setWhyOpen] = useState(false);
  const percent = scoreToPercent(user.relevanceScore);
  const locationText = formatLocation(user.location);
  const matched = useMemo(
    () => computeMatchedFields(query, user),
    [query, user],
  );
  const visibleInterests = user.interests.slice(0, 3);
  const remainingInterests = user.interests.length - visibleInterests.length;
  const avatarSeed = encodeURIComponent(user.displayName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <GlassCard hover>
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar from /api/avatars/[seed] (S-105) */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/avatars/${avatarSeed}`}
                  alt={user.displayName}
                  className="w-full h-full rounded-full object-cover bg-white"
                />
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user.displayName}
                </p>
                <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  {profileTypeLabel(user.profileType)}
                </span>
              </div>

              {locationText && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={11} className="text-slate-400 shrink-0" />
                  <p className="text-[11px] text-slate-500 truncate">
                    {locationText}
                  </p>
                </div>
              )}

              {visibleInterests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {visibleInterests.map((interest) => (
                    <span
                      key={interest}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-purple-600 border border-purple-500/20"
                    >
                      {interest}
                    </span>
                  ))}
                  {remainingInterests > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200">
                      +{remainingInterests}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right column: badge + chevron */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <MatchBadge percent={percent} />
              {matched.length > 0 && (
                <motion.button
                  type="button"
                  onClick={() => setWhyOpen((v) => !v)}
                  whileTap={{ scale: 0.9 }}
                  aria-expanded={whyOpen}
                  aria-label={t("search.action.whyMatch")}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center"
                >
                  <motion.span
                    animate={{ rotate: whyOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-flex"
                  >
                    <ChevronDown size={14} className="text-slate-500" />
                  </motion.span>
                </motion.button>
              )}
            </div>
          </div>

          {/* Action row */}
          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => onContact?.(user.id)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 transition-colors"
            >
              {t("search.action.sendFirst")}
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Why this match? */}
          <AnimatePresence initial={false}>
            {whyOpen && matched.length > 0 && (
              <motion.div
                key="why"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
                  <Sparkles
                    size={11}
                    className="text-purple-400 mt-0.5 shrink-0"
                  />
                  <p className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">
                      Matched on:
                    </span>{" "}
                    {matched.join(", ")}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SearchScreen
// ---------------------------------------------------------------------------
export default function SearchScreen({ onContact }: SearchScreenProps = {}) {
  const { authFetch } = useAuth();
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [aiMode, setAiMode] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

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
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setLastQuery(q);
    try {
      const res = await authFetch("/api/search/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          filters: {
            nearMe: activeFilters.includes("near"),
            sameInterests: activeFilters.includes("interests"),
            category: activeFilters.includes("business")
              ? "business"
              : activeFilters.includes("education")
                ? "education"
                : undefined,
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

  return (
    <div className="flex flex-col h-full pb-20">
      <div className="px-4 pt-10 pb-4">
        <AppBrand className="mb-2" />
        <h1 className="text-2xl font-bold text-slate-900 mb-4">{t("search.header.title")}</h1>

        {/* Search input */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder={t("search.placeholder")}
            className="w-full bg-slate-100 border border-slate-200 rounded-2xl pl-11 pr-12 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/40 transition-colors"
          />
          <button
            onClick={handleSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-label="Run AI search"
          >
            <Sparkles size={18} className="text-purple-400" />
          </button>
        </div>

        {/* AI Mode toggle */}
        <div className="flex items-center justify-between mt-4 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <span className="text-sm text-slate-500">{t("search.aiMode")}</span>
          </div>
          <button
            onClick={() => setAiMode(!aiMode)}
            className={`w-12 h-6 rounded-full relative transition-all ${
              aiMode
                ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                : "bg-slate-200"
            }`}
            aria-pressed={aiMode}
            aria-label="Toggle AI mode"
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
                {t(f.labelKey)}
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 text-center px-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-purple-500/20 flex items-center justify-center mb-3">
              <SearchX size={26} className="text-purple-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              No results yet
            </p>
            <p className="text-xs text-slate-500 max-w-[260px]">
              Try broader interest tags — or toggle AI Mode for fuzzier
              matching.
            </p>
          </motion.div>
        ) : results.length === 0 && !searched ? (
          <>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              {t("search.section.suggested")}
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
                        <p className="text-sm font-semibold text-slate-900">
                          {user.displayName}
                        </p>
                        <span className="text-[10px] font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
                          {user.relevanceScore}% match
                        </span>
                      </div>
                      {user.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="text-slate-400" />
                          <p className="text-[11px] text-slate-500">
                            {formatLocation(user.location)}
                          </p>
                        </div>
                      )}
                      {user.bio && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate">
                          {user.bio}
                        </p>
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
            <SearchResultCard
              key={user.id}
              user={user}
              query={lastQuery}
              index={i}
              onContact={onContact}
            />
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
                <Sparkles
                  size={24}
                  className="text-purple-400 mx-auto mb-2"
                />
                <p className="text-sm font-semibold text-slate-900 mb-1">
                  See More People
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Upgrade to Premium for unlimited results and AI-powered
                  matching
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
