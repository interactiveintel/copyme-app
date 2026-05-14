"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  Search,
  Globe,
  Video,
  BarChart3,
  Wallet,
} from "lucide-react";
import { STRINGS } from "@/lib/i18n";

const features = [
  {
    titleKey: "landing.features.ruleOf7.title",
    descKey: "landing.features.ruleOf7.desc",
    icon: Sparkles,
    gradient: "from-primary to-secondary",
    glow: "shadow-primary/20",
  },
  {
    titleKey: "landing.features.aiDiscovery.title",
    descKey: "landing.features.aiDiscovery.desc",
    icon: Search,
    gradient: "from-primary-light to-accent-cyan",
    glow: "shadow-accent-cyan/20",
  },
  {
    titleKey: "landing.features.translation.title",
    descKey: "landing.features.translation.desc",
    icon: Globe,
    gradient: "from-accent-emerald to-accent-cyan",
    glow: "shadow-accent-emerald/20",
  },
  {
    titleKey: "landing.features.voiceVideo.title",
    descKey: "landing.features.voiceVideo.desc",
    icon: Video,
    gradient: "from-accent-pink to-secondary",
    glow: "shadow-accent-pink/20",
  },
  {
    titleKey: "landing.features.surveys.title",
    descKey: "landing.features.surveys.desc",
    icon: BarChart3,
    gradient: "from-accent-amber to-accent-pink",
    glow: "shadow-accent-amber/20",
  },
  {
    titleKey: "landing.features.payments.title",
    descKey: "landing.features.payments.desc",
    icon: Wallet,
    gradient: "from-accent-cyan to-primary",
    glow: "shadow-accent-cyan/20",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

interface FeaturesProps {
  /** Optional translation lookup; falls back to STRINGS.en. */
  t?: (key: string) => string;
}

export default function Features({ t }: FeaturesProps = {}) {
  const tt = t ?? ((key: string) => STRINGS.en[key] ?? key);
  return (
    <section id="features" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background orbs */}
      <div className="orb w-[400px] h-[400px] bg-secondary/15 top-[10%] right-[-10%]" />
      <div className="orb w-[300px] h-[300px] bg-accent-emerald/10 bottom-[10%] left-[-5%]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900"
            dangerouslySetInnerHTML={{ __html: tt("landing.features.title") }}
          />
          <div className="mt-4 mx-auto h-1 w-24 rounded-full bg-gradient-to-r from-primary via-secondary to-accent-pink" />
          <p className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto">
            {tt("landing.features.subhead")}
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.titleKey}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="group relative rounded-2xl p-px cursor-default"
            >
              {/* Animated gradient border (visible on hover) */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent-pink opacity-0 group-hover:opacity-100 transition-opacity duration-500 gradient-bg-animated" />

              {/* Card inner */}
              <div className="relative rounded-2xl bg-white p-6 h-full transition-colors shadow-md border border-slate-100 group-hover:shadow-lg">
                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg ${feature.glow} mb-4`}
                >
                  <feature.icon size={22} className="text-white" />
                </div>

                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {tt(feature.titleKey)}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {tt(feature.descKey)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
