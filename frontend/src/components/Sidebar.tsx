"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  FileText,
  Users,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  Stethoscope,
  PhoneCall,
  Sliders,
  Database,
  ExternalLink,
  Languages,
  LogOut,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Zap
} from "lucide-react";
import { getCurrentUser, removeToken, setToken, setCurrentUser, API_BASE_URL } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { role: "PM", email: "pm@careloop.demo", name: "Noura Al-Zaabi", title: "Programme Manager" },
  { role: "COORD", email: "coord@careloop.demo", name: "Mariam Al-Hosani", title: "Care Navigator" },
  { role: "GP", email: "gp@careloop.demo", name: "Dr. Ahmed Al-Mansouri", title: "Referring GP (Clinic Alpha)" },
  { role: "SPEC", email: "specialist@careloop.demo", name: "Dr. Tariq Al-Hashimi", title: "Endocrinologist (DEC)" },
  { role: "CHW", email: "chw@careloop.demo", name: "Zainab Al-Baloushi", title: "Community Worker" },
  { role: "AUDITOR", email: "auditor@careloop.demo", name: "Hamad Al-Kaabi", title: "Compliance Auditor" },
  { role: "ADMIN", email: "admin@careloop.demo", name: "Sultan Al-Dhaheri", title: "System Admin" }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isRTL, setIsRTL] = useState(false);
  const [score, setScore] = useState<number>(64);

  useEffect(() => {
    setUser(getCurrentUser());
    const storedRTL = localStorage.getItem("careloop_rtl") === "true";
    setIsRTL(storedRTL);
    document.documentElement.dir = storedRTL ? "rtl" : "ltr";
  }, []);

  const toggleRTL = () => {
    const next = !isRTL;
    setIsRTL(next);
    localStorage.setItem("careloop_rtl", String(next));
    document.documentElement.dir = next ? "rtl" : "ltr";
  };

  const handleQuickSwitch = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: acc.email, otp_code: "482913" })
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
        setUser(data.user);
        router.refresh();
      }
    } catch (e) {
      console.error("Quick switch error:", e);
    }
  };

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  const navItems = [
    { label: isRTL ? "لوحة مؤشر التكامل" : "Loop Dashboard", href: "/dashboard", icon: Activity, roles: ["PM", "COORD", "AUDITOR", "ADMIN", "GP"] },
    { label: isRTL ? "محاكي التعافي والحواجز" : "Recovery Simulator", href: "/recovery", icon: Zap, roles: ["PM", "COORD", "ADMIN", "GP"] },
    { label: isRTL ? "حالات تتطلب إجراء" : "Needs Action Now", href: "/queue", icon: AlertCircle, roles: ["COORD", "PM", "GP", "ADMIN"] },
    { label: isRTL ? "قائمة ومسار الحالات" : "Case Journeys", href: "/cases", icon: FileText, roles: ["GP", "COORD", "SPEC", "PM", "ADMIN", "SCR"] },
    { label: isRTL ? "صندوق الإحالات التخصصية" : "Specialist Referrals", href: "/referrals", icon: GitBranch, roles: ["SPEC", "ADMIN"] },
    { label: isRTL ? "استشارات الأطباء الفورية" : "Micro-Consults", href: "/consults", icon: Stethoscope, roles: ["GP", "SPEC", "ADMIN"] },
    { label: isRTL ? "وضع العامل الصحي (التابلت)" : "CHW Assisted Mode", href: "/chw", icon: PhoneCall, roles: ["CHW", "COORD", "ADMIN"] },
    { label: isRTL ? "العدالة والوصول للرعاية" : "Reliability & Equity", href: "/equity", icon: TrendingUp, roles: ["PM", "AUDITOR", "ADMIN"] },
    { label: isRTL ? "محرك القواعد والمدد" : "Rules & SLAs", href: "/rules", icon: Sliders, roles: ["PM", "ADMIN"] },
    { label: isRTL ? "سجل التدقيق المشفر" : "Audit Trail", href: "/audit", icon: ShieldCheck, roles: ["AUDITOR", "PM", "ADMIN"] },
    { label: isRTL ? "معايير الامتثال والحوكمة" : "Compliance Checklist", href: "/compliance", icon: CheckCircle2, roles: ["PM", "ADMIN", "AUDITOR"] },
  ];

  const currentRole = user?.role || "PM";

  return (
    <aside className="w-64 bg-[#0A333E] text-slate-100 flex flex-col justify-between border-r border-[#07262E] min-h-screen flex-shrink-0 shadow-lg select-none">
      <div>
        {/* Brand header */}
        <div className="p-5 border-b border-[#0F4C5C]/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 font-bold">
              <Activity className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center">
                HealthPulse
                <span className="ml-1 text-[10px] uppercase font-semibold bg-teal-500/30 text-teal-300 px-1.5 py-0.5 rounded">
                  Loop
                </span>
              </h1>
              <p className="text-[11px] text-teal-200/70">Population Health CareLoop</p>
            </div>
          </div>
          <button
            onClick={toggleRTL}
            title="Toggle Arabic RTL Layout"
            className="p-1.5 rounded-md hover:bg-white/10 text-teal-200 hover:text-white text-xs flex items-center"
          >
            <Languages className="w-4 h-4" />
          </button>
        </div>

        {/* User Card */}
        <div className="mx-3 my-3 p-3 rounded-lg bg-[#07262E]/80 border border-[#0F4C5C]/40 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-teal-300 font-semibold flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 inline mr-1" />
              {user?.role || "GUEST"}
            </span>
            <span className="text-[10px] text-teal-200/60 bg-teal-900/60 px-2 py-0.5 rounded">
              Active Session
            </span>
          </div>
          <p className="text-sm font-semibold text-white mt-1 truncate">{user?.name || "Demo User"}</p>
          <p className="text-[11px] text-teal-200/80 truncate">{user?.email || "pm@careloop.demo"}</p>
        </div>

        {/* Navigation list */}
        <nav className="px-2 py-2 space-y-1">
          {navItems
            .filter((item) => item.roles.includes(currentRole))
            .map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    active
                      ? "bg-teal-500 text-white shadow-sm"
                      : "text-slate-300 hover:bg-[#0F4C5C]/50 hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-white" : "text-teal-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
                </Link>
              );
            })}
        </nav>
      </div>

      {/* Demo Switcher & Patient Links */}
      <div className="p-3 border-t border-[#0F4C5C]/50 space-y-3 bg-[#07262E]/50">
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-teal-300/80 block mb-1">
            Demo Persona Switcher
          </label>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.role}
                onClick={() => handleQuickSwitch(acc)}
                className={`px-2 py-1 text-left rounded truncate transition border ${
                  user?.role === acc.role
                    ? "bg-teal-600 text-white border-teal-400 font-bold"
                    : "bg-[#0A333E] text-slate-300 hover:bg-[#0F4C5C] border-[#0F4C5C]/40"
                }`}
                title={`${acc.name} (${acc.title})`}
              >
                {acc.role}: {acc.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Patient App-free Demo Launcher */}
        <div className="pt-1">
          <label className="text-[10px] uppercase font-bold tracking-wider text-teal-300/80 block mb-1">
            Patient App-Free Links
          </label>
          <div className="space-y-1 text-[11px]">
            <Link
              href="/p/CASE-1001?token=patient_demo_PT-0001"
              target="_blank"
              className="flex items-center justify-between px-2 py-1 rounded bg-teal-950/80 text-teal-200 hover:bg-teal-900 border border-teal-800/40 text-[10px]"
            >
              <span>CASE-1001 (HbA1c 8.4%)</span>
              <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
            </Link>
            <Link
              href="/p/CASE-1004?token=patient_demo_PT-0004"
              target="_blank"
              className="flex items-center justify-between px-2 py-1 rounded bg-red-950/80 text-red-200 hover:bg-red-900 border border-red-800/40 text-[10px]"
            >
              <span>CASE-1004 (Critical 11.2%)</span>
              <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
            </Link>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 text-xs text-rose-300 hover:text-white hover:bg-rose-900/40 rounded transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
