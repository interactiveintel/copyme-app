"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Phone, Mail, Lock, UserRound } from "lucide-react";
import GlassCard from "../ui/GlassCard";
import GradientButton from "../ui/GradientButton";
import WordCounter from "../ui/WordCounter";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/i18n/client";

interface AuthScreenProps {
  onLogin: () => void;
  onRegister: () => void;
}

const countryCodes = [
  { code: "+1", country: "US" },
  { code: "+44", country: "UK" },
  { code: "+91", country: "IN" },
  { code: "+86", country: "CN" },
  { code: "+81", country: "JP" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+55", country: "BR" },
  { code: "+234", country: "NG" },
  { code: "+254", country: "KE" },
];

export default function AuthScreen({ onLogin, onRegister }: AuthScreenProps) {
  const { login, register } = useAuth();
  const { t } = useLocale();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState("+1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Forgot-password modal
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    const trimmed = forgotEmail.trim();
    if (!trimmed) { setForgotError("Enter your email address."); return; }
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      // The endpoint returns a generic success regardless — just reflect it.
      if (res.ok) {
        setForgotSent(true);
      } else {
        const data = await res.json().catch(() => null);
        setForgotError(data?.error?.message || "Something went wrong. Try again.");
      }
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Login form
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleLogin = async () => {
    const errs: Record<string, string> = {};
    if (!loginPhone) errs.loginPhone = "Phone number required";
    if (!loginPassword) errs.loginPassword = "Password required";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await login(countryCode + loginPhone, loginPassword);
      onLogin();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Login failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const errs: Record<string, string> = {};
    if (!regName) errs.regName = "Display name required";
    if (regName.trim().split(/\s+/).length > 7) errs.regName = "Max 7 words";
    if (!regPhone) errs.regPhone = "Phone number required";
    if (!regEmail) errs.regEmail = "Email required";
    if (!regPassword) errs.regPassword = "Password required";
    if (regPassword.length < 8) errs.regPassword = "Min 8 characters";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await register({
        displayName: regName.trim(),
        phone: countryCode + regPhone,
        email: regEmail,
        password: regPassword,
      });
      onRegister();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Registration failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-200/30 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-pink-200/30 blur-[120px] animate-pulse" />
        <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-purple-200/20 blur-[100px] animate-pulse" />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mb-8 text-center"
      >
        <h1 className="text-5xl font-black tracking-tight">
          <span className="text-slate-900">Copy</span>
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Me
          </span>
        </h1>
        <p className="text-slate-400 text-sm mt-2">{t("auth.tagline")}</p>
      </motion.div>

      {/* Auth card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative z-10 w-full max-w-md"
      >
        <GlassCard gradient className="overflow-hidden">
          <div className="p-6">
            {/* Tab switcher */}
            <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
              {(["login", "register"] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  onClick={() => {
                    setTab(tabKey);
                    setErrors({});
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 capitalize ${
                    tab === tabKey
                      ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tabKey === "login" ? t("auth.tab.signIn") : t("auth.tab.createAccount")}
                </button>
              ))}
            </div>

            {/* Form-level error */}
            <AnimatePresence>
              {errors.form && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200"
                >
                  <p className="text-rose-600 text-xs text-center">{errors.form}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {tab === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {/* Phone */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("auth.label.phone")}</label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-slate-900 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                      >
                        {countryCodes.map((c) => (
                          <option key={c.code} value={c.code} className="bg-white">
                            {c.country} {c.code}
                          </option>
                        ))}
                      </select>
                      <div className="flex-1 relative">
                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          value={loginPhone}
                          onChange={(e) => setLoginPhone(e.target.value)}
                          placeholder={t("auth.placeholder.phoneNumber")}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                        />
                      </div>
                    </div>
                    <AnimatePresence>
                      {errors.loginPhone && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-rose-400 text-xs mt-1"
                        >
                          {errors.loginPhone}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("auth.label.password")}</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder={t("auth.placeholder.enterPassword")}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-12 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {errors.loginPassword && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-rose-400 text-xs mt-1"
                        >
                          {errors.loginPassword}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotOpen(true);
                        setForgotSent(false);
                        setForgotError("");
                      }}
                      className="text-xs bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent hover:opacity-80"
                    >
                      {t("auth.forgotPassword")}
                    </button>
                  </div>

                  <GradientButton onClick={handleLogin} className="w-full" size="lg" disabled={loading}>
                    {loading ? t("auth.signing") : t("auth.tab.signIn")}
                  </GradientButton>
                </motion.div>
              ) : (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Display Name */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs text-white/50">{t("auth.label.displayName")}</label>
                      <WordCounter text={regName} maxWords={7} />
                    </div>
                    <div className="relative">
                      <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder={t("auth.placeholder.displayName")}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                    </div>
                    <AnimatePresence>
                      {errors.regName && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-rose-400 text-xs mt-1"
                        >
                          {errors.regName}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("auth.label.phone")}</label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-slate-900 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                      >
                        {countryCodes.map((c) => (
                          <option key={c.code} value={c.code} className="bg-white">
                            {c.country} {c.code}
                          </option>
                        ))}
                      </select>
                      <div className="flex-1 relative">
                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder={t("auth.placeholder.phoneNumber")}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                        />
                      </div>
                    </div>
                    <AnimatePresence>
                      {errors.regPhone && (
                        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-rose-400 text-xs mt-1">{errors.regPhone}</motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("auth.label.email")}</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                    </div>
                    <AnimatePresence>
                      {errors.regEmail && (
                        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-rose-400 text-xs mt-1">{errors.regEmail}</motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("auth.label.password")}</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder={t("auth.placeholder.minPassword")}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-12 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {errors.regPassword && (
                        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-rose-400 text-xs mt-1">{errors.regPassword}</motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <GradientButton onClick={handleRegister} className="w-full" size="lg" disabled={loading}>
                    {loading ? t("auth.creating") : t("auth.tab.createAccount")}
                  </GradientButton>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Social proof */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-slate-400/60 text-xs mt-6"
            >
              Join <span className="text-slate-600 font-semibold">50,000+</span> users worldwide
            </motion.p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Forgot-password modal */}
      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setForgotOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-6"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-1">{t("auth.forgotPassword")}</h3>
              <p className="text-xs text-slate-500 mb-5">
                {t("auth.forgot.subtitle")}
              </p>

              {forgotSent ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-2">
                  <p className="text-sm font-semibold text-emerald-900 mb-1">
                    {t("auth.forgot.checkInbox")}
                  </p>
                  <p className="text-xs text-emerald-700">
                    {t("auth.forgot.checkInboxSubtitle")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-3">
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-400"
                      autoFocus
                    />
                  </div>
                  {forgotError && (
                    <p className="text-xs text-rose-500">{forgotError}</p>
                  )}
                  <GradientButton
                    type="submit"
                    className="w-full"
                    size="md"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? t("auth.forgot.sending") : t("auth.forgot.sendReset")}
                  </GradientButton>
                </form>
              )}

              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="w-full mt-3 text-xs text-slate-400 hover:text-slate-600"
              >
                {t("cta.close")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
