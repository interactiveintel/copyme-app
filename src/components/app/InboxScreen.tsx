"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, ImageIcon, Sparkles, X, ExternalLink } from "lucide-react";
import Avatar from "../ui/Avatar";
import GlassCard from "../ui/GlassCard";
import SmartMatchPanel from "./SmartMatchPanel";
import { useAuth } from "@/lib/auth-context";
import { usePolling } from "@/lib/use-polling";

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

const mockAds = [
  { id: "ad1", title: "Learn AI Today", color: "from-indigo-500 to-blue-500", description: "Master the fundamentals of AI and machine learning with hands-on courses designed for all levels.", cta: "Start Learning" },
  { id: "ad2", title: "Travel Deals", color: "from-emerald-500 to-teal-500", description: "Exclusive flight and hotel deals up to 60% off. Book your dream vacation today.", cta: "Browse Deals" },
  { id: "ad3", title: "New Gadgets", color: "from-purple-500 to-pink-500", description: "Discover the latest tech gadgets and accessories trending right now.", cta: "Shop Now" },
  { id: "ad4", title: "Fitness App", color: "from-amber-500 to-orange-500", description: "Personalized workout plans and nutrition tracking powered by AI. Get fit your way.", cta: "Try Free" },
  { id: "ad5", title: "Cook Like Pro", color: "from-rose-500 to-red-500", description: "Step-by-step recipes from world-class chefs. Elevate your cooking game.", cta: "Explore Recipes" },
  { id: "ad6", title: "Job Openings", color: "from-cyan-500 to-blue-500", description: "Top companies are hiring. Find your next role in tech, design, and more.", cta: "View Jobs" },
  { id: "ad7", title: "Music Events", color: "from-violet-500 to-purple-500", description: "Live concerts, festivals, and DJ sets near you. Don't miss out.", cta: "Get Tickets" },
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
  const [selectedAd, setSelectedAd] = useState<typeof mockAds[number] | null>(null);
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

  const filtered = conversations.filter((c) =>
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

      {/* AD Inbox */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500">AD Inbox</h2>
          <span className="text-xs text-purple-400">See All</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          {mockAds.map((ad, i) => (
            <motion.button
              key={ad.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0"
              onClick={() => setSelectedAd(ad)}
            >
              <div className="relative w-20 h-24 rounded-2xl overflow-hidden p-[1px] bg-gradient-to-br from-indigo-500/60 via-purple-500/60 to-pink-500/60">
                <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${ad.color} flex items-center justify-center p-2`}>
                  <div className="text-center">
                    <ImageIcon size={20} className="text-white/80 mx-auto mb-1" />
                    <p className="text-[9px] text-white/90 font-medium leading-tight">{ad.title}</p>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
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
            <p className="text-slate-400 text-sm">
              {conversations.length === 0 ? "No messages yet" : "No results found"}
            </p>
            <p className="text-slate-300 text-xs mt-1">
              {conversations.length === 0 ? "Search for users and start a conversation" : "Try a different search term"}
            </p>
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
                <Avatar name={conv.contactName} size="lg" />

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

      {/* Ad Detail Modal */}
      <AnimatePresence>
        {selectedAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            onClick={() => setSelectedAd(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-1 rounded-full bg-slate-200 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                <button onClick={() => setSelectedAd(null)} className="ml-auto p-1">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              <div className={`w-full h-40 rounded-2xl bg-gradient-to-br ${selectedAd.color} flex items-center justify-center mb-4`}>
                <ImageIcon size={48} className="text-white/60" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{selectedAd.title}</h3>
              <p className="text-sm text-slate-500 mb-1">Sponsored</p>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">{selectedAd.description}</p>
              <button
                onClick={() => setSelectedAd(null)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-sm font-semibold shadow-lg shadow-purple-500/25"
              >
                {selectedAd.cta}
                <ExternalLink size={14} />
              </button>
            </motion.div>
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
