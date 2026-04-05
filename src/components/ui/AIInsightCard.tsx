"use client";

import { motion } from "framer-motion";
import { Sparkles, LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface AIInsightCardProps {
  title: string;
  description: string;
  confidence?: number;
  action?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  className?: string;
}

export default function AIInsightCard({
  title,
  description,
  confidence,
  action,
  onAction,
  icon: Icon,
  className = "",
}: AIInsightCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`relative rounded-2xl overflow-hidden bg-white/[0.05] backdrop-blur-xl border border-white/10 ${className}`}
    >
      {/* Gradient top accent bar */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
            {Icon ? (
              <Icon size={16} className="text-purple-400" />
            ) : (
              <Sparkles size={16} className="text-purple-400" />
            )}
          </div>
          <h3 className="text-sm font-semibold text-white flex-1">{title}</h3>
        </div>

        {/* Description */}
        <p className="text-xs text-white/50 leading-relaxed mb-3">
          {description}
        </p>

        {/* Confidence score bar */}
        {confidence !== undefined && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/40 font-medium">
                Confidence
              </span>
              <span className="text-[10px] font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {confidence}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${confidence}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Action button */}
        {action && onAction && (
          <motion.button
            onClick={onAction}
            className="w-full mt-1 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 transition-opacity"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {action}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
