"use client";

import { motion } from "framer-motion";
import {
  X,
  MapPin,
  Sparkles,
  MessageCircle,
  Heart,
  Clock,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import type { MockProfile } from "@/lib/mock-data";

interface ContactProfileSheetProps {
  profile: MockProfile;
  messagesRemaining: number;
  onClose: () => void;
  onMessage: () => void;
}

// Simulated "your" interests for computing shared values
const MY_INTERESTS = [
  "photography",
  "machine learning",
  "hiking",
  "coffee culture",
  "product design",
  "podcasts",
  "cooking",
];

export default function ContactProfileSheet({
  profile,
  messagesRemaining,
  onClose,
  onMessage,
}: ContactProfileSheetProps) {
  const sharedInterests = profile.interests.filter((interest) =>
    MY_INTERESTS.some(
      (mine) =>
        mine.toLowerCase() === interest.toLowerCase() ||
        interest.toLowerCase().includes(mine.toLowerCase()) ||
        mine.toLowerCase().includes(interest.toLowerCase())
    )
  );

  const uniqueInterests = profile.interests.filter(
    (interest) => !sharedInterests.includes(interest)
  );

  const connectionScore = Math.min(
    99,
    Math.round(60 + sharedInterests.length * 12 + Math.random() * 5)
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-6 pt-6 pb-12">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <X size={16} className="text-white" />
          </button>

          <div className="flex items-center gap-1.5 mb-2">
            {profile.online && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span className="text-[11px] text-white/80 font-medium">
              {profile.online ? "Online now" : `Last seen ${profile.lastSeen}`}
            </span>
          </div>
        </div>

        {/* Avatar overlapping header */}
        <div className="relative -mt-10 px-6 mb-3">
          <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-lg">
            <div className="w-full h-full rounded-xl overflow-hidden">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Avatar name={profile.displayName} size="xl" />
              )}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Name + location */}
          <h2 className="text-xl font-bold text-slate-900">
            {profile.displayName}
          </h2>
          <div className="flex items-center gap-1.5 mt-1 mb-3">
            <MapPin size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400">
              {profile.location.cityZip}, {profile.location.region}
            </span>
          </div>

          {/* Bio */}
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            {profile.bio}
          </p>

          {/* Connection score */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 mb-5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <Heart size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-purple-600">
                  {connectionScore}%
                </span>
                <span className="text-xs font-medium text-purple-400">
                  Value Match
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {sharedInterests.length} shared interest
                {sharedInterests.length !== 1 ? "s" : ""} connect you
              </p>
            </div>
          </div>

          {/* Shared interests */}
          {sharedInterests.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles size={14} className="text-purple-500" />
                <h3 className="text-sm font-semibold text-slate-700">
                  Shared Interests
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {sharedInterests.map((interest) => (
                  <span
                    key={interest}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Their other interests */}
          {uniqueInterests.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-2.5">
                Their Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {uniqueInterests.map((interest) => (
                  <span
                    key={interest}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rule of 7 status */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500">Messages left</span>
            </div>
            <div className="flex gap-1 ml-auto">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < messagesRemaining
                      ? "bg-gradient-to-br from-indigo-500 to-purple-500"
                      : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="p-5 pt-0 shrink-0">
          <button
            onClick={onMessage}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-sm font-semibold shadow-lg shadow-purple-500/20"
          >
            <MessageCircle size={16} />
            Send Message
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
