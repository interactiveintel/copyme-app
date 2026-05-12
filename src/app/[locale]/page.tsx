"use client";

// Localised landing page (S-254 / Tier C10).
//
// Mirror of `src/app/page.tsx` with a server-rendered locale segment. Marked
// as a client component because we pass a translation closure (`t`) down to
// Hero / Navbar / Footer — Next 15 forbids passing functions across the
// server→client boundary, so the page itself sits on the client side. The
// sibling `layout.tsx` is server-rendered and owns:
//   - `generateStaticParams` (build-time pre-render of every locale)
//   - `generateMetadata` (per-locale OG / Twitter tags)
//   - `notFound()` for invalid locale slugs
// so SSR is preserved end-to-end and unsupported locales 404 before the
// page bundle is sent.
//
// `tFor(locale)` is a pure closure over the STRINGS table — it does not
// mutate the global `active` locale, so concurrent renders for different
// languages don't race.

import { useParams } from "next/navigation";

import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import RuleOf7 from "@/components/landing/RuleOf7";
import ExplainerVideo from "@/components/landing/ExplainerVideo";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

import { isSupportedLocale, tFor } from "@/lib/i18n/server";

export default function LocaleHome() {
  const params = useParams<{ locale: string }>();
  // Layout already validated this and called notFound() for invalid slugs,
  // so by the time we render here `params.locale` is always supported. The
  // guard below is defensive — falls back to English so the UI never crashes.
  const locale = isSupportedLocale(params?.locale) ? params.locale : "en";
  const tt = tFor(locale);
  return (
    // Per-page lang override on the wrapper so screen readers + translation
    // tools honour the right language for descendants. The root <html lang>
    // stays "en" because the root layout is shared across all routes.
    <main lang={locale} className="min-h-screen bg-white">
      <Navbar t={tt} />
      <Hero t={tt} />
      <Features />
      <RuleOf7 />
      <ExplainerVideo />
      <Pricing />
      <CTA />
      <Footer t={tt} />
    </main>
  );
}
