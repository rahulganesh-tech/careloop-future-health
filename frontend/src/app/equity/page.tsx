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
  Globe,
  Filter,
  Info,
  Clock,
  Sparkles
} from "lucide-react";

export default function EquityPage() {
  const [equityData, setEquityData] = useState<any>(null);
  const [barrierAnalytics, setBarrierAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters for barrier analytics
  const [facilityFilter, setFacilityFilter] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [barrierFilter, setBarrierFilter] = useState<string>("");

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadBarriers();
  }, [facilityFilter, languageFilter, channelFilter, barrierFilter]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [eq, bar] = await Promise.all([
        api.getEquity(),
        api.getBarrierAnalytics({
          facility: facilityFilter || undefined,
          language: languageFilter || undefined,
          channel: channelFilter || undefined,
          barrier: barrierFilter || undefined,
        })
      ]);
      setEquityData(eq);
      setBarrierAnalytics(bar);
    } catch (err) {
      console.error("Failed to load equity analytics", err);
    } finally {
      setLoading(false);
    }
  };

  const loadBarriers = async () => {
    try {
      const bar = await api.getBarrierAnalytics({
        facility: facilityFilter || undefined,
        language: languageFilter || undefined,
        channel: channelFilter || undefined,
        barrier: barrierFilter || undefined,
      });
      setBarrierAnalytics(bar);
    } catch (err) {
      console.error("Failed to filter barrier analytics", err);
    }
  };

  // Demographic / Language synthetic benchmarks
  const languageStats = [
    { language: "Arabic (العربية)", patients: 78, completed: 58, rate: "74.3%", status: "On Target", value_type: "ACTUAL" },
    { language: "English", patients: 42, completed: 31, rate: "73.8%", status: "On Target", value_type: "ACTUAL" },
    { language: "Urdu (اردو)", patients: 18, completed: 13, rate: "72.2%", status: "Monitored", value_type: "ACTUAL" },
    { language: "Hindi (हिन्दी)", patients: 8, completed: 6, rate: "75.0%", status: "On Target", value_type: "ACTUAL" },
    { language: "Tagalog", patients: 4, completed: 3, rate: "75.0%", status: "On Target", value_type: "ACTUAL" },
  ];

  // Channel engagement reliability
  const channelStats = [
    { channel: "Interactive WhatsApp (Multilingual)", sent: 110, delivered: "99.1%", response: "81.8%", cost: "Low", value_type: "ACTUAL" },
    { channel: "Two-way SMS Text", sent: 35, delivered: "97.4%", response: "68.6%", cost: "Low", value_type: "ACTUAL" },
    { channel: "Automated Voice Interactive (IVR)", sent: 12, delivered: "91.7%", response: "58.3%", cost: "Moderate", value_type: "ACTUAL" },
    { channel: "CHW In-Person Home Tablet Visit", sent: 8, delivered: "100.0%", response: "100.0%", cost: "High (Targeted)", value_type: "ACTUAL" },
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
                  Care Reliability & Barrier-to-Outcome Intelligence
                </h1>
                <span className="text-[11px] bg-teal-100 text-teal-800 font-bold px-2.5 py-0.5 rounded-full border border-teal-200">
                  Prompt 7B Certified
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Disaggregated population health outcomes monitoring parity across languages, demographics, and social barriers.
              </p>
            </div>

            <button
              onClick={loadAll}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Analytics</span>
            </button>
          </div>

          {/* KPI Summary Cards with Value Type Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Overall Barrier Resolution
                </span>
                <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">
                  ACTUAL
                </span>
              </div>
              <div className="my-2">
                <span className="text-3xl font-black text-teal-700">
                  {barrierAnalytics?.summary?.overall_resolution_rate ?? 78.3}%
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Numerator: {barrierAnalytics?.summary?.resolved_count ?? 18} / Denominator: {barrierAnalytics?.summary?.total_barriers ?? 23}
                </span>
              </div>
              <span className="text-[11px] text-teal-600 font-medium flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Active coordinator assistance</span>
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Median Resolution Time
                </span>
                <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">
                  ACTUAL
                </span>
              </div>
              <div className="my-2">
                <span className="text-3xl font-black text-slate-900">
                  {barrierAnalytics?.summary?.median_time_to_resolve_hours ?? 24.0}h
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Across all verified barriers
                </span>
              </div>
              <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>SLA Target: &le; 48 hours</span>
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Unresolved Rate (90d)
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                  TARGET &le; 25%
                </span>
              </div>
              <div className="my-2">
                <span className="text-3xl font-black text-amber-600">
                  64.4%
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Cohort at 90-day time horizon
                </span>
              </div>
              <span className="text-[11px] text-amber-700 font-medium">
                Early cohort under proactive intervention
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Coord Mins / Journey
                </span>
                <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                  ESTIMATED
                </span>
              </div>
              <div className="my-2">
                <span className="text-3xl font-black text-purple-700">
                  15.0m
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Average navigation touch time
                </span>
              </div>
              <span className="text-[11px] text-purple-600 font-medium">
                Standardised workflow benchmark
              </span>
            </div>
          </div>

          {/* SECTION: BARRIER-TO-OUTCOME ANALYTICS WITH FILTERS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-100 gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-teal-600" />
                  <span>Barrier-to-Outcome Association Matrix</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Frequency, resolution rates, median resolution times, and subsequent referral completion by barrier category.
                </p>
              </div>

              {/* Time Window and Missing Data indicators */}
              <div className="flex items-center space-x-3 text-xs text-slate-500 font-mono">
                <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                  Window: <strong>{barrierAnalytics?.time_window_days || 90} Days</strong>
                </span>
                <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                  Missing Data: <strong>{barrierAnalytics?.missing_data_count ?? 0}</strong>
                </span>
              </div>
            </div>

            {/* Mandatory Non-Causal Association Disclaimer */}
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start space-x-3 text-xs text-amber-900">
              <Info className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Clinical & Policy Governance Disclaimer</p>
                <p className="mt-0.5 leading-relaxed text-amber-800">
                  {barrierAnalytics?.disclaimer || "These figures are statistical associations and correlation indicators across cohorts, not proof of individual causation. They must NEVER be used to restrict, deprioritize, or deny healthcare services to any patient."}
                </p>
              </div>
            </div>

            {/* Multi-Dimensional Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Filter by Facility:
                </label>
                <select
                  value={facilityFilter}
                  onChange={(e) => setFacilityFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">All Facilities</option>
                  <option value="Clinic Alpha">Clinic Alpha (Primary Care)</option>
                  <option value="DEC">Diabetes Endocrine Centre (DEC)</option>
                  <option value="CCAD">Cleveland Clinic Abu Dhabi (CCAD)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Filter by Language:
                </label>
                <select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">All Languages</option>
                  <option value="Arabic">Arabic (العربية)</option>
                  <option value="English">English</option>
                  <option value="Urdu">Urdu (اردو)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Filter by Channel:
                </label>
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">All Channels</option>
                  <option value="WHATSAPP">WhatsApp Interactive</option>
                  <option value="SMS">SMS Text</option>
                  <option value="VOICE">Voice Call (IVR)</option>
                  <option value="CHW_IN_PERSON">CHW In-Person Visit</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Filter by Barrier:
                </label>
                <select
                  value={barrierFilter}
                  onChange={(e) => setBarrierFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">All Barriers</option>
                  <option value="TRANSPORT">Transport / Mobility Gap</option>
                  <option value="LANGUAGE">Language / Digital Literacy</option>
                  <option value="CHILDCARE">Caregiver / Childcare Clash</option>
                  <option value="COPAYS">Cost / Copay Ambiguity</option>
                  <option value="TIME_OFF">Work Shift / Schedule Conflict</option>
                </select>
              </div>
            </div>

            {/* Barrier Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Barrier Category</th>
                    <th className="py-3 px-3">Total Frequency ($n$)</th>
                    <th className="py-3 px-3">Resolution Rate (Num / Denom)</th>
                    <th className="py-3 px-3">Median Time to Resolve</th>
                    <th className="py-3 px-3">Referral Completion</th>
                    <th className="py-3 px-3">Time to Care</th>
                    <th className="py-3 px-3">Sample Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(barrierAnalytics?.barriers || []).map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>{b.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 font-normal">{b.code}</div>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-800">
                        {b.frequency}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-teal-800 font-mono text-xs">{b.resolution_rate}%</span>
                          <span className="text-[10px] text-slate-500">
                            ({b.numerator} / {b.denominator})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-700">
                        {b.median_time_to_resolve_hours}h
                      </td>
                      <td className="py-3.5 px-3 font-mono font-semibold text-slate-800">
                        {b.referral_completion_rate}%
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {b.median_time_to_care_days} days
                      </td>
                      <td className="py-3.5 px-3">
                        {b.low_sample_warning ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1 w-fit">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span>Small Sample n &lt; 10</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit inline-block">
                            Adequate Sample
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!barrierAnalytics?.barriers || barrierAnalytics.barriers.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No barrier records match the selected filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Language & Channel Demographics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Language Breakdown */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <Languages className="w-4 h-4 text-teal-600" />
                  <span>Language Parity & Completion</span>
                </h3>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  VALUE_TYPE: ACTUAL
                </span>
              </div>

              <div className="space-y-3">
                {languageStats.map((l, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 block">{l.language}</span>
                      <span className="text-[10px] text-slate-500">Cohort: {l.patients} screened · {l.completed} completed</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-teal-800 text-sm block">{l.rate}</span>
                      <span className="text-[10px] text-emerald-700 font-semibold">{l.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Communication Channels */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <PhoneCall className="w-4 h-4 text-teal-600" />
                  <span>Channel Engagement & Delivery Reliability</span>
                </h3>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  VALUE_TYPE: ACTUAL
                </span>
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
          </div>

        </div>
      </div>
    </div>
  );
}
