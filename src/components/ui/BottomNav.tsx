"use client";

import { motion } from "framer-motion";
import {
  MessageSquare,
  Search,
  Users,
  Megaphone,
  User,
} from "lucide-react";

type Tab = "home" | "search" | "contacts" | "ads" | "profile";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  unreadCount?: number;
}

const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: "home", label: "Home", icon: MessageSquare },
  { id: "search", label: "Search", icon: Search },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "ads", label: "Ads", icon: Megaphone },
  { id: "profile", label: "Profile", icon: User },
];

export default function BottomNav({
  activeTab,
  onTabChange,
  unreadCount = 0,
}: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Glass backdrop */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-2xl border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]" />

      <div className="relative flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center gap-1 py-2 px-4 rounded-2xl"
              whileTap={{ scale: 0.9 }}
            >
              <div className="relative">
                <motion.div
                  animate={{
                    scale: isActive ? 1.15 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Icon
                    size={24}
                    className={
                      isActive
                        ? "stroke-transparent"
                        : "text-slate-400"
                    }
                    style={
                      isActive
                        ? {
                            stroke: "url(#navGradient)",
                          }
                        : undefined
                    }
                  />
                </motion.div>

                {/* Unread badge on Home */}
                {tab.id === "home" && unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-[10px] font-bold text-white px-1"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </motion.span>
                )}
              </div>

              <span
                className={`text-[10px] font-medium ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                    : "text-slate-400"
                }`}
              >
                {tab.label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <motion.div
                  layoutId="activeTabDot"
                  className="absolute -bottom-0.5 w-5 h-1 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* SVG gradient definition for icons */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="navGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
      </svg>
    </nav>
  );
}
