"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface GradientButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}

const sizeClasses = {
  sm: "px-4 py-2 text-sm rounded-xl",
  md: "px-6 py-3 text-base rounded-xl",
  lg: "px-8 py-4 text-lg rounded-2xl",
};

export default function GradientButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
}: GradientButtonProps) {
  const isDisabled = disabled || loading;

  if (variant === "primary") {
    return (
      <motion.button
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        className={`relative font-semibold text-white overflow-hidden ${sizeClasses[size]} ${
          isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${className}`}
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-0 hover:opacity-100 transition-opacity duration-300" />
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 blur-lg opacity-30" />
        <span className="relative flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />}
          {children}
        </span>
      </motion.button>
    );
  }

  if (variant === "secondary") {
    return (
      <motion.button
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        className={`font-semibold text-slate-700 bg-white border border-slate-200 ${sizeClasses[size]} ${
          isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
        } ${className}`}
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      >
        <span className="flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />}
          {children}
        </span>
      </motion.button>
    );
  }

  // outline
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`relative font-semibold overflow-hidden p-[1px] rounded-xl ${
        isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl" />
      <div
        className={`relative bg-white rounded-xl flex items-center justify-center gap-2 ${sizeClasses[size]}`}
      >
        {loading && <Loader2 size={18} className="animate-spin text-purple-400" />}
        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          {children}
        </span>
      </div>
    </motion.button>
  );
}
