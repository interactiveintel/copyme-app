"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { STRINGS } from "@/lib/i18n";

const principleKeys = [
  "landing.ruleOf7.principle1",
  "landing.ruleOf7.principle2",
  "landing.ruleOf7.principle3",
  "landing.ruleOf7.principle4",
  "landing.ruleOf7.principle5",
];

// Comparison table: feature labels and string-cell values are i18n keys.
// Booleans (true/false) render as check / X icons and stay locale-independent.
type CellVal = true | false | string; // string is an i18n key starting with "landing.compare.val."
interface CompareRow {
  featureKey: string;
  copyme: CellVal;
  whatsapp: CellVal;
  telegram: CellVal;
  wechat: CellVal;
}
const comparisonData: CompareRow[] = [
  {
    featureKey: "landing.compare.row.philosophy",
    copyme: "landing.compare.val.constrained",
    whatsapp: "landing.compare.val.unlimited",
    telegram: "landing.compare.val.unlimited",
    wechat: "landing.compare.val.unlimited",
  },
  {
    featureKey: "landing.compare.row.aiDiscovery",
    copyme: true,
    whatsapp: false,
    telegram: false,
    wechat: false,
  },
  {
    featureKey: "landing.compare.row.translation",
    copyme: "landing.compare.val.languages100",
    whatsapp: false,
    telegram: "landing.compare.val.limited",
    wechat: "landing.compare.val.limited",
  },
  {
    featureKey: "landing.compare.row.payments",
    copyme: true,
    whatsapp: "landing.compare.val.limited",
    telegram: false,
    wechat: true,
  },
  {
    featureKey: "landing.compare.row.surveys",
    copyme: true,
    whatsapp: false,
    telegram: "landing.compare.val.pollsOnly",
    wechat: false,
  },
];

function CellValue({ value, t }: { value: CellVal; t: (key: string) => string }) {
  if (value === true)
    return <Check size={18} className="text-accent-emerald mx-auto" />;
  if (value === false)
    return <X size={18} className="text-red-400 mx-auto" />;
  return (
    <span className="text-sm text-slate-600">{t(value)}</span>
  );
}

interface RuleOf7Props {
  /** Optional translation lookup. When omitted, English literals are used
   *  via identity fallback so the root `/` page renders the same as
   *  pre-S-254. */
  t?: (key: string) => string;
}

export default function RuleOf7({ t }: RuleOf7Props = {}) {
  // Fallback: when no t is passed (root `/` page), look up the English
  // string from STRINGS.en. Returning the bare key would surface ugly
  // dot-paths in the UI.
  const tt = t ?? ((key: string) => STRINGS.en[key] ?? key);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % principleKeys.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="rule-of-7"
      className="relative py-24 sm:py-32 overflow-hidden"
    >
      {/* Background */}
      <div className="orb w-[500px] h-[500px] bg-primary/15 top-[20%] left-[-15%]" />
      <div className="orb w-[350px] h-[350px] bg-accent-pink/10 bottom-[10%] right-[-10%]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold tracking-wider text-accent-amber uppercase mb-4">
            {tt("landing.ruleOf7.eyebrow")}
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900"
            dangerouslySetInnerHTML={{ __html: tt("landing.ruleOf7.title") }}
          />
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            {tt("landing.ruleOf7.subhead")}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
          {/* Left — Big 7 + cycling display */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            {/* Giant 7 */}
            <div className="relative">
              <span className="text-[12rem] sm:text-[16rem] font-black leading-none gradient-text select-none">
                7
              </span>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent-pink/20 blur-3xl" />
            </div>

            {/* Cycling principle */}
            <div className="mt-4 min-h-10 flex items-center justify-center text-center">
              <motion.span
                key={activeIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="text-xl sm:text-2xl font-semibold text-slate-900 max-w-md"
              >
                {tt(principleKeys[activeIndex])}
              </motion.span>
            </div>

            {/* Dot indicators */}
            <div className="flex gap-2 mt-4">
              {principleKeys.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`Show principle ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === activeIndex
                      ? "w-6 bg-gradient-to-r from-primary to-accent-pink"
                      : "w-2 bg-slate-300"
                  }`}
                />
              ))}
            </div>
          </motion.div>

          {/* Right — Principle list */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            {principleKeys.map((principle, i) => (
              <div
                key={principle}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                  i === activeIndex
                    ? "bg-white shadow-lg shadow-primary/10 scale-[1.02] border border-slate-200"
                    : "bg-white/80 border border-slate-100 opacity-60"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 ${
                    i === activeIndex
                      ? "gradient-bg-animated"
                      : "bg-slate-200"
                  }`}
                >
                  <Check size={18} />
                </div>
                <span
                  className={`text-base font-medium ${
                    i === activeIndex ? "text-slate-900" : "text-slate-500"
                  }`}
                >
                  {tt(principle)}
                </span>
              </div>
            ))}

            {/* Read-the-Rule-of-7-in-Terms CTA */}
            <Link
              href="/terms#rule-of-7"
              className="group mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-secondary transition-colors"
            >
              {tt("landing.readRuleInTerms")}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
        >
          <h3 className="text-2xl font-bold text-center mb-8 text-slate-900">
            {tt("landing.compare.title")}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-center">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-4 px-4 text-left text-sm font-medium text-slate-400">
                    {tt("landing.compare.col.feature")}
                  </th>
                  <th className="py-4 px-4 text-sm font-semibold gradient-text">
                    CopyMe
                  </th>
                  <th className="py-4 px-4 text-sm font-medium text-slate-400">
                    WhatsApp
                  </th>
                  <th className="py-4 px-4 text-sm font-medium text-slate-400">
                    Telegram
                  </th>
                  <th className="py-4 px-4 text-sm font-medium text-slate-400">
                    WeChat
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row) => (
                  <tr
                    key={row.featureKey}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-left text-sm text-slate-600">
                      {tt(row.featureKey)}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      <CellValue value={row.copyme} t={tt} />
                    </td>
                    <td className="py-3 px-4">
                      <CellValue value={row.whatsapp} t={tt} />
                    </td>
                    <td className="py-3 px-4">
                      <CellValue value={row.telegram} t={tt} />
                    </td>
                    <td className="py-3 px-4">
                      <CellValue value={row.wechat} t={tt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
