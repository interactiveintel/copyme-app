"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { STRINGS } from "@/lib/i18n";

interface CTAProps {
  /** Optional translation lookup; falls back to STRINGS.en. */
  t?: (key: string) => string;
}

export default function CTA({ t }: CTAProps = {}) {
  const tt = t ?? ((key: string) => STRINGS.en[key] ?? key);
  // Substitute {n} into the social-proof phrase. We keep the embedded
  // <span> styling baked in via dangerouslySetInnerHTML so the bold count
  // pops the same way in every locale.
  const socialProofHtml = tt("landing.cta.socialProof").replace(
    /\{n\}/g,
    "50,000+",
  );
  return (
    <section id="cta" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" />
      <div className="orb w-[600px] h-[600px] bg-primary/20 top-[-20%] left-[-10%]" />
      <div className="orb w-[500px] h-[500px] bg-accent-pink/15 bottom-[-20%] right-[-10%]" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-slate-900"
            dangerouslySetInnerHTML={{ __html: tt("landing.cta.title") }}
          />
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            {tt("landing.cta.subhead")}
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/app"
              className="group inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white gradient-bg-animated transition-shadow hover:shadow-[0_0_40px_rgba(124,58,237,0.5)]"
            >
              {tt("landing.cta.signupNow")}
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            <a
              href="#rule-of-7"
              className="group inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-slate-700 border border-slate-200 bg-white transition-all hover:bg-slate-50 hover:border-purple-200 shadow-sm"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
                <Play size={12} className="text-white ml-0.5" />
              </span>
              {tt("landing.cta.howItWorks")}
            </a>
          </div>

          {/* Social Proof */}
          <div className="mt-8 flex items-center justify-center gap-3">
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              {[
                "from-primary to-secondary",
                "from-accent-pink to-secondary",
                "from-accent-emerald to-accent-cyan",
                "from-accent-amber to-accent-pink",
                "from-accent-cyan to-primary",
              ].map((gradient, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} border-2 border-white`}
                />
              ))}
            </div>
            <span
              className="text-sm text-slate-500"
              dangerouslySetInnerHTML={{ __html: socialProofHtml }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
