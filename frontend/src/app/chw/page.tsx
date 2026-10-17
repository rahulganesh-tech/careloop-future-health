"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import { api, getCurrentUser } from "@/lib/api";
import {
  PhoneCall,
  User,
  Heart,
  CheckCircle,
  AlertTriangle,
  Bus,
  Languages,
  DollarSign,
  Clock,
  Sparkles,
  RefreshCw,
  Wifi,
  Save,
  Tablet,
  Check
} from "lucide-react";

export default function ChwAssistedModePage() {
  const [cases, setCases] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);

  // Barrier form state
  const [barrierType, setBarrierType] = useState<string>("TRANSPORT");
  const [barrierDetails, setBarrierDetails] = useState<string>("Patient has no personal vehicle and lives 35km from specialty clinic in Al Ain.");
  const [assistanceAction, setAssistanceAction] = useState<string>("Book subsidized health transport van via DoH Mobility Support");

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.getCases({ overdue: true });
      setCases(data);
      if (data.length > 0 && !selectedCase) {
        setSelectedCase(data[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load field visit cases.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordBarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.recordBarrier(selectedCase.id, {
        barrier_type: barrierType,
        description: barrierDetails,
        mitigation_action: assistanceAction,
      });
      setSuccessMsg(`Barrier logged and mitigation dispatched for case ${selectedCase.id}!`);
      await loadCases();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record barrier.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleInPersonTeachBack = async () => {
    if (!selectedCase) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      // In-person verbal teachback completion by CHW
      await api.reviewCase(selectedCase.id, {
        notes: `In-person verbal teach-back confirmed during CHW home visit by ${currentUser?.name || "Zainab Al-Baloushi"}. Patient understands next clinic step.`,
      });
      setSuccessMsg(`In-person verbal comprehension verified for ${selectedCase.id}!`);
      await loadCases();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to document in-person teach-back.");
    } finally {
      setActionLoading(false);
    }
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
                <Tablet className="w-6 h-6 text-teal-600" />
                <h1 className="text-2xl font-bold text-slate-900">
                  Community Health Worker (CHW) Assisted Mode
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Field Tablet Interface for Home Visits, Digital Literacy Support, and Equity Barrier Removal.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Field Tablet Online (Synced)</span>
              </div>
              <button
                onClick={loadCases}
                disabled={loading}
                className="p-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Notice:</span> {errorMsg}
              </div>
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Success:</span> {successMsg}
              </div>
            </div>
          )}

          {/* Grid Layout: Stalled / Priority Patient Queue + In-Person Assessment Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Priority Home Visit Queue */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <User className="w-4 h-4 text-teal-600" />
                  <span>Stalled Patients Requiring Visit</span>
                </h2>
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                  {cases.length} Overdue
                </span>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-600 mb-2" />
                  <span>Loading field visit queue...</span>
                </div>
              ) : cases.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  All patients currently progressing on schedule!
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {cases.map((c) => {
                    const isSelected = selectedCase?.id === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCase(c)}
                        className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-teal-50 border-teal-500 shadow-sm ring-1 ring-teal-400"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-bold text-slate-900">{c.id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-600 text-white">
                            {c.urgency}
                          </span>
                        </div>
                        <div className="text-slate-700 font-medium">
                          {c.screening_type} ({c.screening_value} {c.screening_unit})
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                          <span>Patient: {c.patient_id}</span>
                          <span className="text-teal-700 font-semibold">{c.stage}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right 2 Cols: In-Person Field Assessment & Barrier Resolution */}
            <div className="lg:col-span-2 space-y-6">
              {selectedCase ? (
                <>
                  {/* Selected Case Header */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">In-Person Field Visit</div>
                        <h2 className="text-xl font-bold font-mono text-slate-900">
                          {selectedCase.id} • Patient {selectedCase.patient_id}
                        </h2>
                      </div>
                      <Link
                        href={`/cases/${selectedCase.id}`}
                        className="text-xs text-teal-700 hover:underline font-semibold"
                      >
                        Open Full Medical Journey →
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Screening Result</span>
                        <span className="font-bold text-rose-700 text-sm">
                          {selectedCase.screening_type} {selectedCase.screening_value} {selectedCase.screening_unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Current Stage</span>
                        <span className="font-semibold text-slate-800">{selectedCase.stage}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Responsible Owner</span>
                        <span className="font-mono font-medium text-slate-700">{selectedCase.current_owner}</span>
                      </div>
                    </div>

                    {/* Quick In-Person Teach-Back Action */}
                    <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-teal-900">
                          Conduct Verbal Teach-Back on Tablet
                        </div>
                        <div className="text-[11px] text-teal-700">
                          Explain result in patient&apos;s primary dialect, verify comprehension, and record in-person verification.
                        </div>
                      </div>
                      <button
                        onClick={handleInPersonTeachBack}
                        disabled={actionLoading}
                        className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50 flex-shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Verbal Teach-Back</span>
                      </button>
                    </div>
                  </div>

                  {/* Barrier Diagnosis & Mitigation Dispatch */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
                      <Bus className="w-4 h-4 text-teal-600" />
                      <span>Document Care Access Barrier & Order Assistance</span>
                    </h3>

                    <form onSubmit={handleRecordBarrier} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">
                            Primary Access Barrier
                          </label>
                          <select
                            value={barrierType}
                            onChange={(e) => setBarrierType(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-xs"
                          >
                            <option value="TRANSPORT">Transportation / Geographic Distance</option>
                            <option value="LANGUAGE">Language / Dialect / Low Literacy</option>
                            <option value="FINANCIAL">Insurance Coverage / Copay Confusion</option>
                            <option value="WORK_SCHEDULE">Work Shift / Hourly Wage Loss</option>
                            <option value="FEAR_ANXIETY">Anxiety / Denial of Diagnosis</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">
                            Mitigation Protocol
                          </label>
                          <select
                            value={assistanceAction}
                            onChange={(e) => setAssistanceAction(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-xs"
                          >
                            <option value="Book subsidized health transport van via DoH Mobility Support">
                              Dispatch DoH Mobility Transport Van
                            </option>
                            <option value="Assign native-language Community Navigator for telephone follow-up">
                              Assign Native Dialect Navigator
                            </option>
                            <option value="Refer to Social Services for copay relief and subsidy eligibility">
                              Social Services Copay Relief
                            </option>
                            <option value="Schedule evening or weekend clinic slot">
                              Schedule Evening / Weekend Slot
                            </option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          Field Observation Notes
                        </label>
                        <textarea
                          value={barrierDetails}
                          onChange={(e) => setBarrierDetails(e.target.value)}
                          rows={3}
                          required
                          className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-xs"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center space-x-1.5 transition"
                        >
                          <Save className="w-4 h-4" />
                          <span>{actionLoading ? "Recording..." : "Save Barrier & Trigger Mitigation"}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                  Select a stalled case from the left queue to begin in-person assessment.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
