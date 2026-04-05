"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

export default function CTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        const msg = typeof data.error === "string" ? data.error : data.error?.message || "Something went wrong. Try again.";
        setError(msg);
        return;
      }

      setSubmitted(true);
      setEmail("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-slate-900">
            Ready to{" "}
            <span className="gradient-text">Transform</span>{" "}
            Communication?
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            Join the movement toward intentional messaging. Be among the first to
            experience communication built around meaning, not noise.
          </p>

          {/* Email Capture */}
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-10 flex items-center justify-center gap-3 p-4 rounded-2xl bg-white border border-accent-emerald/30 shadow-sm max-w-md mx-auto"
              >
                <div className="w-10 h-10 rounded-full bg-accent-emerald/10 flex items-center justify-center">
                  <Check size={20} className="text-accent-emerald" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">You&apos;re on the list!</p>
                  <p className="text-xs text-slate-500">We&apos;ll notify you when CopyMe launches.</p>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="mt-10 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              >
                <div className="flex-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="Enter your email"
                    className="w-full rounded-full px-6 py-3.5 text-sm text-slate-900 bg-white border border-slate-200 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                  />
                  {error && (
                    <p className="mt-1.5 text-xs text-red-500 text-left pl-4">{error}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white gradient-bg-animated transition-shadow hover:shadow-[0_0_40px_rgba(124,58,237,0.5)] whitespace-nowrap disabled:opacity-70"
                >
                  {loading ? "Joining..." : "Join Waitlist"}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

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
            <span className="text-sm text-slate-500">
              Join <span className="text-slate-900 font-semibold">50,000+</span> on the waitlist
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
