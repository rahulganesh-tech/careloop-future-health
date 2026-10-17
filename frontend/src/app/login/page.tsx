"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ShieldCheck, KeyRound, UserCheck, ArrowRight, AlertCircle } from "lucide-react";
import { api, setToken, setCurrentUser } from "@/lib/api";

const DEMO_USERS = [
  { role: "PM", name: "Noura Al-Zaabi", email: "pm@careloop.demo", desc: "Programme Manager · Macro oversight & SLAs" },
  { role: "COORD", name: "Mariam Al-Hosani", email: "coord@careloop.demo", desc: "Care Navigator · Unstick stalled cases & calls" },
  { role: "GP", name: "Dr. Ahmed Al-Mansouri", email: "gp@careloop.demo", desc: "Referring Clinician · Review, refer & sign off" },
  { role: "SPEC", name: "Dr. Tariq Al-Hashimi", email: "specialist@careloop.demo", desc: "Receiving Specialist · Referral inbox & outcome" },
  { role: "CHW", name: "Zainab Al-Baloushi", email: "chw@careloop.demo", desc: "Community Health Worker · Assisted tablet mode" },
  { role: "AUDITOR", name: "Hamad Al-Kaabi", email: "auditor@careloop.demo", desc: "Auditor · Cryptographic chain verification" },
  { role: "ADMIN", name: "Sultan Al-Dhaheri", email: "admin@careloop.demo", desc: "System Admin · Rules, facilities, users" }
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("pm@careloop.demo");
  const [password, setPassword] = useState("demo123");
  const [otpCode, setOtpCode] = useState("482913");
  const [stage, setStage] = useState<"credentials" | "otp">("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      if (res.stage === "otp") {
        setStage("otp");
      } else {
        setToken(res.token);
        setCurrentUser(res.user);
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyOtp(email, otpCode);
      if (res.token) {
        setToken(res.token);
        setCurrentUser(res.user);
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (demoUser: typeof DEMO_USERS[0]) => {
    setEmail(demoUser.email);
    setPassword("demo123");
    setOtpCode("482913");
    setStage("credentials");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-teal-800 text-teal-300 mx-auto flex items-center justify-center shadow-md">
          <Activity className="w-7 h-7 text-teal-300" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          HealthPulse AI CareLoop
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Closing the Screening-to-Care Loop · Department of Health Abu Dhabi
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {stage === "credentials" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <span className="text-[11px] text-slate-500">Demo: demo123</span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-teal-800 hover:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-700 transition"
              >
                {loading ? "Authenticating..." : "Sign In with Credentials"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-teal-700 flex-shrink-0" />
                <div>
                  <p className="font-semibold">2-Step Clinical Verification Required</p>
                  <p className="text-[11px] text-teal-800">
                    Enter the authorized 6-digit OTP code sent to your mobile.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">6-Digit OTP Code</label>
                  <span className="text-[11px] font-mono text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">
                    Demo Code: 482913
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  className="mt-1 block w-full text-center tracking-widest font-mono text-lg rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setStage("credentials")}
                  className="w-1/3 py-2 px-3 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-teal-800 hover:bg-teal-900 transition"
                >
                  {loading ? "Verifying..." : "Verify OTP & Enter"}
                </button>
              </div>
            </form>
          )}

          {/* Quick Persona Picker */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Demo Persona (Click to autofill)
            </p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.role}
                  type="button"
                  onClick={() => handleQuickSelect(u)}
                  className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                    email === u.email
                      ? "bg-teal-50 border-teal-500 text-teal-900 font-semibold"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <div>
                    <span className="font-bold text-teal-800 mr-2">[{u.role}]</span>
                    <span>{u.name}</span>
                    <p className="text-[10px] text-slate-500 font-normal">{u.desc}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
