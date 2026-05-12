"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// /verify?token=... — email verification landing page
// ---------------------------------------------------------------------------

type Status = "loading" | "ok" | "error";

function VerifyContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setStatus("error");
          setMessage(data?.error?.message || "Verification failed.");
          return;
        }
        setStatus("ok");
        setMessage("Your email is verified.");
        setTimeout(() => router.push("/app"), 1500);
      } catch {
        setStatus("error");
        setMessage("Network error. Please try again.");
      }
    })();
  }, [token, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center"
      >
        {status === "loading" && (
          <>
            <Loader2 size={32} className="text-purple-500 mx-auto mb-4 animate-spin" />
            <p className="text-sm text-slate-500">Verifying your email…</p>
          </>
        )}
        {status === "ok" && (
          <>
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-slate-900 mb-1">Email verified!</h1>
            <p className="text-sm text-slate-500">{message}</p>
            <p className="text-xs text-slate-400 mt-4">Redirecting you to the app…</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle size={40} className="text-rose-500 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-slate-900 mb-1">Verification failed</h1>
            <p className="text-sm text-slate-500 mb-6">{message}</p>
            <Link
              href="/app"
              className="inline-block px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
            >
              Go to app
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <VerifyContent />
    </Suspense>
  );
}
