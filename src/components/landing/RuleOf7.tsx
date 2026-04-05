"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

const constraints = [
  "7 inbox items",
  "70 word messages",
  "7 images per chat",
  "70s voice notes",
  "7 contacts at once",
];

const comparisonData = [
  {
    feature: "Message Limits",
    copyme: "7 per inbox",
    whatsapp: "Unlimited",
    telegram: "Unlimited",
    wechat: "Unlimited",
  },
  {
    feature: "Word Count",
    copyme: "70 words max",
    whatsapp: "65,536 chars",
    telegram: "4,096 chars",
    wechat: "2,000 chars",
  },
  {
    feature: "AI Discovery",
    copyme: true,
    whatsapp: false,
    telegram: false,
    wechat: false,
  },
  {
    feature: "Translation",
    copyme: "100+ languages",
    whatsapp: false,
    telegram: "Limited",
    wechat: "Limited",
  },
  {
    feature: "Built-in Payments",
    copyme: true,
    whatsapp: "Limited",
    telegram: false,
    wechat: true,
  },
  {
    feature: "Smart Surveys",
    copyme: true,
    whatsapp: false,
    telegram: "Polls only",
    wechat: false,
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (value === true)
    return <Check size={18} className="text-accent-emerald mx-auto" />;
  if (value === false)
    return <X size={18} className="text-red-400 mx-auto" />;
  return (
    <span className="text-sm text-slate-600">{value}</span>
  );
}

export default function RuleOf7() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % constraints.length);
    }, 2400);
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
            Our Philosophy
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900">
            The{" "}
            <span className="gradient-text">Rule of 7</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            Less noise. More meaning. A constraint system that transforms how you connect.
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

            {/* Cycling constraint */}
            <div className="mt-4 h-10 flex items-center justify-center">
              <motion.span
                key={activeIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="text-xl sm:text-2xl font-semibold text-slate-900"
              >
                {constraints[activeIndex]}
              </motion.span>
            </div>

            {/* Dot indicators */}
            <div className="flex gap-2 mt-4">
              {constraints.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === activeIndex
                      ? "w-6 bg-gradient-to-r from-primary to-accent-pink"
                      : "bg-slate-600"
                  }`}
                />
              ))}
            </div>
          </motion.div>

          {/* Right — Constraint list */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            {constraints.map((constraint, i) => (
              <div
                key={constraint}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                  i === activeIndex
                    ? "bg-white shadow-lg shadow-primary/10 scale-[1.02] border border-slate-200"
                    : "bg-white/80 border border-slate-100 opacity-60"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                    i === activeIndex
                      ? "gradient-bg-animated"
                      : "bg-slate-200"
                  }`}
                >
                  {i === 1 || i === 3 ? "70" : "7"}
                </div>
                <span
                  className={`text-base font-medium ${
                    i === activeIndex ? "text-slate-900" : "text-slate-500"
                  }`}
                >
                  {constraint}
                </span>
              </div>
            ))}
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
            How We <span className="gradient-text">Compare</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-center">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-4 px-4 text-left text-sm font-medium text-slate-400">
                    Feature
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
                    key={row.feature}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-left text-sm text-slate-600">
                      {row.feature}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      <CellValue value={row.copyme} />
                    </td>
                    <td className="py-3 px-4">
                      <CellValue value={row.whatsapp} />
                    </td>
                    <td className="py-3 px-4">
                      <CellValue value={row.telegram} />
                    </td>
                    <td className="py-3 px-4">
                      <CellValue value={row.wechat} />
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
