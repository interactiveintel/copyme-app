import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import RuleOf7 from "@/components/landing/RuleOf7";
import ExplainerVideo from "@/components/landing/ExplainerVideo";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://copyme-app.vercel.app",
  ),
  title: "CopyMe — Communication That Matters · Your World's chart of Communication",
  description:
    "Communication That Matters. Your World's chart of Communication. Rule of 7 — a revolutionary constraint system that replaces noise with meaning. Less is more, giving meaning to messages. Infinite impact.",
  keywords: [
    "messaging",
    "communication",
    "Rule of 7",
    "AI messaging",
    "intentional communication",
  ],
  openGraph: {
    title: "CopyMe — Communication That Matters",
    description:
      "Your World's chart of Communication. Rule of 7 — a revolutionary constraint system that replaces noise with meaning.",
    type: "website",
    siteName: "CopyMe",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CopyMe — Communication That Matters",
    description:
      "Your World's chart of Communication. Rule of 7 — a revolutionary constraint system that replaces noise with meaning. Infinite impact.",
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Features />
      <RuleOf7 />
      <ExplainerVideo />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
