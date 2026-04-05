"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import AuthScreen from "@/components/app/AuthScreen";
import OnboardingScreen from "@/components/app/OnboardingScreen";
import InboxScreen from "@/components/app/InboxScreen";
import ChatScreen from "@/components/app/ChatScreen";
import SearchScreen from "@/components/app/SearchScreen";
import ProfileScreen from "@/components/app/ProfileScreen";

type Screen = "auth" | "onboarding" | "inbox" | "chat" | "search" | "contacts" | "ads" | "profile";
type Tab = "home" | "search" | "contacts" | "ads" | "profile";

function tabToScreen(tab: Tab): Screen {
  switch (tab) {
    case "home":
      return "inbox";
    case "search":
      return "search";
    case "contacts":
      return "contacts";
    case "ads":
      return "ads";
    case "profile":
      return "profile";
  }
}

function screenToTab(screen: Screen): Tab {
  switch (screen) {
    case "inbox":
    case "chat":
      return "home";
    case "search":
      return "search";
    case "contacts":
      return "contacts";
    case "ads":
      return "ads";
    case "profile":
      return "profile";
    default:
      return "home";
  }
}

export default function AppPage() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [chatId, setChatId] = useState<string | null>(null);

  const showNav = !["auth", "onboarding", "chat"].includes(screen);

  const handleTabChange = (tab: Tab) => {
    setScreen(tabToScreen(tab));
  };

  const handleOpenChat = (id: string) => {
    setChatId(id);
    setScreen("chat");
  };

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-white">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-hidden"
        >
          {screen === "auth" && (
            <div className="relative h-full">
              <AuthScreen
                onLogin={() => setScreen("inbox")}
                onRegister={() => setScreen("onboarding")}
              />
              {/* Skip to App button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                onClick={() => setScreen("inbox")}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white backdrop-blur-xl border border-slate-200 text-slate-400 text-xs hover:bg-slate-50 hover:text-slate-600 transition-all shadow-sm"
              >
                <Zap size={14} className="text-purple-400" />
                Skip to App (Demo)
              </motion.button>
            </div>
          )}

          {screen === "onboarding" && (
            <OnboardingScreen onComplete={() => setScreen("inbox")} />
          )}

          {screen === "inbox" && (
            <InboxScreen onOpenChat={handleOpenChat} />
          )}

          {screen === "chat" && chatId && (
            <ChatScreen chatId={chatId} onBack={() => setScreen("inbox")} />
          )}

          {screen === "search" && <SearchScreen />}

          {screen === "contacts" && (
            <div className="flex flex-col items-center justify-center h-full pb-20">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="text-purple-400/40"
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </motion.div>
              </div>
              <p className="text-slate-400 text-sm">Contacts coming soon</p>
            </div>
          )}

          {screen === "ads" && (
            <div className="flex flex-col items-center justify-center h-full pb-20">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400/40">
                  <path d="m3 11 18-5v12L3 13v-2z" />
                  <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                </svg>
              </div>
              <p className="text-slate-400 text-sm">Ad marketplace coming soon</p>
            </div>
          )}

          {screen === "profile" && <ProfileScreen />}
        </motion.div>
      </AnimatePresence>

      {/* Bottom Nav */}
      {showNav && (
        <BottomNav
          activeTab={screenToTab(screen)}
          onTabChange={handleTabChange}
          unreadCount={11}
        />
      )}
    </div>
  );
}
