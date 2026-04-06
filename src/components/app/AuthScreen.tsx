"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Phone, Mail, Lock, UserRound } from "lucide-react";
import GlassCard from "../ui/GlassCard";
import GradientButton from "../ui/GradientButton";
import WordCounter from "../ui/WordCounter";
import { useAuth } from "@/lib/auth-context";

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
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState("+1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
        <p className="text-slate-400 text-sm mt-2">Connect. Share. Belong.</p>
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
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setErrors({});
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 capitalize ${
                    tab === t
                      ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t === "login" ? "Sign In" : "Create Account"}
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
                    <label className="text-xs text-slate-500 mb-1.5 block">Phone Number</label>
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
                          placeholder="Phone number"
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
                    <label className="text-xs text-slate-500 mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter password"
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
                    <button className="text-xs bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent hover:opacity-80">
                      Forgot password?
                    </button>
                  </div>

                  <GradientButton onClick={handleLogin} className="w-full" size="lg" disabled={loading}>
                    {loading ? "Signing In..." : "Sign In"}
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
                      <label className="text-xs text-white/50">Display Name</label>
                      <WordCounter text={regName} maxWords={7} />
                    </div>
                    <div className="relative">
                      <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Your display name"
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
                    <label className="text-xs text-slate-500 mb-1.5 block">Phone Number</label>
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
                          placeholder="Phone number"
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
                    <label className="text-xs text-slate-500 mb-1.5 block">Email</label>
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
                    <label className="text-xs text-slate-500 mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min 8 characters"
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
                    {loading ? "Creating Account..." : "Create Account"}
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
    </div>
  );
}
