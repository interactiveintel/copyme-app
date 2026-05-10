import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles, ArrowRight, Zap, Crown, Briefcase } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing | CopyMe",
  description: "Simple, transparent pricing. Start free; upgrade when you need more contacts, longer messages, or business features.",
};

interface Tier {
  name: string;
  tagline: string;
  monthly: string;
  monthlyNote?: string;
  cta: string;
  href: string;
  highlight?: boolean;
  icon: React.ElementType;
  features: string[];
  fineprint?: string;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    tagline: "For people who want communication that means something.",
    monthly: "$0",
    monthlyNote: "forever",
    cta: "Sign up free",
    href: "/app",
    icon: Sparkles,
    features: [
      "Up to 7 active contacts",
      "70-word message cap (the Rule of 7)",
      "Last 7 messages per contact retained",
      "Yogi AI companion (light usage)",
      "AI-curated ad inbox",
      "Smart match: 10+ suggestions per session",
    ],
  },
  {
    name: "Pro",
    tagline: "For power users who want more room to breathe — without losing intentionality.",
    monthly: "$9",
    monthlyNote: "per month",
    cta: "Upgrade to Pro",
    href: "/app",
    highlight: true,
    icon: Crown,
    features: [
      "Up to 21 active contacts (3× free)",
      "Yogi: deeper memory + longer conversations",
      "Priority message routing",
      "Advanced search filters",
      "No third-party ads in your inbox",
      "Daily email digest of conversations",
    ],
    fineprint: "Cancel any time. No credit-card on file required for the 14-day trial.",
  },
  {
    name: "Business",
    tagline: "For brands and creators reaching real people who actually read.",
    monthly: "$29",
    monthlyNote: "per month + ad spend",
    cta: "Talk to sales",
    href: "/business",
    icon: Briefcase,
    features: [
      "Everything in Pro",
      "Verified business profile",
      "Up to 49 active contacts (7× free)",
      "Run targeted ads ($1+ per ad)",
      "Real-time CTR + impression analytics",
      "AI-curated placement",
      "Priority human moderation review",
    ],
    fineprint: "Stripe-powered self-serve checkout. Reach the EU + US audience.",
  },
  {
    name: "Enterprise",
    tagline: "For large organizations and ecommerce platforms.",
    monthly: "Custom",
    monthlyNote: "talk to us",
    cta: "Contact us",
    href: "mailto:info@copyme1.com?subject=CopyMe%20Enterprise",
    icon: Zap,
    features: [
      "Everything in Business",
      "Up to 350 active contacts per seat",
      "Volume ad pricing + white-glove campaign mgmt",
      "Dedicated CSM",
      "Custom data residency (EU / US)",
      "Service-level agreement",
      "API access (coming Q3)",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="mb-14 text-center max-w-2xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-0.5 mb-8">
            <span className="text-2xl font-bold text-slate-900">Copy</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">Me</span>
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
            Pricing that respects your attention.
          </h1>
          <p className="mt-4 text-base text-slate-500 leading-relaxed">
            Start free. Upgrade when you need more contacts, longer memory, or business features.
            All plans honor the Rule of 7.
          </p>
        </div>

        {/* Tier grid */}
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-4">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-3xl p-6 border ${
                t.highlight
                  ? "border-purple-300 bg-gradient-to-br from-white via-purple-50/40 to-pink-50/30 shadow-xl"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                  MOST POPULAR
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    t.highlight
                      ? "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <t.icon size={16} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{t.name}</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-5 min-h-[42px]">
                {t.tagline}
              </p>

              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">{t.monthly}</span>
                  {t.monthlyNote && (
                    <span className="text-xs text-slate-400">{t.monthlyNote}</span>
                  )}
                </div>
              </div>

              <Link
                href={t.href}
                className={`block w-full text-center px-4 py-2.5 rounded-full text-sm font-semibold mb-5 transition-shadow ${
                  t.highlight
                    ? "text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]"
                    : "text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {t.cta}
              </Link>

              <ul className="space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                    <Check size={12} className="text-purple-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {t.fineprint && (
                <p className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
                  {t.fineprint}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* FAQ-ish footer block */}
        <div className="mt-16 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            {
              q: "Why so cheap?",
              a: "Because the cost of running you is genuinely small. We pass that on instead of inventing tiers to extract margin.",
            },
            {
              q: "Why is there a 70-word cap on every plan?",
              a: "Because the Rule of 7 is the product. Removing it would be removing the reason to use CopyMe.",
            },
            {
              q: "How does ad revenue work?",
              a: "Businesses pay per ad ($1+) for targeted, human-reviewed placement. Consumers see at most a handful of relevant ads, never sold tracking data.",
            },
          ].map((f) => (
            <div key={f.q} className="p-4 rounded-2xl bg-white border border-slate-200">
              <p className="text-sm font-semibold text-slate-900">{f.q}</p>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
          >
            Start free <ArrowRight size={14} />
          </Link>
          <p className="mt-3 text-[11px] text-slate-400">
            By signing up you agree to the{" "}
            <Link href="/terms" className="underline hover:text-slate-600">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
