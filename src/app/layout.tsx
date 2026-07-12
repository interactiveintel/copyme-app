import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import CookieBanner from "@/components/common/CookieBanner";
import ServiceWorkerRegistration from "@/components/common/ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://copyme1.com"
)
  .trim()
  .replace(/\/+$/, "");
const SITE_TITLE = "CopyMe — Communication That Matters";
const SITE_DESCRIPTION =
  "Your World's heart of Communication. Rule of 7 — a revolutionary constraint system that replaces noise with meaning. Chat with anyone, anywhere, across 100+ languages.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "CopyMe",
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
  themeColor: "#4F46E5",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "CopyMe",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CopyMe",
  },
};

// AEO/SEO: structured data so search + answer engines understand what CopyMe
// is. Rendered server-side into the initial HTML (crawlable without JS).
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "CopyMe",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "CopyMe",
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#org` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "CopyMe",
      applicationCategory: "CommunicationApplication",
      operatingSystem: "Web, iOS, Android",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      offers: {
        "@type": "Offer",
        category: "SaaS",
        priceCurrency: "USD",
      },
      featureList: [
        "Rule of 7 intentional-messaging constraint",
        "Real-time translation across 100+ languages",
        "Cross-platform chat",
      ],
      publisher: { "@id": `${SITE_URL}/#org` },
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the per-request nonce that middleware sets via x-nonce. Just
  // calling headers() here marks the layout as dynamic so Next.js
  // re-renders per request and auto-applies the nonce to its internal
  // bootstrap + RSC streaming scripts. We don't currently emit our own
  // inline <script> tags; if we add any, attach `nonce={nonce}` to them.
  // See: https://nextjs.org/docs/app/guides/content-security-policy
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  void nonce; // intentionally unused for now — read side-effect is the point

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <CookieBanner />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
