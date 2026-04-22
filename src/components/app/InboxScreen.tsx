"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Sparkles,
  X,
  ExternalLink,
  GraduationCap,
  Plane,
  Smartphone,
  Dumbbell,
  ChefHat,
  Briefcase,
  Music,
  Star,
  Zap,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import SmartMatchPanel from "./SmartMatchPanel";
import HomeNudges from "./HomeNudges";
import { useAuth } from "@/lib/auth-context";
import { usePolling } from "@/lib/use-polling";
import { MOCK_CONVERSATIONS, MOCK_PROFILES } from "@/lib/mock-data";

interface InboxScreenProps {
  onOpenChat: (chatId: string, contactName?: string) => void;
}

interface Conversation {
  contactId: string;
  contactName: string;
  lastMessage: {
    id: string;
    type: string;
    content: string | null;
    createdAt: string;
    direction: "sent" | "received";
  };
}

// Dynamic AI-curated ad categories — CopyMe Agent refreshes daily
interface AdItem {
  id: string;
  title: string;
  brand: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  emoji: string;
  tagline: string;
  description: string;
  highlights: string[];
  stats: { rating: number; users: string; label: string };
  cta: string;
  url: string;
  category: string;
  aiReason: string; // Why CopyMe Agent recommends this
  trending: boolean;
  expiresLabel: string; // "Refreshes in 6h", "Updated 2h ago"
  relatedAds?: string[]; // IDs of related ads
}

const AD_CATEGORIES = [
  { id: "for-you", label: "For You", emoji: "✨" },
  { id: "trending", label: "Trending", emoji: "🔥" },
  { id: "learning", label: "Learning", emoji: "📚" },
  { id: "lifestyle", label: "Lifestyle", emoji: "🌿" },
  { id: "career", label: "Career", emoji: "🚀" },
  { id: "entertainment", label: "Fun", emoji: "🎭" },
];

const allAds: AdItem[] = [
  {
    id: "ad1",
    title: "Learn AI Today",
    brand: "NeuroLearn Academy",
    color: "from-indigo-500 to-blue-500",
    icon: GraduationCap,
    emoji: "🧠",
    tagline: "Your AI journey starts here",
    description: "Master the fundamentals of AI and machine learning with hands-on courses designed for all levels. Join 50K+ learners building the future.",
    highlights: ["12-week certification program", "Hands-on projects with real data", "1-on-1 mentorship included"],
    stats: { rating: 4.9, users: "52K", label: "students" },
    cta: "Start Learning",
    url: "https://www.coursera.org",
    category: "learning",
    aiReason: "Based on your interest in technology and AI conversations",
    trending: true,
    expiresLabel: "Updated 2h ago",
    relatedAds: ["ad3", "ad6"],
  },
  {
    id: "ad2",
    title: "Travel Deals",
    brand: "Wanderly",
    color: "from-emerald-500 to-teal-500",
    icon: Plane,
    emoji: "✈️",
    tagline: "Adventure awaits — up to 60% off",
    description: "Exclusive flight and hotel deals curated for the modern traveler. Book your dream vacation with flexible cancellation and price-match guarantee.",
    highlights: ["Flights from $49 one-way", "Free cancellation up to 24hrs", "Members-only flash sales"],
    stats: { rating: 4.7, users: "1.2M", label: "trips booked" },
    cta: "Browse Deals",
    url: "https://www.kayak.com",
    category: "lifestyle",
    aiReason: "3 of your contacts recently shared travel plans",
    trending: false,
    expiresLabel: "Refreshes in 4h",
  },
  {
    id: "ad3",
    title: "New Gadgets",
    brand: "TechVault",
    color: "from-purple-500 to-pink-500",
    icon: Smartphone,
    emoji: "📱",
    tagline: "The latest tech, delivered",
    description: "Discover the latest tech gadgets and accessories trending right now. From smart wearables to home automation — we've got it all.",
    highlights: ["Free 2-day shipping", "30-day easy returns", "Exclusive early access drops"],
    stats: { rating: 4.8, users: "890K", label: "happy customers" },
    cta: "Shop Now",
    url: "https://www.amazon.com",
    category: "trending",
    aiReason: "Trending among tech-savvy users in your network",
    trending: true,
    expiresLabel: "Updated 1h ago",
    relatedAds: ["ad1"],
  },
  {
    id: "ad4",
    title: "Fitness App",
    brand: "FitPulse",
    color: "from-amber-500 to-orange-500",
    icon: Dumbbell,
    emoji: "💪",
    tagline: "Get fit, your way",
    description: "Personalized workout plans and nutrition tracking powered by AI. Whether you're a beginner or athlete, FitPulse adapts to your goals.",
    highlights: ["AI-personalized daily plans", "500+ guided video workouts", "Meal planner with macros"],
    stats: { rating: 4.8, users: "3.1M", label: "active users" },
    cta: "Try 7 Days Free",
    url: "https://www.myfitnesspal.com",
    category: "lifestyle",
    aiReason: "Matches your health & wellness interests",
    trending: true,
    expiresLabel: "Refreshes in 6h",
    relatedAds: ["ad5"],
  },
  {
    id: "ad5",
    title: "Cook Like Pro",
    brand: "ChefCraft",
    color: "from-rose-500 to-red-500",
    icon: ChefHat,
    emoji: "👨‍🍳",
    tagline: "Elevate every meal",
    description: "Step-by-step recipes from world-class chefs, tailored to your skill level and dietary preferences. Cook with confidence tonight.",
    highlights: ["10,000+ tested recipes", "Video tutorials for each step", "Smart grocery lists"],
    stats: { rating: 4.9, users: "720K", label: "home chefs" },
    cta: "Explore Recipes",
    url: "https://www.allrecipes.com",
    category: "lifestyle",
    aiReason: "Popular with cooking enthusiasts in your area",
    trending: false,
    expiresLabel: "Updated 5h ago",
  },
  {
    id: "ad6",
    title: "Job Openings",
    brand: "HireUp",
    color: "from-cyan-500 to-blue-500",
    icon: Briefcase,
    emoji: "💼",
    tagline: "Your next role is waiting",
    description: "Top companies are hiring now. Find your next role in tech, design, marketing, and more. AI-matched to your skills and preferences.",
    highlights: ["AI-powered job matching", "Salary transparency on all posts", "One-click easy apply"],
    stats: { rating: 4.6, users: "2.5M", label: "jobs posted" },
    cta: "View Jobs",
    url: "https://www.linkedin.com/jobs",
    category: "career",
    aiReason: "Your profile matches 12 new openings today",
    trending: true,
    expiresLabel: "Updated 30m ago",
    relatedAds: ["ad1"],
  },
  {
    id: "ad7",
    title: "Music Events",
    brand: "LiveBeat",
    color: "from-violet-500 to-purple-500",
    icon: Music,
    emoji: "🎵",
    tagline: "Feel the music, live",
    description: "Live concerts, festivals, and DJ sets near you. Get early access to tickets and exclusive VIP experiences. Don't miss out.",
    highlights: ["Early access presale tickets", "VIP meet & greet packages", "Cashback on first order"],
    stats: { rating: 4.7, users: "1.8M", label: "fans" },
    cta: "Get Tickets",
    url: "https://www.ticketmaster.com",
    category: "entertainment",
    aiReason: "Based on music interests shared in your chats",
    trending: false,
    expiresLabel: "Refreshes in 8h",
  },
];


function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function InboxScreen({ onOpenChat }: InboxScreenProps) {
  const { user, authFetch } = useAuth();
  const [search, setSearch] = useState("");
  const [showSmartMatch, setShowSmartMatch] = useState(false);
  const [selectedAd, setSelectedAd] = useState<AdItem | null>(null);
  const [adCategory, setAdCategory] = useState("for-you");
  const [showAdMarketplace, setShowAdMarketplace] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInbox = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch("/api/messages/inbox");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.data ?? []);
      }
    } catch {
      // network error — degrade gracefully
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  // Initial load
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchInbox();
  }, [user, fetchInbox]);

  // Poll every 10 seconds
  usePolling(fetchInbox, 10_000, !!user);

  // Send presence heartbeat every 30 seconds
  usePolling(
    useCallback(() => { authFetch("/api/presence", { method: "POST" }).catch(() => {}); }, [authFetch]),
    30_000,
    !!user,
  );

  // Use real conversations if available, otherwise show mock data
  const displayConversations = conversations.length > 0 ? conversations : MOCK_CONVERSATIONS;

  const filtered = displayConversations.filter((c) =>
    c.contactName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full pb-20">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Messages</h1>

        {/* Search bar */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-slate-100 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/40 transition-colors"
          />
        </div>
      </div>

      {/* Streak + push-enable CTA */}
      <HomeNudges />

      {/* AD Inbox — AI-Curated Daily */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-500">AD Inbox</h2>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-[9px] font-semibold text-purple-600">
              <Sparkles size={9} />
              AI Curated
            </span>
          </div>
          <button
            onClick={() => setShowAdMarketplace(true)}
            className="text-xs text-purple-400 font-medium"
          >
            Explore All
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          {allAds.map((ad, i) => {
            const isNew = ad.trending;
            const hasActivity = i < 5;
            return (
            <motion.button
              key={ad.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0 relative"
              onClick={() => setSelectedAd(ad)}
            >
              {/* Activity pulse ring */}
              {hasActivity && (
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-60 animate-pulse z-0" />
              )}
              <div className="relative w-20 h-24 rounded-2xl overflow-hidden p-[1px] bg-gradient-to-br from-indigo-500/60 via-purple-500/60 to-pink-500/60 z-10">
                <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${ad.color} flex flex-col items-center justify-center p-2 gap-1 relative overflow-hidden`}>
                  {/* Shimmer sweep */}
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <span className="text-xl leading-none">{ad.emoji}</span>
                  <ad.icon size={16} className="text-white/90" />
                  <p className="text-[8px] text-white/90 font-semibold leading-tight text-center">{ad.title}</p>
                </div>
              </div>
              {/* Trending badge */}
              {isNew && (
                <span className="absolute -top-1.5 -right-1.5 z-20 px-1.5 py-0.5 rounded-full bg-rose-500 text-[7px] font-bold text-white shadow-sm shadow-rose-500/40 animate-bounce">
                  NEW
                </span>
              )}
              {/* Activity dot */}
              {!isNew && hasActivity && (
                <span className="absolute -top-0.5 -right-0.5 z-20 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white shadow-sm" />
              )}
            </motion.button>
            );
          })}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Search size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-400 text-sm">No results found</p>
            <p className="text-slate-300 text-xs mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((conv, i) => (
              <motion.button
                key={conv.contactId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onOpenChat(conv.contactId, conv.contactName)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all hover:bg-slate-50 active:bg-slate-100 relative"
              >
                {MOCK_PROFILES[conv.contactId]?.avatarUrl ? (
                  <img
                    src={MOCK_PROFILES[conv.contactId].avatarUrl}
                    alt={conv.contactName}
                    className="w-12 h-12 rounded-full object-cover bg-slate-100"
                  />
                ) : (
                  <Avatar name={conv.contactName} size="lg" />
                )}

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {conv.contactName}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {timeAgo(conv.lastMessage.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs truncate pr-4 text-slate-400">
                      {conv.lastMessage.direction === "sent" ? "You: " : ""}
                      {conv.lastMessage.content || `[${conv.lastMessage.type}]`}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Smart Match FAB */}
      <motion.button
        onClick={() => setShowSmartMatch(true)}
        className="fixed bottom-24 right-20 w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30 z-40"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Sparkles size={20} className="text-white" />
      </motion.button>

      {/* FAB */}
      <motion.button
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25 z-40"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Plus size={24} className="text-white" />
      </motion.button>

      {/* Ad Detail Modal — AI-Enhanced */}
      <AnimatePresence>
        {selectedAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAd(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
            >
              {/* Hero banner */}
              <div className={`relative w-full h-40 bg-gradient-to-br ${selectedAd.color} flex flex-col items-center justify-center shrink-0 overflow-hidden`}>
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full border-[3px] border-white" />
                  <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full border-[3px] border-white" />
                </div>
                <button onClick={() => setSelectedAd(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
                  <X size={16} className="text-white" />
                </button>
                {/* Trending badge */}
                {selectedAd.trending && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                    <Zap size={10} className="text-yellow-300" />
                    <span className="text-[9px] font-bold text-white">TRENDING</span>
                  </div>
                )}
                <span className="text-4xl mb-1">{selectedAd.emoji}</span>
                <selectedAd.icon size={24} className="text-white/90 mb-1" />
                <p className="text-white text-lg font-bold">{selectedAd.title}</p>
                <p className="text-white/70 text-[11px]">{selectedAd.tagline}</p>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* AI recommendation reason */}
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 mb-3">
                  <Sparkles size={14} className="text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-0.5">Why CopyMe Agent picked this</p>
                    <p className="text-xs text-purple-700/80 leading-relaxed">{selectedAd.aiReason}</p>
                  </div>
                </div>

                {/* Visit Website link */}
                <button
                  onClick={() => window.open(selectedAd.url, "_blank")}
                  className="flex items-center gap-1.5 text-xs font-medium text-purple-500 hover:text-purple-700 transition-colors mb-4"
                >
                  <ExternalLink size={12} />
                  Visit Website
                </button>

                {/* Brand + rating row */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedAd.brand}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">Sponsored</span>
                      <span className="text-[10px] text-slate-300">·</span>
                      <span className="text-[10px] text-purple-400">{selectedAd.expiresLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Star size={13} className="text-amber-400 fill-amber-400" />
                      <span className="text-sm font-semibold text-slate-700">{selectedAd.stats.rating}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-700">{selectedAd.stats.users}</p>
                      <p className="text-[10px] text-slate-400">{selectedAd.stats.label}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{selectedAd.description}</p>

                {/* Highlights */}
                <div className="space-y-2.5 mb-5">
                  {selectedAd.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${selectedAd.color} flex items-center justify-center shrink-0`}>
                        <Zap size={10} className="text-white" />
                      </div>
                      <span className="text-[13px] text-slate-700">{h}</span>
                    </div>
                  ))}
                </div>

                {/* Related recommendations */}
                {selectedAd.relatedAds && selectedAd.relatedAds.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">You might also like</p>
                    <div className="flex gap-2">
                      {selectedAd.relatedAds.map((relId) => {
                        const related = allAds.find((a) => a.id === relId);
                        if (!related) return null;
                        return (
                          <button
                            key={relId}
                            onClick={() => setSelectedAd(related)}
                            className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r ${related.color} bg-opacity-10 border border-slate-100 hover:border-purple-200 transition-colors`}
                          >
                            <span className="text-lg">{related.emoji}</span>
                            <div className="text-left">
                              <p className="text-[11px] font-semibold text-white">{related.title}</p>
                              <p className="text-[9px] text-white/70">{related.brand}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA button */}
              <div className="p-5 pt-0 shrink-0">
                <button
                  onClick={() => window.open(selectedAd.url, "_blank")}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r ${selectedAd.color} text-white text-sm font-semibold shadow-lg`}
                >
                  {selectedAd.cta}
                  <ExternalLink size={14} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ad Marketplace — Full Screen */}
      <AnimatePresence>
        {showAdMarketplace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-50 flex flex-col"
          >
            {/* Marketplace header */}
            <div className="px-4 pt-12 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Ad Marketplace</h1>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Sparkles size={10} className="text-purple-400" />
                    Curated daily by CopyMe Agent
                  </p>
                </div>
                <button
                  onClick={() => setShowAdMarketplace(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <X size={18} className="text-slate-500" />
                </button>
              </div>

              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
                {AD_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setAdCategory(cat.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
                      adCategory === cat.id
                        ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm shadow-purple-500/20"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Marketplace grid */}
            <div className="flex-1 overflow-y-auto p-4 pb-20">
              <div className="grid grid-cols-2 gap-3">
                {allAds
                  .filter((ad) => adCategory === "for-you" || ad.category === adCategory || (adCategory === "trending" && ad.trending))
                  .map((ad, i) => (
                    <motion.button
                      key={ad.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => { setSelectedAd(ad); setShowAdMarketplace(false); }}
                      className="relative text-left rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:border-purple-200 transition-all hover:shadow-md"
                    >
                      {/* Card hero */}
                      <div className={`w-full h-24 bg-gradient-to-br ${ad.color} flex flex-col items-center justify-center relative overflow-hidden`}>
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                        {ad.trending && (
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-white/20 text-[8px] font-bold text-white flex items-center gap-0.5">
                            <Zap size={7} />HOT
                          </span>
                        )}
                        <span className="text-2xl mb-0.5">{ad.emoji}</span>
                        <ad.icon size={14} className="text-white/80" />
                      </div>
                      {/* Card body */}
                      <div className="p-3">
                        <p className="text-xs font-bold text-slate-800 mb-0.5">{ad.title}</p>
                        <p className="text-[10px] text-slate-400 mb-1.5">{ad.brand}</p>
                        <div className="flex items-center gap-1">
                          <Star size={9} className="text-amber-400 fill-amber-400" />
                          <span className="text-[10px] font-semibold text-slate-600">{ad.stats.rating}</span>
                          <span className="text-[9px] text-slate-300 ml-1">{ad.stats.users} {ad.stats.label}</span>
                        </div>
                        <p className="text-[9px] text-purple-400 mt-1.5 flex items-center gap-0.5">
                          <Sparkles size={8} />{ad.expiresLabel}
                        </p>
                      </div>
                    </motion.button>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Match Panel */}
      <AnimatePresence>
        {showSmartMatch && (
          <SmartMatchPanel
            onConnect={(userId) => {
              console.log("Connect to:", userId);
              setShowSmartMatch(false);
            }}
            onClose={() => setShowSmartMatch(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
