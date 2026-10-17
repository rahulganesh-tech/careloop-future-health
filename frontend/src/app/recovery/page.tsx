"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import {
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  TrendingUp,
  FileText,
  Sliders,
  Check,
  ArrowRight,
  Info,
  Calendar,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Lock,
  Unlock,
  CheckSquare,
  Users
} from "lucide-react";
import { api, getCurrentUser } from "@/lib/api";

const SCENARIO_TEMPLATES = [
  { id: "CRITICAL_UNACK", name: "Critical Unacknowledged (>24h)", desc: "Abnormal HbA1c 11.2% unacknowledged by patient or referring provider beyond critical window." },
  { id: "REF_REJECTED", name: "Referral Rejected by Specialist", desc: "Secondary endocrinology clinic rejected intake due to missing baseline microvascular workup." },
  { id: "MISSING_DOCS", name: "Missing Documents & Lab Evidence", desc: "Pre-referral laboratory proof missing from medical record; closure and dispatch gate blocked." },
  { id: "NO_SLOT", name: "Specialist Clinic Full (No Slot)", desc: "Target facility (DEC) operating at 100% capacity; appointment pending without confirmed schedule." },
  { id: "LANGUAGE_BARRIER", name: "Language & Comprehension Barrier", desc: "Patient primary language Urdu/Tagalog; non-responsive to default notifications; teach-back incomplete." }
];

export default function RecoverySimulatorPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [assumptions, setAssumptions] = useState<any>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("CASE-1004");
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [mode, setMode] = useState<"CASE" | "SCENARIO">("CASE");

  const [loading, setLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Approval flow states
  const [inSimMode, setInSimMode] = useState(true);
  const [selectedOptionCode, setSelectedOptionCode] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState<any>(null);

  // Load initial data
  useEffect(() => {
    setCurrentUser(getCurrentUser());

    // Fetch assumptions
    api.getSimulationAssumptions()
      .then(res => setAssumptions(res))
      .catch(err => console.error("Assumptions load error", err));

    // Fetch stalled cases
    api.getCases()
      .then((data: any[]) => {
        // Find stalled or active cases
        const active = data.filter(c => !c.closed_at);
        setCases(active);
        if (active.length > 0 && !selectedCaseId) {
          setSelectedCaseId(active[0].id);
        }
      })
      .catch(err => console.error("Cases load error", err));
  }, []);

  // Run simulation
  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);
    setApplySuccess(null);
    setInSimMode(true);
    setApprovalConfirmed(false);

    try {
      const payload: any = {};
      if (mode === "CASE") {
        payload.case_id = selectedCaseId;
      } else {
        payload.scenario_template = selectedScenario || "CRITICAL_UNACK";
      }

      const res = await api.simulateRecovery(payload);
      setSimResult(res);
      // Auto-select recommended option
      if (res.recommendation?.recommended_option_code) {
        setSelectedOptionCode(res.recommendation.recommended_option_code);
      } else if (res.options?.length > 0) {
        setSelectedOptionCode(res.options[0].option_code);
      }
    } catch (err: any) {
      setError(err.message || "Failed to execute simulation");
    } finally {
      setLoading(false);
    }
  };

  // Run on first load once case is ready
  useEffect(() => {
    if (selectedCaseId && !simResult && !loading) {
      handleRunSimulation();
    }
  }, [selectedCaseId]);

  // Handle Apply Action
  const handleApply = async () => {
    if (inSimMode) {
      setError("Please leave simulation mode first by checking the approval confirmation.");
      return;
    }
    if (!selectedOptionCode) {
      setError("Please select an intervention option to apply.");
      return;
    }
    if (!reviewNotes.trim()) {
      setError("Authorised review notes are mandatory before applying intervention to a live case.");
      return;
    }

    setApplying(true);
    setError(null);
    try {
      const res = await api.applyRecovery({
        run_id: simResult.run_id,
        option_code: selectedOptionCode,
        review_notes: reviewNotes
      });
      setApplySuccess(res);
      setInSimMode(true); // Return to safe mode
    } catch (err: any) {
      setError(err.message || "Failed to apply simulation action");
    } finally {
      setApplying(false);
    }
  };

  const selectedCase = cases.find(c => c.id === selectedCaseId);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar />

      <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                <Zap className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Recovery Simulator
              </h1>
              <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
                Deterministic · No ML
              </span>
              <span className="text-[11px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded border border-slate-200">
                Assumptions {assumptions?.version || "v1.2-2026"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Simulate operational interventions for stalled cases without altering live records. All metrics are calculated deterministically from calibrated assumptions.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRunSimulation}
              disabled={loading}
              className="inline-flex items-center space-x-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Computing Forecast...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Execute Simulation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Simulation Safety Banner */}
        <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-colors ${
          inSimMode 
            ? "bg-amber-50 border-amber-200 text-amber-900" 
            : "bg-emerald-50 border-emerald-200 text-emerald-900"
        }`}>
          <div className="flex items-center space-x-2.5">
            {inSimMode ? (
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            ) : (
              <Unlock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            )}
            <div>
              <span className="font-bold">
                {inSimMode ? "SIMULATION MODE ACTIVE" : "APPROVAL MODE UNLOCKED"}
              </span>
              <span className="mx-2 text-slate-400">|</span>
              <span className="text-[11px]">
                {inSimMode 
                  ? "Read-only exploration. No real patient data or case records will be modified during this run."
                  : "Authorised action pending. Submitting will create a real task and link it to this simulation run."}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/70 border border-current font-bold">
              ILLUSTRATIVE - SIMULATED
            </span>
          </div>
        </div>

        {/* Success Alert if Action Applied */}
        {applySuccess && (
          <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-xs text-emerald-900 space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-sm">Action Successfully Applied to Live System</span>
            </div>
            <p className="text-emerald-800">
              Created real Task <strong>#{applySuccess.task_id}</strong> for Case <strong>{applySuccess.case_id}</strong> with intervention: <strong>{applySuccess.approved_option}</strong>.
            </p>
            <div className="text-[11px] font-mono text-emerald-700 bg-white/80 p-2 rounded border border-emerald-200">
              Linked Simulation Run Token: <strong>{applySuccess.run_token}</strong> | Approved By: {applySuccess.applied_by} at {new Date(applySuccess.applied_at).toLocaleString()}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-xs text-red-700 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Picker bar: Choose Stalled Case OR Scenario Template */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-4 text-xs font-semibold">
              <span className="text-slate-500 uppercase tracking-wider text-[11px]">Simulation Input Source:</span>
              <button
                type="button"
                onClick={() => setMode("CASE")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  mode === "CASE"
                    ? "bg-teal-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Live Stalled Case
              </button>
              <button
                type="button"
                onClick={() => setMode("SCENARIO")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  mode === "SCENARIO"
                    ? "bg-teal-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Standard Scenario Template (5 Types)
              </button>
            </div>
          </div>

          {mode === "CASE" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Select Stalled or Overdue Case:
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · Stage: {c.stage} · Urgency: {c.urgency} · Patient: {c.patient_id} ({c.owner_role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 w-full">
                  <span className="font-semibold text-slate-700">Deterministic Invariant:</span> Identical inputs will always produce the exact same simulated outcome values.
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-2">
                Select Approved Scenario Template:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {SCENARIO_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedScenario(tpl.id);
                    }}
                    className={`p-3 text-left rounded-lg border transition flex flex-col justify-between ${
                      selectedScenario === tpl.id || (!selectedScenario && tpl.id === "CRITICAL_UNACK")
                        ? "border-teal-600 bg-teal-50/50 ring-1 ring-teal-500"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900">{tpl.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{tpl.desc}</p>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-teal-700 mt-2">
                      {tpl.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3-Column Recovery Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Case Context */}
          <div className="lg:col-span-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-teal-600" />
                <span>Case Context</span>
              </span>
              <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                {simResult?.case_id || selectedCaseId || "CASE-1004"}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Why Stalled</span>
                <p className="text-xs font-semibold text-amber-700 mt-0.5 bg-amber-50 p-2 rounded border border-amber-200">
                  {simResult?.context?.why_stalled || "Patient unacknowledged after critical screening notification."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Owner</span>
                  <span className="font-semibold text-slate-800">
                    {simResult?.context?.owner_role || selectedCase?.owner_role || "COORD"}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">SLA Due Time</span>
                  <span className="font-semibold text-red-600 flex items-center space-x-1">
                    <Clock className="w-3 h-3 mr-0.5" />
                    <span>{simResult?.context?.hours_overdue || 42}h Overdue</span>
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Missing Evidence Items
                </span>
                <div className="space-y-1.5">
                  {(simResult?.context?.missing_evidence || ["Specialist Appointment Confirmation", "Referral Acceptance Receipt"]).map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center space-x-2 text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Active Patient Barriers
                </span>
                <div className="space-y-1.5">
                  {(simResult?.context?.barriers || ["Language / Digital Literacy (Urdu)", "No Caregiver Accompaniment"]).map((b: string, idx: number) => (
                    <div key={idx} className="flex items-center space-x-2 text-[11px] text-slate-700 bg-red-50/70 px-2.5 py-1.5 rounded border border-red-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                Scenario Source: <span className="font-mono text-slate-600">{simResult?.scenario_template || "CASE-1004"}</span>
              </div>
            </div>
          </div>

          {/* CENTRE COLUMN: 2-4 Approved Intervention Cards */}
          <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Approved Intervention Catalogue</span>
              </span>
              <span className="text-[10px] bg-teal-50 text-teal-800 font-semibold px-2 py-0.5 rounded border border-teal-200">
                {simResult?.options?.length || 4} Available Options
              </span>
            </div>

            <div className="space-y-3">
              {(simResult?.options || []).map((opt: any) => {
                const isSelected = selectedOptionCode === opt.option_code;
                const isRecommended = simResult?.recommendation?.recommended_option_code === opt.option_code;

                return (
                  <div
                    key={opt.option_code}
                    onClick={() => setSelectedOptionCode(opt.option_code)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? "border-teal-600 bg-teal-50/40 ring-2 ring-teal-500 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300"
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <h3 className="font-bold text-xs text-slate-900">{opt.name}</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isRecommended && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 flex items-center space-x-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Recommended</span>
                          </span>
                        )}
                        <span className="text-[9px] font-mono text-slate-400">
                          {opt.label}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {opt.description}
                    </p>

                    {/* Operational Assumptions & Staff minutes */}
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center space-x-1.5 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Staff Effort: <strong>{opt.staff_minutes} mins</strong></span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold justify-end">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Completion Lift: <strong>+{opt.lift_completion}%</strong></span>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-400 italic">
                      Underlying Assumption: {opt.assumption_basis || "Calibrated from clinical cohort trial logs"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Baseline vs Each Option & Comparison */}
          <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Simulated Outcomes</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-bold">
                BASELINE VS OPTIONS
              </span>
            </div>

            {/* Baseline Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase">Status Quo Baseline (Do Nothing)</span>
                <span className="text-[9px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                  UNRESOLVED
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Projected Completion</span>
                  <span className="text-lg font-bold text-slate-700">
                    {simResult?.baseline?.projected_completion_rate ?? 30}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Overdue Tasks</span>
                  <span className="text-lg font-bold text-red-600">
                    {simResult?.baseline?.projected_overdue_tasks ?? 4}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Unresolved Cases</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {simResult?.baseline?.projected_unresolved_cases ?? 1}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Staff Workload</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {simResult?.baseline?.coordinator_workload_minutes ?? 0} mins
                  </span>
                </div>
              </div>
            </div>

            {/* Active Selected Option Forecast */}
            {selectedOptionCode && (
              <div className="bg-teal-900 text-white p-4 rounded-xl shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-200">
                    Forecast for: {selectedOptionCode}
                  </span>
                  <span className="text-[10px] bg-teal-800 border border-teal-600 text-teal-100 px-2 py-0.5 rounded font-mono">
                    ILLUSTRATIVE
                  </span>
                </div>

                {(() => {
                  const opt = simResult?.options?.find((o: any) => o.option_code === selectedOptionCode);
                  if (!opt) return null;
                  return (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-teal-950/60 p-2.5 rounded-lg border border-teal-800">
                        <span className="text-[10px] text-teal-300 uppercase block font-semibold">Projected Completion</span>
                        <div className="flex items-baseline space-x-1.5 mt-0.5">
                          <span className="text-2xl font-black text-white">{opt.projected_completion_rate}%</span>
                          <span className="text-xs font-bold text-emerald-400">+{opt.lift_completion}%</span>
                        </div>
                      </div>
                      <div className="bg-teal-950/60 p-2.5 rounded-lg border border-teal-800">
                        <span className="text-[10px] text-teal-300 uppercase block font-semibold">Overdue Tasks</span>
                        <div className="flex items-baseline space-x-1.5 mt-0.5">
                          <span className="text-2xl font-black text-white">{opt.projected_overdue_tasks}</span>
                          <span className="text-xs font-bold text-teal-300">tasks</span>
                        </div>
                      </div>
                      <div className="bg-teal-950/60 p-2 rounded-lg border border-teal-800 text-xs">
                        <span className="text-[10px] text-teal-300 block">Unresolved Cases</span>
                        <span className="font-bold text-white">{opt.projected_unresolved_cases}</span>
                      </div>
                      <div className="bg-teal-950/60 p-2 rounded-lg border border-teal-800 text-xs">
                        <span className="text-[10px] text-teal-300 block">Staff Workload</span>
                        <span className="font-bold text-white">{opt.coordinator_workload_minutes} mins</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Approval & Action Enforcement Section */}
            <div className="pt-3 border-t border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 uppercase text-[11px]">Action Approval Gate</span>
                <span className="text-[10px] text-slate-500 font-mono">ROLE: {currentUser?.role || "COORD"}</span>
              </div>

              {/* Simulation Mode Toggle Lock */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!inSimMode && approvalConfirmed}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setInSimMode(!checked);
                      setApprovalConfirmed(checked);
                    }}
                    className="mt-0.5 h-4 w-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <span className="text-[11px] text-slate-700 leading-snug">
                    <strong>Exit Simulation Mode:</strong> I confirm clinical & operational review of this intervention and authorize task creation.
                  </span>
                </label>
              </div>

              {/* Authorised Review Notes */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                  Authorised Review Notes (Mandatory):
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  disabled={inSimMode}
                  placeholder={inSimMode ? "Unlock approval mode above to enter notes..." : "Enter clinical rationale and field coordination instructions..."}
                  rows={2}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Apply Action Button */}
              <button
                type="button"
                onClick={handleApply}
                disabled={inSimMode || !approvalConfirmed || applying || !reviewNotes.trim()}
                className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition shadow-sm ${
                  inSimMode || !approvalConfirmed || !reviewNotes.trim()
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                }`}
              >
                {applying ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying Intervention...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    <span>Apply Action & Create Real Task</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-400 text-center leading-tight">
                "Apply action" stays disabled until an authorised user leaves simulation mode and enters review notes.
              </p>
            </div>

          </div>

        </div>

        {/* Assumptions Reference Table (Versioned) */}
        {assumptions && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-teal-600" />
                <span className="font-bold text-slate-900">
                  Versioned Simulation Assumptions ({assumptions.version})
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Hash: {assumptions.assumptions_hash?.slice(0, 16)}...
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every value on this screen is labelled <strong>ILLUSTRATIVE - SIMULATED</strong> and derived deterministically from calibrated scenario baselines and intervention coefficients.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {Object.entries(assumptions.intervention_catalogue || {}).map(([key, item]: [string, any]) => (
                <div key={key} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] space-y-1">
                  <div className="font-bold text-slate-800">{item.name}</div>
                  <div className="text-slate-500">Staff: <strong>{item.staff_minutes} mins</strong></div>
                  <div className="text-emerald-700 font-semibold">Lift: <strong>+{item.lift_completion}%</strong></div>
                  <div className="text-slate-500">Overdue $\Delta$: <strong>{item.delta_overdue_tasks}</strong></div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
