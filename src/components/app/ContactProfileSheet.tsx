"use client";

import { motion } from "framer-motion";
import {
  X,
  MapPin,
  Sparkles,
  MessageCircle,
  Heart,
  Clock,
  Briefcase,
  GraduationCap,
  Globe,
  Calendar,
  BadgeCheck,
  BarChart3,
  Users,
  Link as LinkIcon,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import { useLocale } from "@/lib/i18n/client";
import type { MockProfile } from "@/lib/mock-data";

interface ContactProfileSheetProps {
  profile: MockProfile;
  messagesRemaining: number;
  onClose: () => void;
  onMessage: () => void;
}

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
  const { t } = useLocale();
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
              {profile.online
                ? t("profile.online")
                : t("profile.lastSeen", { when: profile.lastSeen })}
            </span>
          </div>

          {/* Profile completion bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/60">{t("profile.completion")}</span>
              <span className="text-[10px] text-white/80 font-semibold">{profile.profileCompletion}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white/80 transition-all"
                style={{ width: `${profile.profileCompletion}%` }}
              />
            </div>
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
          {/* Name + verified badge + location */}
          <div className="flex items-center gap-1.5">
            <h2 className="text-xl font-bold text-slate-900">
              {profile.displayName}
            </h2>
            {profile.verified && (
              <BadgeCheck size={18} className="text-blue-500 shrink-0" />
            )}
            {profile.age && (
              <span className="text-sm text-slate-400 ml-1">{profile.age}</span>
            )}
          </div>

          {/* Occupation + Company */}
          <p className="text-sm text-slate-600 font-medium mt-0.5">
            {profile.occupation}
            {profile.company && <span className="text-slate-400"> at {profile.company}</span>}
          </p>

          <div className="flex items-center gap-1.5 mt-1.5 mb-3">
            <MapPin size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400">
              {profile.location.cityZip}, {profile.location.region}
            </span>
          </div>

          {/* Bio */}
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            {profile.bio}
          </p>

          {/* Quick info row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-lg font-bold text-slate-800">{profile.stats.contacts}</span>
              <span className="text-[10px] text-slate-400">{t("profile.stats.contacts")}</span>
            </div>
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-lg font-bold text-slate-800">{profile.stats.groups}</span>
              <span className="text-[10px] text-slate-400">{t("profile.stats.groups")}</span>
            </div>
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-lg font-bold text-slate-800">{profile.stats.messagesSent}</span>
              <span className="text-[10px] text-slate-400">{t("profile.stats.messages")}</span>
            </div>
          </div>

          {/* Connection score */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <Heart size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-purple-600">
                  {connectionScore}%
                </span>
                <span className="text-xs font-medium text-purple-400">
                  {t("profile.valueMatch")}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {sharedInterests.length} shared interest
                {sharedInterests.length !== 1 ? "s" : ""} connect you
              </p>
            </div>
          </div>

          {/* Details section */}
          <div className="space-y-2.5 mb-4">
            <div className="flex items-center gap-2.5">
              <GraduationCap size={14} className="text-slate-400 shrink-0" />
              <span className="text-xs text-slate-600">{profile.education}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Globe size={14} className="text-slate-400 shrink-0" />
              <span className="text-xs text-slate-600">{profile.languages.join(", ")}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <span className="text-xs text-slate-600">{t("profile.memberSince", { date: profile.memberSince })}</span>
            </div>
            {profile.socialLinks && profile.socialLinks.length > 0 && (
              <div className="flex items-center gap-2.5">
                <LinkIcon size={14} className="text-slate-400 shrink-0" />
                <div className="flex flex-wrap gap-1.5">
                  {profile.socialLinks.map((link) => (
                    <span
                      key={link.label}
                      className="px-2 py-0.5 rounded-full bg-indigo-50 text-[10px] text-indigo-600 font-medium"
                    >
                      {link.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Shared interests */}
          {sharedInterests.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles size={14} className="text-purple-500" />
                <h3 className="text-sm font-semibold text-slate-700">
                  {t("profile.sharedInterests")}
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
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2.5">
                {t("profile.theirInterests")}
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
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2.5">
              <BarChart3 size={14} className="text-purple-500" />
              <h3 className="text-sm font-semibold text-slate-700">{t("profile.ruleOf7Status")}</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: t("profile.stats.messages"), value: profile.stats.ruleOf7.messages },
                { label: t("profile.stats.contacts"), value: profile.stats.ruleOf7.contacts },
                { label: t("profile.stats.interests"), value: profile.stats.ruleOf7.interests },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 w-16">{item.label}</span>
                  <div className="flex gap-1 flex-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-2 rounded-full ${
                          i < item.value
                            ? "bg-gradient-to-r from-indigo-500 to-purple-500"
                            : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 w-8 text-right">{item.value}/7</span>
                </div>
              ))}
            </div>
          </div>

          {/* Messages remaining */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500">{t("profile.messagesLeft")}</span>
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
