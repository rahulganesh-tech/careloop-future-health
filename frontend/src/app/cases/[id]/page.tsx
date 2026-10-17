"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import { api, getCurrentUser } from "@/lib/api";
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  User,
  ArrowLeft,
  Lock,
  Unlock,
  Download,
  AlertTriangle,
  Send,
  Building,
  Calendar,
  Sparkles,
  ExternalLink,
  RefreshCw,
  QrCode
} from "lucide-react";

const STAGES_ORDER = [
  { id: "SCREENING_COMPLETED", label: "1. Screening" },
  { id: "RESULT_ACTIONABLE", label: "2. Actionable" },
  { id: "NOTIFIED", label: "3. Notified" },
  { id: "ACKNOWLEDGED", label: "4. Acknowledged" },
  { id: "REFERRAL_SENT", label: "5. Referral (Escrow)" },
  { id: "SPECIALIST_ACCEPTED", label: "6. Accepted" },
  { id: "APPOINTMENT_ATTENDED", label: "7. Attended" },
  { id: "OUTCOME_RECORDED", label: "8. Outcome" },
  { id: "CLOSED_LOOP", label: "9. Closed Loop" },
];

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<any>(null);
  const [closureStatus, setClosureStatus] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Signoff form state
  const [signoffRole, setSignoffRole] = useState<string>("GP");
  const [signoffStatement, setSignoffStatement] = useState<string>("I confirm review of the clinical outcome and agree the loop is safely complete.");

  // Closure form state
  const [disposition, setDisposition] = useState<string>("TREATMENT_COMPLETED");
  const [closeReason, setCloseReason] = useState<string>("Patient attended follow-up, management plan initiated, HbA1c target set.");

  // FHIR modal state
  const [fhirData, setFhirData] = useState<any>(null);
  const [showFhir, setShowFhir] = useState(false);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    loadCaseData();
  }, [caseId]);

  const loadCaseData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const detail = await api.getCaseDetail(caseId);
      setCaseData(detail);

      const closure = await api.checkClosure(caseId);
      setClosureStatus(closure);

      const logs = await api.getAuditLog(caseId);
      setAuditLogs(logs);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load case details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignoff = async () => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.signoffCase(caseId, signoffRole, signoffStatement);
      setSuccessMsg(`Signed off successfully as ${signoffRole}!`);
      await loadCaseData();
    } catch (err: any) {
      setErrorMsg(err.message || "Sign-off failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseCase = async () => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.closeCase(caseId, disposition, closeReason);
      setSuccessMsg("Case closed successfully! Loop sealed with cryptographic verification.");
      await loadCaseData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to close case.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewFhir = async () => {
    try {
      setActionLoading(true);
      const data = await api.getFhirBundle(caseId);
      setFhirData(data);
      setShowFhir(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load FHIR bundle.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50 text-slate-800">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <SyntheticBanner />
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-2" />
            <p className="text-sm font-medium">Loading case journey details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex min-h-screen bg-slate-50 text-slate-800">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <SyntheticBanner />
          <div className="p-12 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
            <p className="text-sm font-medium">Case {caseId} not found.</p>
            <Link href="/cases" className="mt-4 inline-block text-xs text-teal-600 hover:underline">
              Return to Case Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStageIndex = STAGES_ORDER.findIndex((s) => s.id === caseData.stage);
  const isClosed = caseData.stage === "CLOSED_LOOP";

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <SyntheticBanner />

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Top Breadcrumbs & Actions */}
          <div className="flex items-center justify-between">
            <Link
              href="/cases"
              className="inline-flex items-center space-x-1 text-xs text-slate-600 hover:text-teal-700 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Case Journeys</span>
            </Link>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleViewFhir}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
                <span>Export FHIR R4 Bundle</span>
              </button>

              <Link
                href={`/p/${caseData.id}?token=patient_demo_${caseData.patient_id}`}
                target="_blank"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-xs font-medium text-teal-700 hover:bg-teal-100 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                <span>Patient Mobile View</span>
              </Link>
            </div>
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Error:</span> {errorMsg}
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

          {/* Header Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold font-mono text-slate-900">{caseData.id}</h1>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                    caseData.urgency === "CRITICAL"
                      ? "bg-rose-600 text-white"
                      : caseData.urgency === "HIGH"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {caseData.urgency}
                  </span>
                  {isClosed && (
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300 flex items-center space-x-1">
                      <Lock className="w-3 h-3 text-green-600" />
                      <span>SEALED & CLOSED</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Patient Reference: <span className="font-mono font-semibold text-slate-700">{caseData.patient_id}</span> • Pathway: <span className="font-semibold text-slate-700">{caseData.screening_type}</span>
                </p>
              </div>

              {/* Ownership Card */}
              <div className="flex items-center space-x-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Named Owner</div>
                  <div className="text-xs font-bold text-slate-900 font-mono flex items-center space-x-1 mt-0.5">
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    <span>{caseData.current_owner}</span>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Stage SLA</div>
                  <div className={`text-xs font-bold font-mono flex items-center space-x-1 mt-0.5 ${
                    caseData.stage_deadline && new Date(caseData.stage_deadline) < new Date() && !isClosed
                      ? "text-rose-600"
                      : "text-slate-700"
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{caseData.stage_deadline ? new Date(caseData.stage_deadline).toLocaleDateString() : "None"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Screening Details Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Screening Test</span>
                <span className="font-semibold text-slate-800">{caseData.screening_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Result Value</span>
                <span className="font-mono font-bold text-rose-700 text-sm">
                  {caseData.screening_value} {caseData.screening_unit}
                </span>
                <span className="text-[10px] text-slate-400 block">Abnormal threshold breached</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Screening Date</span>
                <span className="text-slate-700 font-medium">
                  {new Date(caseData.created_at).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Referral Escrow</span>
                <span className="text-slate-700 font-medium">
                  {caseData.referrals && caseData.referrals.length > 0 ? (
                    <span className="text-teal-700 font-semibold">
                      {caseData.referrals[0].status} ({caseData.referrals[0].id})
                    </span>
                  ) : (
                    "No referral requested"
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Visual 9-Stage Stepper */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              9-Stage CareLoop Progress Tracker
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
              {STAGES_ORDER.map((s, idx) => {
                const isPassed = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                const isPending = idx > currentStageIndex;

                let cardBg = "bg-slate-50 border-slate-200 text-slate-400";
                if (isPassed) cardBg = "bg-emerald-50 border-emerald-300 text-emerald-800";
                if (isCurrent) cardBg = "bg-teal-600 border-teal-700 text-white shadow-sm ring-2 ring-teal-200";

                return (
                  <div
                    key={s.id}
                    className={`p-2.5 rounded-xl border text-center transition-all ${cardBg}`}
                  >
                    <div className="text-[10px] font-bold uppercase truncate">{s.label}</div>
                    <div className="mt-1 flex items-center justify-center">
                      {isPassed && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                      {isCurrent && <Clock className="w-3.5 h-3.5 text-white animate-pulse" />}
                      {isPending && <div className="w-2 h-2 rounded-full bg-slate-300" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Two-Column Layout: Evidence Gate & Journey Data */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Journey Data & Referrals */}
            <div className="lg:col-span-2 space-y-6">
              {/* Referrals & Escrow Card */}
              {caseData.referrals && caseData.referrals.length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <Building className="w-4 h-4 text-teal-600" />
                      <span>Specialist Referral & Escrow Status</span>
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-mono font-medium border border-teal-200">
                      {caseData.referrals[0].id}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Destination Clinic:</span>
                        <span className="font-semibold text-slate-800">{caseData.referrals[0].receiving_facility}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Escrow Responsible Clinician:</span>
                        <span className="font-mono font-bold text-teal-800 bg-teal-100/60 px-2 py-0.5 rounded">
                          {caseData.referrals[0].escrow_owner}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Referral Status:</span>
                        <span className="font-bold text-slate-800">{caseData.referrals[0].status}</span>
                      </div>
                      {caseData.referrals[0].reject_reason && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px]">
                          <span className="font-bold">Rejection Note:</span> {caseData.referrals[0].reject_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <Link
                        href={`/receipts/${caseData.referrals[0].receipt_token}`}
                        target="_blank"
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 font-medium text-xs"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>View Portable Escrow Receipt</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Appointments & Clinical Outcome */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2 mb-4">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>Clinical Outcome & Attended Appointments</span>
                </h2>

                {caseData.appointments && caseData.appointments.length > 0 ? (
                  <div className="space-y-3">
                    {caseData.appointments.map((apt: any) => (
                      <div key={apt.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">{apt.facility}</div>
                          <div className="text-[11px] text-slate-500">
                            Scheduled: {new Date(apt.scheduled_for).toLocaleString()}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          apt.attended ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {apt.attended ? "Attended & Verified" : "Pending Attendance"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No specialist appointment recorded yet.</p>
                )}

                {caseData.clinical_outcomes && caseData.clinical_outcomes.length > 0 && (
                  <div className="mt-4 p-4 bg-teal-50/50 border border-teal-100 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-teal-900">Documented Clinical Outcome</span>
                      <span className="text-[10px] text-slate-500">{new Date(caseData.clinical_outcomes[0].created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-700">{caseData.clinical_outcomes[0].outcome_summary}</p>
                    {caseData.clinical_outcomes[0].care_plan && (
                      <div className="text-[11px] text-teal-800 pt-1 border-t border-teal-100">
                        <span className="font-semibold">Care Plan:</span> {caseData.clinical_outcomes[0].care_plan}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cryptographic Audit Trail Slice */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span>Case Audit Trail (Cryptographically Chained)</span>
                  </h2>
                  <span className="text-[10px] text-slate-400">Immutable SHA-256 Chain</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono space-y-1">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>{new Date(log.created_at).toLocaleTimeString()} • {log.actor} ({log.role})</span>
                        <span className="text-teal-700 font-bold">{log.action}</span>
                      </div>
                      <div className="text-slate-800 text-[11px] font-sans">{log.detail}</div>
                      <div className="text-[9px] text-slate-400 truncate">
                        Hash: {log.record_hash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Closure Evidence Gate & Dual Sign-Off */}
            <div className="space-y-6">
              {/* Evidence Gate Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-teal-600" />
                    <span>Closure Evidence Gate</span>
                  </h2>
                  {closureStatus?.ready_to_close ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      GATE READY
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      BLOCKED
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mb-4">
                  Evidence-before-closure invariant: A case cannot be closed based on sent notifications alone.
                </p>

                {/* Evidence Checklist */}
                <div className="space-y-2 mb-6">
                  {closureStatus?.evidence_items?.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-start space-x-2.5 text-xs ${
                        item.present
                          ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                          : "bg-rose-50/60 border-rose-200 text-rose-900"
                      }`}
                    >
                      {item.present ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-[11px] opacity-80">{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dual Sign-Off Status */}
                <div className="border-t border-slate-100 pt-4 mb-6">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Dual Role Sign-Off Status
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-600 font-medium">1. Referring GP Sign-Off</span>
                      {closureStatus?.signoffs?.gp_signed ? (
                        <span className="font-bold text-emerald-700 flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                          <span>{closureStatus.signoffs.gp_user}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Pending GP</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-600 font-medium">2. Coordinator Sign-Off</span>
                      {closureStatus?.signoffs?.coord_signed ? (
                        <span className="font-bold text-emerald-700 flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                          <span>{closureStatus.signoffs.coord_user}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Pending Coordinator</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sign-Off Action Form (if not closed) */}
                {!isClosed && (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Execute Sign-Off
                    </h3>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Select Role</label>
                      <select
                        value={signoffRole}
                        onChange={(e) => setSignoffRole(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                      >
                        <option value="GP">Referring GP (Ahmed Al-Mansouri)</option>
                        <option value="COORD">Care Navigator (Mariam Al-Hosani)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Clinical Statement</label>
                      <textarea
                        value={signoffStatement}
                        onChange={(e) => setSignoffStatement(e.target.value)}
                        rows={2}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                      />
                    </div>

                    <button
                      onClick={handleSignoff}
                      disabled={actionLoading}
                      className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      {actionLoading ? "Submitting Sign-off..." : `Sign-Off as ${signoffRole}`}
                    </button>
                    <p className="text-[10px] text-slate-400 italic text-center">
                      *Note: Invariant enforces that the GP and Coordinator sign-offs must be separate users.
                    </p>
                  </div>
                )}

                {/* Final Closure Seal Action */}
                {!isClosed && (
                  <div className="border-t border-slate-100 pt-4 mt-4 space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Seal & Close Care Journey
                    </h3>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Disposition</label>
                      <select
                        value={disposition}
                        onChange={(e) => setDisposition(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                      >
                        <option value="TREATMENT_COMPLETED">Treatment Completed</option>
                        <option value="REFERRED_OUT_LONG_TERM">Referred to Chronic Care</option>
                        <option value="MONITORING_ESTABLISHED">Stable Monitoring Protocol</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Closure Rationale</label>
                      <input
                        type="text"
                        value={closeReason}
                        onChange={(e) => setCloseReason(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                      />
                    </div>

                    <button
                      onClick={handleCloseCase}
                      disabled={!closureStatus?.ready_to_close || actionLoading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center justify-center space-x-1"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{actionLoading ? "Sealing..." : "Seal & Close CareLoop"}</span>
                    </button>

                    {!closureStatus?.ready_to_close && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        <span className="font-semibold">Closure Gate Active:</span> Complete all checklist items and dual sign-offs before sealing.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FHIR Modal */}
      {showFhir && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-800 text-sm">FHIR R4 Bundle: {caseId}</h3>
              </div>
              <button
                onClick={() => setShowFhir(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-b-xl">
              <pre>{JSON.stringify(fhirData, null, 2)}</pre>
            </div>
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowFhir(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
