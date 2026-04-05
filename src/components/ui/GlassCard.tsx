"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  gradient?: boolean;
  hover?: boolean;
}

export default function GlassCard({
  children,
  className = "",
  gradient = false,
  hover = false,
}: GlassCardProps) {
  const hoverProps = hover
    ? {
        whileHover: { scale: 1.02, y: -2 },
        whileTap: { scale: 0.98 },
        transition: { type: "spring" as const, stiffness: 400, damping: 25 },
      }
    : {};

  const baseClass = gradient
    ? `relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/50 via-purple-500/50 to-pink-500/50 ${className}`
    : `rounded-2xl bg-white shadow-sm border border-slate-200 ${className}`;

  const inner = gradient ? (
    <div className="rounded-2xl bg-white border border-slate-100 h-full">
      {children}
    </div>
  ) : (
    children
  );

  if (hover) {
    return (
      <motion.div className={baseClass} {...hoverProps}>
        {inner}
      </motion.div>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}
