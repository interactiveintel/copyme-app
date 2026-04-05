"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Basic",
    price: { weekly: "Free", annual: "Free" },
    description: "Perfect for getting started with intentional messaging.",
    features: [
      "7 search results",
      "7 contacts",
      "49 messages per week",
      "Groups of 7",
      "70-word messages",
      "Basic translation",
    ],
    cta: "Get Started Free",
    style: "outlined" as const,
  },
  {
    name: "Business",
    price: { weekly: "$3 – $50/wk", annual: "$120 – $2,000/yr" },
    description: "Scale your reach with expanded limits and smart tools.",
    features: [
      "70 – 700 search results",
      "70 – 700 contacts",
      "Unlimited surveys",
      "Groups of 70",
      "Priority AI matching",
      "Advanced analytics",
      "Voice & video calls",
    ],
    cta: "Start Business Plan",
    style: "gradient-border" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: { weekly: "Custom", annual: "$15K – $1M/yr" },
    description: "E-commerce campaigns and massive reach for organizations.",
    features: [
      "7,000+ search results",
      "Unlimited contacts",
      "E-commerce campaigns",
      "White-label options",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Priority everything",
    ],
    cta: "Contact Sales",
    style: "gradient-fill" as const,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="orb w-[400px] h-[400px] bg-accent-amber/10 top-[5%] right-[-10%]" />
      <div className="orb w-[350px] h-[350px] bg-secondary/10 bottom-[10%] left-[-8%]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900">
            Simple{" "}
            <span className="gradient-text">Pricing</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Start free. Scale when you need.
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 p-1 rounded-full glass">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !isAnnual
                  ? "gradient-bg-animated text-white shadow-lg"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              7-Day
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                isAnnual
                  ? "gradient-bg-animated text-white shadow-lg"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Annual
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className={`relative rounded-2xl p-px ${
                tier.popular ? "md:-mt-4 md:mb-[-1rem]" : ""
              }`}
            >
              {/* Popular badge */}
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold text-white gradient-bg-animated shadow-lg shadow-primary/25">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Gradient border for popular */}
              {tier.style === "gradient-border" && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent-pink gradient-bg-animated" />
              )}

              {/* Gradient fill for enterprise */}
              {tier.style === "gradient-fill" && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent-pink/20" />
              )}

              <div
                className={`relative rounded-2xl p-6 sm:p-8 h-full ${
                  tier.style === "outlined"
                    ? "bg-white border border-slate-200 shadow-lg"
                    : tier.style === "gradient-border"
                    ? "bg-white shadow-lg"
                    : "bg-white shadow-lg"
                }`}
              >
                <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{tier.description}</p>

                <div className="mt-6 mb-6">
                  <span className="text-3xl font-bold text-slate-900">
                    {isAnnual ? tier.price.annual : tier.price.weekly}
                  </span>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check size={16} className="text-accent-emerald mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#cta"
                  className={`block w-full text-center rounded-full py-3 text-sm font-semibold transition-all ${
                    tier.style === "outlined"
                      ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      : tier.style === "gradient-fill"
                      ? "gradient-bg-animated text-white hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]"
                      : "gradient-bg-animated text-white hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]"
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
