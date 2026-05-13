"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Sparkles, UserRound, ChevronLeft, ChevronRight, Eye, EyeOff, Upload } from "lucide-react";
import GlassCard from "../ui/GlassCard";
import GradientButton from "../ui/GradientButton";
import WordCounter from "../ui/WordCounter";
import OnboardingAI from "./OnboardingAI";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/i18n/client";

interface OnboardingScreenProps {
  onComplete: () => void;
}

const countryCodes = [
  { code: "+1", country: "US" },
  { code: "+44", country: "UK" },
  { code: "+91", country: "IN" },
  { code: "+86", country: "CN" },
  { code: "+81", country: "JP" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+55", country: "BR" },
  { code: "+234", country: "NG" },
  { code: "+254", country: "KE" },
];

// Internal id stays English so existing comparisons (e.g. `descCategory ===
// "Education"`) keep working; display label is looked up via labelKey.
const descCategories = [
  { id: "Education", labelKey: "onboarding.descCat.education" },
  { id: "Business", labelKey: "onboarding.descCat.business" },
  { id: "Religion", labelKey: "onboarding.descCat.religion" },
  { id: "Other", labelKey: "onboarding.descCat.other" },
];

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { authFetch } = useAuth();
  const { t } = useLocale();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Location
  const [globalArea, setGlobalArea] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [region, setRegion] = useState("");
  const [cityZip, setCityZip] = useState("");
  const [localDesc, setLocalDesc] = useState("");
  const [locationVisible, setLocationVisible] = useState(true);

  // Step 2: Interests
  const [interests, setInterests] = useState<string[]>(Array(7).fill(""));

  // Step 3: About
  const [descCategory, setDescCategory] = useState("Education");
  const [descLevel, setDescLevel] = useState("");
  const [descLocation, setDescLocation] = useState("");
  const [descInstitution, setDescInstitution] = useState("");
  const [descType, setDescType] = useState("");

  const steps = [
    { icon: MapPin, title: t("onboarding.step.location.title"), subtitle: t("onboarding.step.location.subtitle") },
    { icon: Sparkles, title: t("onboarding.step.interests.title"), subtitle: t("onboarding.step.interests.subtitle") },
    { icon: UserRound, title: t("onboarding.step.about.title"), subtitle: t("onboarding.step.about.subtitle") },
  ];

  const updateInterest = (index: number, value: string) => {
    const next = [...interests];
    next[index] = value;
    setInterests(next);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-white">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-pink-200/20 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md pt-12">
        {/* Progress bar */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {steps.map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  i <= step
                    ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
                animate={{ scale: i === step ? 1.1 : 1 }}
              >
                {i + 1}
              </motion.div>
              {i < 2 && (
                <div className={`w-12 h-0.5 rounded ${i < step ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step title */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center mb-6"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-1">{steps[step].title}</h2>
            <p className="text-slate-500 text-sm">{steps[step].subtitle}</p>
          </motion.div>
        </AnimatePresence>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <GlassCard gradient className="p-5 space-y-4">
                <div className="p-4">
                  {/* Global Area */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs text-slate-500">{t("onboarding.label.globalArea")}</label>
                      <WordCounter text={globalArea} maxWords={5} />
                    </div>
                    <input
                      type="text"
                      value={globalArea}
                      onChange={(e) => setGlobalArea(e.target.value)}
                      placeholder="e.g. North America, West Africa"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  {/* Country */}
                  <div className="mb-4">
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("onboarding.label.countryCode")}</label>
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                    >
                      {countryCodes.map((c) => (
                        <option key={c.code} value={c.code} className="bg-white">
                          {c.country} {c.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Region */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs text-slate-500">{t("onboarding.label.region")}</label>
                      <WordCounter text={region} maxWords={5} />
                    </div>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="e.g. California, Lagos State"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  {/* City/ZIP */}
                  <div className="mb-4">
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("onboarding.label.cityZip")}</label>
                    <input
                      type="text"
                      value={cityZip}
                      onChange={(e) => setCityZip(e.target.value)}
                      placeholder="e.g. San Francisco, 94102"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  {/* Local Desc */}
                  <div className="mb-4">
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("onboarding.label.localDescription")}</label>
                    <input
                      type="text"
                      value={localDesc}
                      onChange={(e) => setLocalDesc(e.target.value)}
                      placeholder="e.g. Downtown, near the park"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  {/* Visibility toggle */}
                  <button
                    onClick={() => setLocationVisible(!locationVisible)}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {locationVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                    <span>{locationVisible ? t("onboarding.location.visible") : t("onboarding.location.hidden")}</span>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${locationVisible ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-slate-200"}`}>
                      <motion.div
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                        animate={{ left: locationVisible ? 22 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </div>
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-3"
            >
              {interests.map((interest, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <GlassCard gradient={!!interest} className="p-[1px]">
                    <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={interest}
                          onChange={(e) => {
                            if (e.target.value.length <= 45) updateInterest(i, e.target.value);
                          }}
                          placeholder={`Interest ${i + 1} (e.g. ${["Photography", "AI Tech", "Cooking", "Travel", "Music", "Fitness", "Reading"][i]})`}
                          className="w-full bg-transparent text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>
                      <WordCounter text={interest} maxWords={7} />
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <GlassCard gradient className="overflow-hidden">
                <div className="p-5 space-y-4">
                  {/* Avatar upload */}
                  <div className="flex justify-center mb-2">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-purple-500/50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-purple-400/70 transition-colors">
                      <Upload size={20} className="text-purple-400/60" />
                      <span className="text-[10px] text-white/40">{t("onboarding.uploadPhoto")}</span>
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("onboarding.label.category")}</label>
                    <div className="flex gap-2 flex-wrap">
                      {descCategories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setDescCategory(cat.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            descCategory === cat.id
                              ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white"
                              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {t(cat.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Level */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("onboarding.label.level")}</label>
                    <input
                      type="text"
                      value={descLevel}
                      onChange={(e) => setDescLevel(e.target.value)}
                      placeholder={descCategory === "Education" ? "e.g. Masters, PhD" : "e.g. Senior, Director"}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("onboarding.label.locationField")}</label>
                    <input
                      type="text"
                      value={descLocation}
                      onChange={(e) => setDescLocation(e.target.value)}
                      placeholder="e.g. Stanford University area"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  {/* Institution */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("onboarding.label.institution")}</label>
                    <input
                      type="text"
                      value={descInstitution}
                      onChange={(e) => setDescInstitution(e.target.value)}
                      placeholder="e.g. Stanford University"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  {/* Type Description */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("onboarding.label.description")}</label>
                    <input
                      type="text"
                      value={descType}
                      onChange={(e) => setDescType(e.target.value)}
                      placeholder="e.g. Computer Science, Fintech startup"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Onboarding Helper */}
        <OnboardingAI
          step={step}
          currentData={{
            globalArea,
            countryCode,
            region,
            cityZip,
            interests,
          }}
          onApplySuggestion={(field, value) => {
            switch (field) {
              case "globalArea":
                setGlobalArea(value);
                break;
              case "region":
                setRegion(value);
                break;
              case "cityZip":
                setCityZip(value);
                break;
              case "interest": {
                const emptyIdx = interests.findIndex((i) => !i);
                if (emptyIdx !== -1) updateInterest(emptyIdx, value);
                break;
              }
              case "description":
                setDescType(value);
                break;
            }
          }}
        />

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 gap-4">
          {step > 0 ? (
            <GradientButton variant="secondary" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> {t("cta.back")}
            </GradientButton>
          ) : (
            <div />
          )}

          <button onClick={onComplete} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            {t("cta.skip")}
          </button>

          {step < 2 ? (
            <GradientButton onClick={() => setStep(step + 1)}>
              {t("cta.next")} <ChevronRight size={18} />
            </GradientButton>
          ) : (
            <GradientButton
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const filledInterests = interests
                    .map((text, i) => ({ slotNumber: i + 1, interestText: text.trim() }))
                    .filter((i) => i.interestText);

                  await authFetch("/api/users/me", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: {
                        globalArea: globalArea || undefined,
                        countryPhoneCode: countryCode || undefined,
                        region: region || undefined,
                        cityZip: cityZip || undefined,
                        localDescription: localDesc || undefined,
                        locationVisible,
                      },
                      interests: filledInterests.length > 0 ? filledInterests : undefined,
                    }),
                  });
                } catch {
                  // save failed — continue anyway
                } finally {
                  setSaving(false);
                  onComplete();
                }
              }}
            >
              {saving ? t("cta.saving") : t("cta.getStarted")} <ChevronRight size={18} />
            </GradientButton>
          )}
        </div>
      </div>
    </div>
  );
}
