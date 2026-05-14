"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { STRINGS } from "@/lib/i18n";

// Tier metadata. Name / description / CTA are i18n keys; per-feature
// bullet lists stay as English literals for now — they're numerical and
// the team iterates on positioning frequently. We'll lock in feature
// translations once pricing stabilizes.
const tiers = [
  {
    nameKey: "landing.pricing.basic.name",
    priceKey: "landing.pricing.basic.price",
    price: { weekly: "literal", annual: "literal" }, // both render the same key
    descKey: "landing.pricing.basic.desc",
    features: [
      "7 search results",
      "7 contacts",
      "49 messages per week",
      "Groups of 7",
      "70-word messages",
      "Basic translation",
    ],
    ctaKey: "landing.pricing.basic.cta",
    style: "outlined" as const,
  },
  {
    nameKey: "landing.pricing.business.name",
    price: { weekly: "$3 – $50/wk", annual: "$120 – $2,000/yr" },
    descKey: "landing.pricing.business.desc",
    features: [
      "70 – 700 search results",
      "70 – 700 contacts",
      "Unlimited surveys",
      "Groups of 70",
      "Priority AI matching",
      "Advanced analytics",
      "Voice & video calls",
    ],
    ctaKey: "landing.pricing.business.cta",
    style: "gradient-border" as const,
    popular: true,
  },
  {
    nameKey: "landing.pricing.enterprise.name",
    priceKey: "landing.pricing.enterprise.priceWeekly",
    price: { weekly: "literal", annual: "$15K – $1M/yr" },
    descKey: "landing.pricing.enterprise.desc",
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
    ctaKey: "landing.pricing.enterprise.cta",
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

interface PricingProps {
  /** Optional translation lookup; falls back to STRINGS.en. */
  t?: (key: string) => string;
}

export default function Pricing({ t }: PricingProps = {}) {
  const tt = t ?? ((key: string) => STRINGS.en[key] ?? key);
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
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900"
            dangerouslySetInnerHTML={{ __html: tt("landing.pricing.title") }}
          />
          <p className="mt-4 text-lg text-slate-500">
            {tt("landing.pricing.subhead")}
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
              {tt("landing.pricing.toggle.weekly")}
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                isAnnual
                  ? "gradient-bg-animated text-white shadow-lg"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tt("landing.pricing.toggle.annual")}
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.nameKey}
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
                    {tt("landing.pricing.popular")}
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
                <h3 className="text-xl font-bold text-slate-900">{tt(tier.nameKey)}</h3>
                <p className="mt-1 text-sm text-slate-500">{tt(tier.descKey)}</p>

                <div className="mt-6 mb-6">
                  <span className="text-3xl font-bold text-slate-900">
                    {/* If a tier has a translatable price token (Free / Custom),
                        prefer it over the literal string from `tier.price`. */}
                    {tier.priceKey && (isAnnual ? tier.price.annual === "literal" : tier.price.weekly === "literal")
                      ? tt(tier.priceKey)
                      : isAnnual ? tier.price.annual : tier.price.weekly}
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
                  {tt(tier.ctaKey)}
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
