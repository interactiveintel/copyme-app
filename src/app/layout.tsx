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

export const metadata: Metadata = {
  title: "CopyMe — Communication That Matters",
  description:
    "Your World's heart of Communication. Rule of 7 — a revolutionary constraint system that replaces noise with meaning.",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
  ],
  themeColor: "#4F46E5",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CopyMe",
  },
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
        {children}
        <CookieBanner />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
