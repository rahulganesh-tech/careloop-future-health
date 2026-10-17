"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import { api } from "@/lib/api";
import {
  Sliders,
  Play,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Zap,
  Save
} from "lucide-react";

export default function RulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<any>(null);

  // Simulator State
  const [simStage, setSimStage] = useState("RESULT_ACTIONABLE");
  const [simUrgency, setSimUrgency] = useState("CRITICAL");
  const [simHours, setSimHours] = useState<number>(30);
  const [simTeachBack, setSimTeachBack] = useState("PENDING");
  const [simResults, setSimResults] = useState<any[] | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await api.getRules();
      setRules(data);
    } catch (err) {
      console.error("Failed to load rules", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSimulator = () => {
    const fired: any[] = [];

    // Test R-ACK-24H
    if (simStage === "RESULT_ACTIONABLE" && simUrgency === "CRITICAL" && simHours >= 24) {
      fired.push({
        id: "R-ACK-24H",
        name: "Critical Abnormal Unacknowledged (24h)",
        action: "Escalate immediately to on-call GP and create urgent Care Navigator phone task",
        severity: "CRITICAL",
        penalty: "-15 points on Loop Integrity Score",
      });
    }

    // Test R-ACK-72H
    if (simStage === "RESULT_ACTIONABLE" && simUrgency !== "CRITICAL" && simHours >= 72) {
      fired.push({
        id: "R-ACK-72H",
        name: "Routine Result Unacknowledged (72h)",
        action: "Dispatch automated SMS/WhatsApp fallback message & assign CHW home outreach",
        severity: "HIGH",
        penalty: "-8 points on Loop Integrity Score",
      });
    }

    // Test R-TB-FAIL
    if (simTeachBack === "FAILED") {
      fired.push({
        id: "R-TB-FAIL",
        name: "Comprehension Barrier Detected (Teach-Back Failed)",
        action: "Trigger bilingual nurse callback to explain clinical findings directly",
        severity: "HIGH",
        penalty: "-5 points on Loop Integrity Score",
      });
    }

    // Test R-REF-ESCROW
    if (simStage === "REFERRAL_SENT" && simHours >= 72) {
      fired.push({
        id: "R-REF-ESCROW",
        name: "Referral Escrow Stalled Past SLA (72h)",
        action: "Alert specialist triage desk; hold clinical legal accountability with referring GP",
        severity: "HIGH",
        penalty: "-8 points on Loop Integrity Score",
      });
    }

    setSimResults(fired);
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
              <div className="flex items-center space-x-2">
                <Sliders className="w-6 h-6 text-teal-600" />
                <h1 className="text-2xl font-bold text-slate-900">
                  Visual Rules Engine & SLA Configuration
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Configurable escalation policies, deterministic stall triggers, and Loop Integrity thresholds.
              </p>
            </div>

            <button
              onClick={loadRules}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Reload Rules</span>
            </button>
          </div>

          {/* Active Rules Grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Configured Stall & Escalation Rules ({rules.length})
              </span>
              <span className="text-xs text-slate-400">DoH Guideline Compliant</span>
            </div>

            <div className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-6 hover:bg-slate-50/60 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono font-bold text-teal-800 text-xs px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                        {rule.id}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm">{rule.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {rule.sla_hours}h SLA
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{rule.description}</p>
                    <div className="text-[11px] text-teal-700 font-mono pt-1">
                      Action Trigger: {rule.action_type}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>Active</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Rule Simulator */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Interactive Rule Execution Simulator</h3>
                <p className="text-xs text-slate-500">Test how incoming clinical events trigger automated escalations and score impacts.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Journey Stage</label>
                <select
                  value={simStage}
                  onChange={(e) => setSimStage(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                >
                  <option value="RESULT_ACTIONABLE">RESULT_ACTIONABLE</option>
                  <option value="NOTIFIED">NOTIFIED</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="REFERRAL_SENT">REFERRAL_SENT</option>
                  <option value="SPECIALIST_ACCEPTED">SPECIALIST_ACCEPTED</option>
                  <option value="APPOINTMENT_ATTENDED">APPOINTMENT_ATTENDED</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Clinical Urgency</label>
                <select
                  value={simUrgency}
                  onChange={(e) => setSimUrgency(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                >
                  <option value="CRITICAL">CRITICAL (e.g. HbA1c 11.2%)</option>
                  <option value="HIGH">HIGH (e.g. HbA1c 8.4%)</option>
                  <option value="ROUTINE">ROUTINE</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Elapsed Hours in Stage</label>
                <input
                  type="number"
                  value={simHours}
                  onChange={(e) => setSimHours(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Teach-Back State</label>
                <select
                  value={simTeachBack}
                  onChange={(e) => setSimTeachBack(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="PASSED">PASSED (Verified)</option>
                  <option value="FAILED">FAILED (Misunderstood)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleRunSimulator}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center space-x-1.5 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Rules Engine</span>
              </button>
            </div>

            {/* Simulation Results */}
            {simResults && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Simulation Outcome: {simResults.length} Rule(s) Triggered
                </span>

                {simResults.length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>No stall rules breached. Journey is operating within normal SLA targets.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {simResults.map((r, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-amber-50/80 border border-amber-300 rounded-xl text-xs flex items-start space-x-3"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 font-mono">{r.id}: {r.name}</span>
                            <span className="font-mono font-bold text-rose-700">{r.penalty}</span>
                          </div>
                          <p className="text-slate-700">{r.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
