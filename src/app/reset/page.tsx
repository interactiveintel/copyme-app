"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Check, AlertCircle, Eye, EyeOff } from "lucide-react";

// ---------------------------------------------------------------------------
// /reset?token=... — password reset confirmation page
// ---------------------------------------------------------------------------

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("Missing reset token. Please use the link from your email.");
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.error?.message || "Reset failed. The link may have expired.");
        return;
      }
      // Server returns tokens — store them so the user is logged in.
      localStorage.setItem("copyme_auth", JSON.stringify(data.data));
      setDone(true);
      setTimeout(() => router.push("/app"), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8"
      >
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Reset your password
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Choose a new password for your CopyMe account.
        </p>

        {done ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <Check size={20} className="text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">Password updated</p>
              <p className="text-xs text-emerald-700">Redirecting you to the app…</p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">New password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-12 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Confirm password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
                <AlertCircle size={14} className="text-rose-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-rose-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ResetForm />
    </Suspense>
  );
}
