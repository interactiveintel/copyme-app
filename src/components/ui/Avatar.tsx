"use client";

import { motion } from "framer-motion";

interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
  showStatus?: boolean;
}

const sizeMap = {
  sm: { container: 32, text: "text-xs", dot: 8, ring: 2 },
  md: { container: 40, text: "text-sm", dot: 10, ring: 2 },
  lg: { container: 56, text: "text-lg", dot: 12, ring: 3 },
  xl: { container: 80, text: "text-2xl", dot: 16, ring: 3 },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({
  src,
  name,
  size = "md",
  online = false,
  showStatus = false,
}: AvatarProps) {
  const s = sizeMap[size];
  const initials = getInitials(name);

  return (
    <div
      className="relative inline-flex shrink-0"
      style={{ width: s.container, height: s.container }}
    >
      {/* Gradient ring */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
        style={{ padding: s.ring }}
      >
        <div className="w-full h-full rounded-full bg-white" />
      </div>

      {/* Avatar image or initials */}
      <div
        className="absolute rounded-full overflow-hidden flex items-center justify-center"
        style={{
          inset: s.ring + 1,
        }}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 ${s.text} font-bold text-white`}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Online/offline status dot */}
      {showStatus && (
        <div
          className="absolute bottom-0 right-0 flex items-center justify-center"
          style={{ width: s.dot, height: s.dot }}
        >
          <div
            className={`w-full h-full rounded-full border-2 border-white ${
              online ? "bg-emerald-400" : "bg-gray-500"
            }`}
          />
          {online && (
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
      )}
    </div>
  );
}
