"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Play, Sparkles } from "lucide-react";
import { useState } from "react";

// ---------------------------------------------------------------------------
// ExplainerVideo — env-var-gated video embed.
//
// When NEXT_PUBLIC_EXPLAINER_VIDEO_URL is set (any embeddable URL — YouTube
// /embed, Vimeo player, Loom share, Mux), we render a click-to-play card
// that swaps to an iframe on first interaction.
//
// When unset, we render a polished "Watch the demo" card linking to the
// in-app DemoModal — keeps the section visible without showing a broken
// embed during pre-launch.
// ---------------------------------------------------------------------------

export default function ExplainerVideo() {
  const url = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_URL;
  const [playing, setPlaying] = useState(false);

  return (
    <section id="watch" className="relative py-20 sm:py-24 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white">
      <div className="orb w-[500px] h-[500px] bg-purple-500/10 top-[-20%] right-[-10%]" />
      <div className="orb w-[400px] h-[400px] bg-pink-500/10 bottom-[-20%] left-[-10%]" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-semibold mb-4 shadow-sm">
            <Sparkles size={12} className="text-purple-500" />
            See it in 90 seconds
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
            What does communication look like when{" "}
            <span className="gradient-text">noise stops</span>?
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900"
        >
          {url && playing ? (
            <iframe
              src={url}
              title="CopyMe explainer"
              className="absolute inset-0 w-full h-full"
              frameBorder={0}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              onClick={() => {
                if (url) {
                  setPlaying(true);
                } else {
                  // No video configured — scroll to the in-app demo CTA.
                  const cta = document.getElementById("cta");
                  cta?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 group cursor-pointer"
              aria-label={url ? "Play explainer video" : "See the interactive demo"}
            >
              {/* Play button */}
              <div className="w-20 h-20 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-2xl shadow-purple-500/40 transition-transform group-hover:scale-110">
                <Play size={28} className="text-purple-600 ml-1" />
              </div>
              <p className="text-white/90 text-sm font-medium">
                {url ? "Play video" : "Watch the interactive demo"}
              </p>
              {!url && (
                <p className="text-white/50 text-[10px]">
                  (Set NEXT_PUBLIC_EXPLAINER_VIDEO_URL to embed a video here.)
                </p>
              )}
            </button>
          )}
        </motion.div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Or{" "}
          <Link href="/app" className="text-purple-600 font-semibold hover:underline">
            try the live app
          </Link>
          {" — "}it&apos;s free.
        </p>
      </div>
    </section>
  );
}
