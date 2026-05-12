// Locale segment layout (S-254 / Tier C10).
//
// Server boundary: owns `generateStaticParams` and `generateMetadata` so the
// per-locale OG tags + sitemap entries get baked at build time, then renders
// children. We deliberately do not emit an <html>/<body> wrapper here — those
// belong to the root layout, and Next 15 forbids two `<html>` elements in
// one render tree. The `<html lang>` override happens via a per-page wrapper
// `lang` attribute (see page.tsx) which screen readers and translation
// tooling honour for descendants.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { isSupportedLocale, tFor } from "@/lib/i18n/server";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    // 404 path — page.tsx will call notFound(), this metadata is just
    // a fallback so the framework doesn't crash before the page renders.
    return { title: "CopyMe" };
  }
  const tt = tFor(locale);
  const h1 = tt("hero.h1");
  const lead = tt("hero.subhead.lead");
  const body = tt("hero.subhead.body");
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL || "https://copyme1.com",
    ),
    title: `CopyMe — ${h1}`,
    description: `${lead} — ${body}`,
    openGraph: {
      title: `CopyMe — ${h1}`,
      description: `${lead} — ${body}`,
      type: "website",
      siteName: "CopyMe",
      locale,
    },
    twitter: {
      card: "summary_large_image",
      title: `CopyMe — ${h1}`,
      description: `${lead} — ${body}`,
    },
  };
}

export default async function LocaleLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  return <>{children}</>;
}
