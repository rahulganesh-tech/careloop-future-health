"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  GitBranch,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  Users,
  ChevronRight,
  RefreshCw,
  HelpCircle,
  AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Connect to WebSocket /ws/live for dynamic updates
    let ws: WebSocket;
    try {
      ws = new WebSocket("ws://localhost:8000/ws/live");
      ws.onmessage = () => {
        loadData();
      };
    } catch {
      // WebSocket optional
    }
    return () => {
      if (ws) ws.close();
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700"></div>
            <p className="text-xs text-slate-500 font-medium">Computing Loop Integrity Score...</p>
          </div>
        </div>
      </div>
    );
  }

  const score = data?.loop_integrity_score ?? 64;
  const kpis = data?.kpis || {};
  const breakdown = data?.score_breakdown || [];
  const funnel = data?.funnel || [];
  const dropOff = data?.drop_off_reasons || [];
  const overdueCases = data?.overdue_cases_list || [];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar />

      <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl">
        {/* Header banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Loop Integrity Dashboard
              </h1>
              <span className="text-[11px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full">
                DIAB-HBA1C v1
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Which patients are stuck, where is the loop breaking, and what is the next verified clinical action?
            </p>
          </div>
          <button
            onClick={loadData}
            className="mt-3 sm:mt-0 flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Section: Loop Integrity Score Card + Core KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Loop Integrity Score Gauge */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#0A333E] to-[#0F4C5C] text-white p-6 rounded-xl shadow-md border border-teal-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-teal-300 flex items-center space-x-1">
                  <Activity className="w-4 h-4 mr-1 text-teal-400" />
                  Loop Integrity Score
                </span>
                <span className="text-[11px] bg-teal-900/80 border border-teal-500/40 text-teal-200 px-2 py-0.5 rounded-full">
                  Explainable 0–100
                </span>
              </div>
              <div className="flex items-baseline space-x-3 my-3">
                <span className="text-5xl font-black tracking-tight text-white">{score}</span>
                <span className="text-lg text-teal-200/70 font-semibold">/ 100</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ml-auto ${
                  score >= 75 ? "bg-emerald-500/30 text-emerald-300" : "bg-amber-500/30 text-amber-300"
                }`}>
                  {score >= 75 ? "Target Range" : "Remediation Active"}
                </span>
              </div>
              <p className="text-xs text-teal-100/90 leading-relaxed">
                Measures completed care journeys, not sent messages. Every lost point corresponds to an unowned handoff, overdue review, or missing evidence.
              </p>
            </div>

            {/* 5 Explainable Rules Summary list */}
            <div className="mt-5 pt-4 border-t border-teal-800/80 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
                Current Lost Points Breakdown:
              </p>
              {breakdown.map((b: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-teal-100/80 text-[11px] truncate max-w-[280px]">
                    {b.rule}
                  </span>
                  <span className={`font-mono font-bold text-xs ${b.penalty < 0 ? "text-amber-300" : "text-emerald-400"}`}>
                    {b.penalty} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* KPI Matrix Cards with Value Type Badges */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Actionable Results
                </span>
                <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  ACTUAL
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {kpis.actionable_results_60d ?? 60}
              </p>
              <span className="text-[10px] text-slate-500 mt-2">Past 60 days screening cohort</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Patient Acknowledged
                </span>
                <span className="text-[9px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">
                  ACTUAL
                </span>
              </div>
              <p className="text-2xl font-bold text-teal-700 mt-1">
                {kpis.acknowledged_rate ?? 98.3}%
              </p>
              <span className="text-[10px] text-teal-600 font-medium mt-2">Teach-Back confirmed</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Referral Completion
                </span>
                <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                  ACTUAL
                </span>
              </div>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {kpis.referral_completion_rate ?? 70}%
              </p>
              <div className="flex items-center justify-between mt-2 text-[10px]">
                <span className="text-slate-500 font-mono">Target: &ge; 80%</span>
                <span className="text-amber-700 font-bold bg-amber-50 px-1 rounded">-5 pts penalty</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Barrier Resolution
                </span>
                <span className="text-[9px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">
                  ACTUAL
                </span>
              </div>
              <p className="text-2xl font-bold text-teal-700 mt-1">
                {kpis.barrier_resolution_rate ?? 78.3}%
              </p>
              <span className="text-[10px] text-slate-500 mt-2">Num: 18 / Denom: 23 resolved</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Unresolved Rate (90d)
                </span>
                <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                  TARGET &le; 25%
                </span>
              </div>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {kpis.unresolved_case_rate_90d ?? 64.4}%
              </p>
              <span className="text-[10px] text-amber-700 font-medium mt-2">90-day horizon cohort</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Coord Mins / Journey
                </span>
                <span className="text-[9px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                  ESTIMATED
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-700 mt-1">
                {kpis.coordinator_minutes_per_journey ?? 15.0}m
              </p>
              <div className="flex items-center justify-between mt-2 text-[10px]">
                <span className="text-slate-500">Touch time benchmark</span>
                <span className="text-emerald-700 font-semibold">Missing: 0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section: Funnel by Stage & Care Barriers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Funnel */}
          <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center justify-between">
              <span>9-Stage Population Care Funnel</span>
              <span className="text-[11px] text-slate-400 font-normal">Active & Closed Cases</span>
            </h2>
            <div className="space-y-2">
              {funnel.map((f: any, idx: number) => (
                <div key={idx} className="flex items-center space-x-3 text-xs">
                  <span className="w-36 text-slate-600 font-medium truncate" title={f.stage}>
                    {idx + 1}. {f.stage.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 bg-slate-100 h-4 rounded-full overflow-hidden flex items-center px-1">
                    <div
                      className="bg-teal-700 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max((f.count / 60) * 100, 4)}%` }}
                    ></div>
                  </div>
                  <span className="w-8 font-mono font-bold text-right text-slate-700">
                    {f.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Care Barriers Breakdown */}
          <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center justify-between">
              <span>Identified Care Barriers (History)</span>
              <span className="text-[11px] text-slate-400 font-normal">Total recorded</span>
            </h2>
            <div className="space-y-2 text-xs">
              {dropOff.map((b: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">{b.reason}</span>
                  <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-mono font-bold text-xs">
                    {b.count} cases
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section: Overdue Active Cases List */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Overdue Cases Requiring Action</span>
              </h2>
              <p className="text-xs text-slate-500">
                Cases exceeding clinical or operational SLAs. Resolving these directly recovers score points.
              </p>
            </div>
            <Link
              href="/queue"
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center space-x-1"
            >
              <span>View Needs Action Queue</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Case ID</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Urgency</th>
                  <th className="py-2.5 px-3">Current Stage</th>
                  <th className="py-2.5 px-3">Accountable Role</th>
                  <th className="py-2.5 px-3">Hours Overdue</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdueCases.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 font-mono font-bold text-teal-800">{c.id}</td>
                    <td className="py-2 px-3 font-medium text-slate-700">{c.patient_id}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.urgency === "CRITICAL" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                      }`}>
                        {c.urgency}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{c.stage}</td>
                    <td className="py-2 px-3 font-semibold text-slate-700">{c.owner_role || "Unassigned"}</td>
                    <td className="py-2 px-3 font-mono text-red-600 font-bold">+{c.hours_overdue}h</td>
                    <td className="py-2 px-3 text-right">
                      <Link
                        href={`/cases/${c.id}`}
                        className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded font-medium text-[11px] transition"
                      >
                        Open Journey
                      </Link>
                    </td>
                  </tr>
                ))}
                {overdueCases.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      Zero overdue cases. All screening pathways on track!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
