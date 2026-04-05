"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, MessageSquare, Minimize2, Globe, ChevronDown } from "lucide-react";

interface ChatAIAssistantProps {
  currentMessage: string;
  conversationContext: string;
  onInsertReply: (text: string) => void;
  onClose: () => void;
}

const mockReplies = [
  "Sounds great! I'd love to see the final version when it's ready.",
  "Thanks for the update! Let's sync tomorrow to discuss next steps.",
  "Awesome work! The team is going to be really impressed with this.",
];

const mockLanguages = [
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Portuguese",
  "Arabic",
  "Hindi",
];

const mockTranslations: Record<string, string> = {
  Spanish: "Suena perfecto! Emocionado por el lanzamiento",
  French: "Ca a l'air parfait ! Enthousiaste pour le lancement",
  German: "Klingt perfekt! Freue mich auf den Launch",
  Japanese: "完璧ですね！ローンチが楽しみです",
  Portuguese: "Parece perfeito! Empolgado para o lancamento",
  Arabic: "يبدو رائعا! متحمس للإطلاق",
  Hindi: "बिल्कुल सही लग रहा है! लॉन्च के लिए उत्साहित",
};

type TabType = "replies" | "condense" | "translate";

const toneConfig = {
  Friendly: { color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", emoji: "💚" },
  Professional: { color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/30", emoji: "💙" },
  Casual: { color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30", emoji: "💛" },
  Urgent: { color: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/30", emoji: "🔴" },
};

export default function ChatAIAssistant({
  currentMessage,
  conversationContext,
  onInsertReply,
  onClose,
}: ChatAIAssistantProps) {
  const [activeTab, setActiveTab] = useState<TabType>("replies");
  const [selectedLang, setSelectedLang] = useState("Spanish");
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const currentTone = "Friendly" as keyof typeof toneConfig;
  const tone = toneConfig[currentTone];

  // Mock condensed text
  const originalWords = 95;
  const condensedWords = 68;
  const condensedText =
    "Just finished the new UI mockups for CopyMe. The gradient design and glass morphism effects look incredible. Let me know your thoughts — excited for the launch!";

  const tabs: { key: TabType; label: string }[] = [
    { key: "replies", label: "Replies" },
    { key: "condense", label: "Condense" },
    { key: "translate", label: "Translate" },
  ];

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute bottom-full left-0 right-0 mb-2 mx-2 rounded-2xl bg-white backdrop-blur-xl border border-slate-200 overflow-hidden shadow-xl z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-purple-400" />
          <span className="text-xs font-semibold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Tone indicator */}
          <span
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tone.bg} ${tone.color} border ${tone.border}`}
          >
            {tone.emoji} {currentTone}
          </span>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
            className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <X size={12} className="text-slate-500" />
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === tab.key
                ? "bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-slate-900 border border-purple-500/30"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 pb-4 max-h-64 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "replies" && (
            <motion.div
              key="replies"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              {mockReplies.map((reply, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => onInsertReply(reply)}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-purple-500/20 transition-all group"
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare
                      size={12}
                      className="text-purple-400/60 mt-0.5 shrink-0 group-hover:text-purple-400"
                    />
                    <p className="text-xs text-slate-600 leading-relaxed group-hover:text-white/75">
                      {reply}
                    </p>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {activeTab === "condense" && (
            <motion.div
              key="condense"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Word count comparison */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-slate-400">
                  Was {originalWords} words
                </span>
                <span className="text-[10px] text-slate-300">→</span>
                <span className="text-[10px] font-medium bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Now {condensedWords} words
                </span>
                <Minimize2 size={10} className="text-emerald-400/50" />
              </div>

              <motion.button
                onClick={() => onInsertReply(condensedText)}
                className="w-full text-left px-3 py-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-purple-500/20 transition-all"
              >
                <p className="text-xs text-slate-600 leading-relaxed">
                  {condensedText}
                </p>
              </motion.button>
            </motion.div>
          )}

          {activeTab === "translate" && (
            <motion.div
              key="translate"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Language selector */}
              <div className="relative mb-3">
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 w-full hover:bg-slate-100 transition-colors"
                >
                  <Globe size={12} className="text-purple-400" />
                  <span className="flex-1 text-left">{selectedLang}</span>
                  <ChevronDown
                    size={12}
                    className={`text-slate-400 transition-transform ${
                      showLangDropdown ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {showLangDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-white border border-slate-200 overflow-hidden z-10 shadow-xl"
                    >
                      {mockLanguages.map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            setSelectedLang(lang);
                            setShowLangDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                            selectedLang === lang
                              ? "text-purple-600 bg-purple-50"
                              : "text-slate-500"
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Translated preview */}
              <motion.button
                onClick={() =>
                  onInsertReply(
                    mockTranslations[selectedLang] || "Translation unavailable"
                  )
                }
                className="w-full text-left px-3 py-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-purple-500/20 transition-all"
              >
                <p className="text-xs text-slate-600 leading-relaxed">
                  {mockTranslations[selectedLang] || "Translation unavailable"}
                </p>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
