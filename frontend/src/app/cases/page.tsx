"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import { api, getCurrentUser } from "@/lib/api";
import {
  FileText,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  XCircle,
  RefreshCw,
  User,
  Activity
} from "lucide-react";

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState<string>("ALL");
  const [filterUrgency, setFilterUrgency] = useState<string>("ALL");
  const [filterOverdue, setFilterOverdue] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    loadCases();
  }, [filterStage, filterUrgency, filterOverdue]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStage !== "ALL") params.stage = filterStage;
      if (filterUrgency !== "ALL") params.urgency = filterUrgency;
      if (filterOverdue === "YES") params.overdue = true;

      const data = await api.getCases(params);
      setCases(data);
    } catch (err) {
      console.error("Failed to load cases", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = cases.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.id.toLowerCase().includes(q) ||
      c.patient_id.toLowerCase().includes(q) ||
      (c.screening_type && c.screening_type.toLowerCase().includes(q)) ||
      (c.current_owner && c.current_owner.toLowerCase().includes(q))
    );
  });

  const getStageBadge = (stage: string) => {
    const stageMap: Record<string, { label: string; color: string }> = {
      SCREENING_COMPLETED: { label: "Screening Done", color: "bg-slate-100 text-slate-700" },
      RESULT_ACTIONABLE: { label: "Actionable Result", color: "bg-rose-100 text-rose-800 border-rose-200" },
      NOTIFIED: { label: "Patient Notified", color: "bg-blue-100 text-blue-800" },
      ACKNOWLEDGED: { label: "Acknowledged", color: "bg-indigo-100 text-indigo-800" },
      REFERRAL_SENT: { label: "Referral In Escrow", color: "bg-amber-100 text-amber-800 border-amber-300" },
      SPECIALIST_ACCEPTED: { label: "Specialist Accepted", color: "bg-cyan-100 text-cyan-800" },
      APPOINTMENT_ATTENDED: { label: "Appt Attended", color: "bg-teal-100 text-teal-800" },
      OUTCOME_RECORDED: { label: "Outcome Documented", color: "bg-emerald-100 text-emerald-800" },
      CLOSED_LOOP: { label: "Closed Loop", color: "bg-green-100 text-green-800 border-green-300" },
    };
    const s = stageMap[stage] || { label: stage, color: "bg-gray-100 text-gray-800" };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${s.color}`}>
        {s.label}
      </span>
    );
  };

  const getUrgencyBadge = (urgency: string) => {
    if (urgency === "CRITICAL") {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-600 text-white uppercase tracking-wider">
          CRITICAL
        </span>
      );
    }
    if (urgency === "HIGH") {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500 text-white">
          HIGH
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
        ROUTINE
      </span>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <SyntheticBanner />

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-6 h-6 text-teal-600" />
                <span>Case Journeys Directory</span>
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Active tracking across all 9 care stages. Every actionable result has a named owner and escrow guardrails.
              </p>
            </div>

            <button
              onClick={loadCases}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Records</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by Case ID, Patient ID, Screening..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-600">Stage:</label>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">All Stages (9)</option>
                <option value="RESULT_ACTIONABLE">Actionable Result</option>
                <option value="NOTIFIED">Notified</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="REFERRAL_SENT">Referral Sent (In Escrow)</option>
                <option value="SPECIALIST_ACCEPTED">Specialist Accepted</option>
                <option value="APPOINTMENT_ATTENDED">Appointment Attended</option>
                <option value="OUTCOME_RECORDED">Outcome Recorded</option>
                <option value="CLOSED_LOOP">Closed Loop</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-600">Urgency:</label>
              <select
                value={filterUrgency}
                onChange={(e) => setFilterUrgency(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">All Urgencies</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="ROUTINE">Routine</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-600">SLA Status:</label>
              <select
                value={filterOverdue}
                onChange={(e) => setFilterOverdue(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">All Cases</option>
                <option value="YES">Overdue Only (!)</option>
              </select>
            </div>
          </div>

          {/* Cases Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Showing {filteredCases.length} Journey Records
              </span>
              <span className="text-xs text-slate-500">
                Sorted by priority & SLA urgency
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <RefreshCw className="w-6 h-6 animate-spin text-teal-600 mb-2" />
                <p className="text-xs">Loading case database...</p>
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">No cases found matching your filters.</p>
                <button
                  onClick={() => {
                    setFilterStage("ALL");
                    setFilterUrgency("ALL");
                    setFilterOverdue("ALL");
                    setSearchQuery("");
                  }}
                  className="mt-2 text-xs text-teal-600 hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Case ID</th>
                      <th className="py-3 px-4">Patient ID</th>
                      <th className="py-3 px-4">Screening & Value</th>
                      <th className="py-3 px-4">Urgency</th>
                      <th className="py-3 px-4">Current Stage</th>
                      <th className="py-3 px-4">Named Owner</th>
                      <th className="py-3 px-4">SLA Deadline</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCases.map((c) => {
                      const isOverdue = c.stage_deadline && new Date(c.stage_deadline) < new Date() && c.stage !== "CLOSED_LOOP";
                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isOverdue ? "bg-rose-50/30" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <Link
                              href={`/cases/${c.id}`}
                              className="text-teal-700 hover:text-teal-900 hover:underline flex items-center space-x-1"
                            >
                              <span>{c.id}</span>
                            </Link>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-600">
                            {c.patient_id}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{c.screening_type}</div>
                            <div className="text-[11px] text-slate-500">
                              Value: <span className="font-mono font-medium text-slate-700">{c.screening_value}</span> {c.screening_unit}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {getUrgencyBadge(c.urgency)}
                          </td>
                          <td className="py-3 px-4">
                            {getStageBadge(c.stage)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{c.current_owner}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {c.stage_deadline ? (
                              <div className={`flex items-center space-x-1 font-mono text-[11px] ${
                                isOverdue ? "text-rose-600 font-bold" : "text-slate-600"
                              }`}>
                                <Clock className="w-3 h-3" />
                                <span>{new Date(c.stage_deadline).toLocaleDateString()}</span>
                                {isOverdue && (
                                  <span className="ml-1 px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                                    BREACH
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/cases/${c.id}`}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded bg-teal-50 text-teal-700 hover:bg-teal-600 hover:text-white transition font-medium text-xs border border-teal-200"
                            >
                              <span>View Journey</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
