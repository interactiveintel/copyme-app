"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, ImageIcon, Sparkles, X, ExternalLink } from "lucide-react";
import Avatar from "../ui/Avatar";
import GlassCard from "../ui/GlassCard";
import SmartMatchPanel from "./SmartMatchPanel";

interface InboxScreenProps {
  onOpenChat: (chatId: string) => void;
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

const mockConversations = [
  {
    id: "1",
    name: "Amara Okafor",
    lastMessage: "The project presentation looks amazing! Ready for tomorrow?",
    time: "2m ago",
    unread: 3,
    online: true,
  },
  {
    id: "2",
    name: "Lucas Chen",
    lastMessage: "Just sent you the design files",
    time: "15m ago",
    unread: 1,
    online: true,
  },
  {
    id: "3",
    name: "Sofia Martinez",
    lastMessage: "Happy birthday! Hope you have a wonderful day filled with joy",
    time: "1h ago",
    unread: 0,
    online: false,
  },
  {
    id: "4",
    name: "Dev Team",
    lastMessage: "Kai: Deployed v2.3 to staging environment",
    time: "2h ago",
    unread: 7,
    online: true,
  },
  {
    id: "5",
    name: "Priya Sharma",
    lastMessage: "See you at the conference next week!",
    time: "5h ago",
    unread: 0,
    online: true,
  },
  {
    id: "6",
    name: "James Wilson",
    lastMessage: "Thanks for the recommendation, really helped!",
    time: "1d ago",
    unread: 0,
    online: false,
  },
  {
    id: "7",
    name: "Yuki Tanaka",
    lastMessage: "The photos from Kyoto turned out beautiful",
    time: "2d ago",
    unread: 0,
    online: false,
  },
];

export default function InboxScreen({ onOpenChat }: InboxScreenProps) {
  const [search, setSearch] = useState("");
  const [showSmartMatch, setShowSmartMatch] = useState(false);
  const [selectedAd, setSelectedAd] = useState<typeof mockAds[number] | null>(null);

  const filtered = mockConversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
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
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Search size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-400 text-sm">No messages yet</p>
            <p className="text-slate-300 text-xs mt-1">Start a conversation</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((conv, i) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onOpenChat(conv.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all hover:bg-slate-50 active:bg-slate-100 relative ${
                  conv.unread > 0 ? "bg-slate-50" : ""
                }`}
              >
                {/* Unread gradient border */}
                {conv.unread > 0 && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500" />
                )}

                <Avatar name={conv.name} size="lg" online={conv.online} showStatus />

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${conv.unread > 0 ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                      {conv.name}
                    </span>
                    <span className={`text-[11px] ${conv.unread > 0 ? "text-purple-500" : "text-slate-400"}`}>
                      {conv.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-xs truncate pr-4 ${conv.unread > 0 ? "text-slate-600" : "text-slate-400"}`}>
                      {conv.lastMessage}
                    </p>
                    {conv.unread > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-[10px] font-bold text-white px-1.5">
                        {conv.unread}
                      </span>
                    )}
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
