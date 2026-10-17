"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import { api } from "@/lib/api";
import {
  TrendingUp,
  Users,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Languages,
  Bus,
  PhoneCall,
  MessageSquare,
  BarChart3,
  RefreshCw,
  Globe
} from "lucide-react";

export default function EquityPage() {
  const [equityData, setEquityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEquity();
  }, []);

  const loadEquity = async () => {
    try {
      setLoading(true);
      const data = await api.getEquity();
      setEquityData(data);
    } catch (err) {
      console.error("Failed to load equity analytics", err);
    } finally {
      setLoading(false);
    }
  };

  // Demographic / Language synthetic benchmarks
  const languageStats = [
    { language: "Arabic (العربية)", patients: 78, completed: 58, rate: "74.3%", status: "On Target" },
    { language: "English", patients: 42, completed: 31, rate: "73.8%", status: "On Target" },
    { language: "Urdu (اردو)", patients: 18, completed: 13, rate: "72.2%", status: "Monitored" },
    { language: "Hindi (हिन्दी)", patients: 8, completed: 6, rate: "75.0%", status: "On Target" },
    { language: "Tagalog", patients: 4, completed: 3, rate: "75.0%", status: "On Target" },
  ];

  // Channel engagement reliability
  const channelStats = [
    { channel: "Interactive WhatsApp (Multilingual)", sent: 110, delivered: "99.1%", response: "81.8%", cost: "Low" },
    { channel: "Two-way SMS Text", sent: 35, delivered: "97.4%", response: "68.6%", cost: "Low" },
    { channel: "Automated Voice Interactive (IVR)", sent: 12, delivered: "91.7%", response: "58.3%", cost: "Moderate" },
    { channel: "CHW In-Person Home Tablet Visit", sent: 8, delivered: "100.0%", response: "100.0%", cost: "High (Targeted)" },
  ];

  // Barrier mitigation resolution metrics
  const barrierMitigation = [
    { type: "Transport / Mobility Gap", total: 14, mitigated: 12, resolutionRate: "85.7%", intervention: "DoH Mobility Van Voucher" },
    { type: "Language / Digital Literacy", total: 11, mitigated: 10, resolutionRate: "90.9%", intervention: "Bilingual CHW Tablet Session" },
    { type: "Shift Work / Time Clash", total: 9, mitigated: 7, resolutionRate: "77.8%", intervention: "Weekend / Evening Fast-track" },
    { type: "Cost / Copay Ambiguity", total: 6, mitigated: 6, resolutionRate: "100.0%", intervention: "Thiqa / Basic Copay Exemption" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <SyntheticBanner />

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-6 h-6 text-teal-600" />
                <h1 className="text-2xl font-bold text-slate-900">
                  Care Reliability & Health Equity Intelligence
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Disaggregated population health outcomes monitoring parity across languages, demographics, and social barriers.
              </p>
            </div>

            <button
              onClick={loadEquity}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Analytics</span>
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Disparity Parity Index
              </span>
              <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                98.2%
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Max disparity delta &lt; 2.5% across languages
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Social Barriers Detected
              </span>
              <div className="text-2xl font-black text-amber-600 mt-1 font-mono">
                40 Cases
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                87.5% resolved before referral deadline
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                App-Free Routing Reach
              </span>
              <div className="text-2xl font-black text-teal-700 mt-1 font-mono">
                94.8%
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Zero app downloads required
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                CHW Assisted Completions
              </span>
              <div className="text-2xl font-black text-indigo-700 mt-1 font-mono">
                8 of 8
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                100% loop closure for high-risk elderly
              </span>
            </div>
          </div>

          {/* Disaggregated Language Parity Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <Languages className="w-4 h-4 text-teal-600" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Care Loop Completion by Preferred Language
                </h2>
              </div>
              <span className="text-xs text-slate-400">Target Benchmark: &ge; 70%</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6">Language & Dialect</th>
                    <th className="py-3 px-6">Actionable Patients</th>
                    <th className="py-3 px-6">Care Loops Completed</th>
                    <th className="py-3 px-6">Completion Rate</th>
                    <th className="py-3 px-6 text-right">Equity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {languageStats.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-6 font-semibold text-slate-900">{item.language}</td>
                      <td className="py-3 px-6 font-mono">{item.patients}</td>
                      <td className="py-3 px-6 font-mono text-emerald-700 font-bold">{item.completed}</td>
                      <td className="py-3 px-6 font-mono font-bold text-slate-800">{item.rate}</td>
                      <td className="py-3 px-6 text-right">
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Two-Column: Communication Channels & Barrier Mitigations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Communication Channels */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <PhoneCall className="w-4 h-4 text-teal-600" />
                  <span>Channel Delivery & Teach-back Engagement</span>
                </h3>
              </div>

              <div className="space-y-3">
                {channelStats.map((ch, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{ch.channel}</span>
                      <span className="text-[11px] font-mono font-bold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded">
                        Resp: {ch.response}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Volume: {ch.sent} interactions</span>
                      <span>Delivery Reliability: {ch.delivered}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Barrier Mitigations */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <Bus className="w-4 h-4 text-teal-600" />
                  <span>Access Barrier Resolutions</span>
                </h3>
              </div>

              <div className="space-y-3">
                {barrierMitigation.map((b, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{b.type}</span>
                      <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                        {b.resolutionRate} Resolved
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>{b.mitigated} of {b.total} assisted</span>
                      <span className="text-teal-700 italic">{b.intervention}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
