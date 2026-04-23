import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Download, Sparkles, Globe, Quote } from "lucide-react";

export const metadata: Metadata = {
  title: "Press kit | CopyMe",
  description:
    "Logos, screenshots, founder bios, and one-pager for press, partners, and investors covering CopyMe.",
};

const FOUNDED = "2026";

export default function PressPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center gap-0.5 mb-8">
            <span className="text-2xl font-bold text-slate-900">Copy</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">
              Me
            </span>
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold mb-4">
            <Sparkles size={12} />
            Press kit
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
            For press, partners &amp; investors
          </h1>
          <p className="mt-3 text-base text-slate-500 max-w-2xl">
            Everything you need to write about, link to, or build alongside CopyMe.
            For interviews, embargoed news, or partnership conversations:{" "}
            <a href="mailto:interactiveintel@gmail.com" className="text-purple-600 underline">
              interactiveintel@gmail.com
            </a>
            .
          </p>
        </div>

        {/* Boilerplate */}
        <Section title="One-line description">
          <p className="text-base text-slate-700">
            CopyMe is a social messaging platform built on the &ldquo;Rule of 7&rdquo;:
            70-word messages, 7 active contacts, last 7 messages retained. Less noise,
            more meaning.
          </p>
        </Section>

        <Section title="One paragraph">
          <p className="text-sm text-slate-600 leading-relaxed">
            CopyMe is a messaging platform that uses constraints to bring meaning back
            to digital communication. Every message is capped at 70 words; every user
            holds up to 7 active contacts; only the last 7 messages per contact are
            retained. The cap forces clarity, the contact ceiling forces priority, and
            the rolling history forces presence. CopyMe pairs the constraint system
            with Yogi — an agentic AI companion that learns each user&apos;s style — and an
            ad inbox where businesses pay per ad to reach genuinely-attentive readers.
            Founded {FOUNDED} by Paul Pereira (US) and Jože Kralj (EU).
          </p>
        </Section>

        <Section title="Long version">
          <p className="text-sm text-slate-600 leading-relaxed">
            Modern messaging exhausts us. Group chats, infinite scroll, push
            notifications, and engagement-maximizing feeds have turned communication into
            noise. CopyMe takes the opposite bet: communication gets better when you
            make less of it. Built on the Rule of 7 — every message capped at 70 words,
            every user holding up to 7 active contacts, only the last 7 messages per
            contact retained — CopyMe forces every word to do work and every connection
            to matter. The platform pairs this constraint system with Yogi, an agentic
            AI companion that learns each user&apos;s communication style across
            conversations, and an AI-curated ad inbox where businesses pay per ad to
            reach an audience that&apos;s genuinely opted in to read what they have to say.
            CopyMe is operated by InteractiveIntel (US) and Pimdom d.o.o. (Slovenia).
          </p>
        </Section>

        {/* Founders */}
        <Section title="Founders">
          <div className="grid sm:grid-cols-2 gap-4">
            <Founder
              name="Paul Pereira"
              role="Co-founder · US lead"
              bio="Founder of InteractiveIntel. Builds and operates the consumer surface, AI integration, and US/global market."
              location="Miami, Florida"
            />
            <Founder
              name="Jože Kralj"
              role="Co-founder · EU lead"
              bio="Founder of Pimdom d.o.o. Drives investment strategy, EU operations, and B2B partnerships."
              location="Slovenia"
            />
          </div>
        </Section>

        {/* Brand assets */}
        <Section title="Brand assets">
          <div className="grid sm:grid-cols-2 gap-4">
            <AssetCard
              title="Logo (SVG)"
              subtitle="Scalable vector — use this for web + print"
              href="/icon.svg"
              filename="copyme-logo.svg"
            />
            <AssetCard
              title="Open Graph image (PNG)"
              subtitle="Social share preview, 1200×630"
              href="/opengraph-image"
              filename="copyme-og.png"
            />
          </div>
          <div className="mt-4 p-4 rounded-2xl border border-slate-200 bg-white">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Color
            </p>
            <div className="flex flex-wrap gap-3">
              <Swatch label="Indigo" hex="#4F46E5" />
              <Swatch label="Purple" hex="#7C3AED" />
              <Swatch label="Pink" hex="#EC4899" />
              <Swatch label="Navy" hex="#1A1A2E" />
            </div>
          </div>
        </Section>

        {/* Quotes */}
        <Section title="Sample pull-quotes">
          <div className="space-y-3">
            <PullQuote
              quote="The 70-word cap forces you to think before you type. The result? Conversations that are intentional, creative, and real."
              attribution="CopyMe product page"
            />
            <PullQuote
              quote="Every dollar of advertising buys real attention — because every message is read, by definition."
              attribution="CopyMe pitch deck"
            />
          </div>
        </Section>

        {/* Quick facts */}
        <Section title="Quick facts">
          <Facts
            items={[
              ["Founded", FOUNDED],
              ["Headquarters", "Miami, FL · Ljubljana, SI"],
              ["Stage", "Pre-seed / seed (open to angel)"],
              ["Live URL", "copyme-app.vercel.app"],
              ["Free to use", "Yes — Pro tier $9/mo, Business $29/mo"],
              ["Privacy", "GDPR-compliant, EU + US"],
            ]}
          />
        </Section>

        {/* Contact card */}
        <div className="mt-12 p-6 rounded-3xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-purple-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0">
              <Mail size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Contact</h2>
              <p className="text-sm text-slate-600 mt-1">
                Press, partnerships, investor inquiries:
              </p>
              <a
                href="mailto:interactiveintel@gmail.com"
                className="mt-2 inline-block text-sm font-semibold text-purple-600 hover:underline"
              >
                interactiveintel@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-10 text-[11px] text-slate-400 leading-relaxed">
          Use of the CopyMe wordmark and assets is permitted for editorial purposes
          (news articles, reviews, podcasts, conference materials) without prior
          permission. For commercial use, partnerships, or modifications, please
          email us first.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Founder({ name, role, bio, location }: { name: string; role: string; bio: string; location: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <p className="text-base font-bold text-slate-900">{name}</p>
      <p className="text-xs font-medium text-purple-600">{role}</p>
      <p className="mt-2 text-xs text-slate-600 leading-relaxed">{bio}</p>
      <p className="mt-2 text-[11px] text-slate-400 inline-flex items-center gap-1">
        <Globe size={11} /> {location}
      </p>
    </div>
  );
}

function AssetCard({ title, subtitle, href, filename }: { title: string; subtitle: string; href: string; filename: string }) {
  return (
    <a
      href={href}
      download={filename}
      className="group p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3 hover:border-purple-300 hover:shadow-md transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        <Download size={16} className="text-slate-500 group-hover:text-purple-600 transition-colors" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </a>
  );
}

function Swatch({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-lg shadow-sm border border-slate-200" style={{ backgroundColor: hex }} />
      <div>
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        <p className="text-[10px] text-slate-400 font-mono">{hex}</p>
      </div>
    </div>
  );
}

function PullQuote({ quote, attribution }: { quote: string; attribution: string }) {
  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
      <Quote size={14} className="text-purple-400 mb-2" />
      <p className="text-sm text-slate-700 italic leading-relaxed">{quote}</p>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
        — {attribution}
      </p>
    </div>
  );
}

function Facts({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid sm:grid-cols-2 gap-y-2 gap-x-6 p-4 rounded-2xl border border-slate-200 bg-white">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 text-xs py-1 border-b border-slate-100 last:border-b-0">
          <span className="text-slate-500">{k}</span>
          <span className="text-slate-900 font-medium text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}
