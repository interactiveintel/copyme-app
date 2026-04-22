"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, RefreshCw, UserPlus } from "lucide-react";
import Avatar from "../ui/Avatar";
import AgentThinking from "../ui/AgentThinking";
import { useAuth } from "@/lib/auth-context";

interface SmartMatchPanelProps {
  onConnect: (userId: string) => void;
  onClose: () => void;
}

interface MatchData {
  id: string;
  name: string;
  score: number;
  interests: string[];
  icebreaker: string;
}

interface ApiSuggestion {
  id: string;
  displayName: string;
  matchScore: number;
  sharedInterests: string[];
  interests: Array<{ slotNumber: number; interestText: string }>;
}

function buildIcebreaker(name: string, shared: string[], allInterests: string[]): string {
  const first = name.split(/\s+/)[0] ?? name;
  if (shared.length >= 2) {
    return `Hey ${first}! Looks like we're both into ${shared[0]} and ${shared[1]}. What got you started?`;
  }
  if (shared.length === 1) {
    return `Hey ${first}! I noticed we both like ${shared[0]}. How did you get into it?`;
  }
  if (allInterests.length > 0) {
    return `Hey ${first}! Saw your interest in ${allInterests[0]} — would love to hear more about that.`;
  }
  return `Hey ${first}! Just spotted your profile — keen to swap notes on what you're into.`;
}

const mockMatches: MatchData[] = [
  {
    id: "sm1",
    name: "Sofia Chen",
    score: 92,
    interests: ["Photography", "AI", "Travel"],
    icebreaker:
      "I noticed you're into AI photography too! Have you tried any computational photography apps?",
  },
  {
    id: "sm2",
    name: "Marcus Johnson",
    score: 87,
    interests: ["Startups", "Fintech", "Basketball"],
    icebreaker:
      "Fellow fintech enthusiast! What's your take on embedded payments in social apps?",
  },
  {
    id: "sm3",
    name: "Yuki Tanaka",
    score: 85,
    interests: ["Design", "Music", "Cooking"],
    icebreaker:
      "Your design interests caught my eye — are you into UI/UX or more traditional design?",
  },
  {
    id: "sm4",
    name: "Amara Okafor",
    score: 81,
    interests: ["Writing", "Education", "Travel"],
    icebreaker:
      "I see we share a love for educational content creation. What topics do you focus on?",
  },
  {
    id: "sm5",
    name: "Raj Patel",
    score: 78,
    interests: ["Engineering", "Chess", "Hiking"],
    icebreaker:
      "Chess and hiking — the perfect combo of mental and physical challenge! What's your rating?",
  },
];

function CircularScore({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="3"
        />
        <motion.circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-slate-900">{score}%</span>
      </div>
    </div>
  );
}

export default function SmartMatchPanel({
  onConnect,
  onClose,
}: SmartMatchPanelProps) {
  const { user, authFetch } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [matches, setMatches] = useState<MatchData[]>(mockMatches);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    // Demo mode (no auth) → keep the rich mock data so the public preview stays warm.
    if (!user) {
      setMatches(mockMatches);
      // Brief artificial delay so the AgentThinking animation doesn't flash by.
      await new Promise((resolve) => setTimeout(resolve, 700));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/users/suggested?limit=12");
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "Couldn't load matches.");
        setMatches([]);
        return;
      }
      const suggestions = (data.data?.suggestions ?? []) as ApiSuggestion[];
      const transformed: MatchData[] = suggestions.map((s) => {
        const allInterestTexts = s.interests.map((i) => i.interestText);
        return {
          id: s.id,
          name: s.displayName,
          // Render score as a percent. Cap at 99% (no one is "100% match").
          score: Math.min(99, 50 + s.matchScore * 12),
          interests: allInterestTexts.slice(0, 4),
          icebreaker: buildIcebreaker(s.displayName, s.sharedInterests, allInterestTexts),
        };
      });
      setMatches(transformed);
    } catch {
      setError("Network error.");
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-md h-[85vh] bg-white/95 backdrop-blur-xl rounded-t-3xl border-t border-x border-slate-200 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Sparkles size={16} className="text-purple-400" />
              </div>
              <h2 className="text-lg font-bold">
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  AI Smart Match
                </span>
              </h2>
            </div>
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
            >
              <X size={16} className="text-slate-500" />
            </motion.button>
          </div>
          <p className="text-xs text-slate-500 ml-10">
            People you&apos;d love to connect with
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 gap-4"
              >
                <AgentThinking
                  agentName="Smart Match"
                  message="Finding your best connections..."
                  visible
                />
                <div className="flex gap-2 mt-4">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-10 h-10 rounded-full bg-slate-100"
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.3,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            ) : matches.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 px-8 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <Sparkles size={20} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  {error || "No matches yet"}
                </p>
                <p className="text-xs text-slate-500">
                  {error
                    ? "Try refreshing in a moment."
                    : "Add a few interests on your profile and we'll find people with shared interests."}
                </p>
                <button
                  onClick={() => void load()}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700"
                >
                  <RefreshCw size={12} /> Try again
                </button>
              </motion.div>
            ) : (
              <motion.div key="results" className="space-y-3">
                {matches.map((match, i) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.1,
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                    className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4"
                  >
                    {/* Top row: avatar + name + score */}
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar name={match.name} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {match.name}
                        </p>
                        {/* Interest tags */}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {match.interests.map((interest) => (
                            <span
                              key={interest}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-purple-600 border border-purple-500/20"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                      <CircularScore score={match.score} />
                    </div>

                    {/* AI icebreaker */}
                    <div className="mb-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-start gap-2">
                        <Sparkles
                          size={12}
                          className="text-purple-400 mt-0.5 shrink-0"
                        />
                        <p className="text-xs text-slate-500 italic leading-relaxed">
                          &ldquo;{match.icebreaker}&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => onConnect(match.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-semibold"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <UserPlus size={14} />
                        Connect
                      </motion.button>
                      <motion.button
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-50 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <RefreshCw size={12} />
                        New Icebreaker
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
