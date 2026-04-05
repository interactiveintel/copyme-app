"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ChevronRight, MapPin, Lightbulb, FileText } from "lucide-react";
import AIBadge from "../ui/AIBadge";

interface OnboardingAIProps {
  step: number;
  currentData: Record<string, string | string[]>;
  onApplySuggestion: (field: string, value: string) => void;
}

const locationSuggestions = [
  { area: "North America", region: "California", city: "San Francisco, 94102" },
  { area: "North America", region: "New York", city: "New York City, 10001" },
  { area: "Europe", region: "London", city: "Central London, EC1" },
];

const interestSuggestions = [
  "Photography",
  "Artificial Intelligence",
  "Travel & Culture",
  "Music Production",
  "Startup Life",
  "Fitness & Health",
  "Cooking & Food",
];

const descriptionPreview =
  "Computer Science graduate student at Stanford University, passionate about AI and building products that connect people. Currently exploring the intersection of machine learning and social platforms.";

export default function OnboardingAI({
  step,
  currentData,
  onApplySuggestion,
}: OnboardingAIProps) {
  const [expanded, setExpanded] = useState(false);

  const stepIcons = [MapPin, Lightbulb, FileText];
  const StepIcon = stepIcons[step] || Sparkles;

  const stepTitles = [
    "Location suggestions based on your phone code",
    "AI-recommended interests for you",
    "AI-polished description preview",
  ];

  return (
    <>
      {/* Floating trigger bubble */}
      <AnimatePresence>
        {!expanded && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => setExpanded(true)}
            className="fixed bottom-28 right-4 z-50"
          >
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-md animate-pulse-glow" />
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Sparkles size={22} className="text-white" />
              </div>
              {/* Notification dot */}
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">!</span>
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) setExpanded(false);
            }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md rounded-t-3xl bg-white backdrop-blur-xl border-t border-x border-slate-200 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <StepIcon size={16} className="text-purple-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        AI Suggestions
                      </span>
                      <AIBadge variant="inline" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {stepTitles[step]}
                    </p>
                  </div>
                </div>
                <motion.button
                  onClick={() => setExpanded(false)}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <X size={14} className="text-slate-500" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="px-5 pb-6">
                <AnimatePresence mode="wait">
                  {/* Step 0: Location */}
                  {step === 0 && (
                    <motion.div
                      key="loc"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-2"
                    >
                      <p className="text-xs text-slate-500 mb-3">
                        Based on your phone code, you might be in...
                      </p>
                      {locationSuggestions.map((loc, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          onClick={() => {
                            onApplySuggestion("globalArea", loc.area);
                            onApplySuggestion("region", loc.region);
                            onApplySuggestion("cityZip", loc.city);
                            setExpanded(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-purple-500/20 transition-all group"
                        >
                          <MapPin
                            size={14}
                            className="text-purple-400/60 shrink-0 group-hover:text-purple-400"
                          />
                          <div className="flex-1 text-left">
                            <p className="text-xs text-slate-700 font-medium">
                              {loc.area}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {loc.region} · {loc.city}
                            </p>
                          </div>
                          <ChevronRight
                            size={14}
                            className="text-slate-300 group-hover:text-purple-400"
                          />
                        </motion.button>
                      ))}
                    </motion.div>
                  )}

                  {/* Step 1: Interests */}
                  {step === 1 && (
                    <motion.div
                      key="int"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <p className="text-xs text-slate-500 mb-3">
                        Tap to add suggested interests
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {interestSuggestions.map((interest, i) => (
                          <motion.button
                            key={interest}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.06 }}
                            onClick={() => {
                              onApplySuggestion("interest", interest);
                            }}
                            className="group relative px-3.5 py-2 rounded-full text-xs font-medium text-slate-600 hover:text-slate-900 transition-all"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-slate-200 group-hover:border-purple-500/40 transition-colors" />
                            <span className="relative flex items-center gap-1.5">
                              <Sparkles size={10} className="text-purple-400" />
                              {interest}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Description */}
                  {step === 2 && (
                    <motion.div
                      key="desc"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <p className="text-xs text-slate-500 mb-3">
                        AI-generated description preview
                      </p>
                      <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 mb-4">
                        <p className="text-xs text-slate-600 leading-relaxed italic">
                          &ldquo;{descriptionPreview}&rdquo;
                        </p>
                      </div>
                      <motion.button
                        onClick={() => {
                          onApplySuggestion("description", descriptionPreview);
                          setExpanded(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-semibold"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Sparkles size={14} />
                        Apply Suggestion
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
