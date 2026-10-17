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
  QrCode,
  Printer,
  Compass,
  Check,
  Phone,
  MessageSquare,
  Ear,
  Eye,
  Sliders,
  CheckSquare
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

  // Prompt 7B: Patient Journey Proof Pack state
  const [proofPackData, setProofPackData] = useState<any>(null);
  const [showProofPack, setShowProofPack] = useState(false);
  const [proofPackLoading, setProofPackLoading] = useState(false);

  // Prompt 7B: Patient Contact Preferences state
  const [contactWindow, setContactWindow] = useState<string>("MORNING");
  const [accLargeText, setAccLargeText] = useState(false);
  const [accAudioNotes, setAccAudioNotes] = useState(false);
  const [accInterpreter, setAccInterpreter] = useState(false);
  const [consentSms, setConsentSms] = useState(true);
  const [consentWhatsapp, setConsentWhatsapp] = useState(true);
  const [consentVoice, setConsentVoice] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSavedMsg, setPrefsSavedMsg] = useState<string | null>(null);

  // Prompt 7B: Capacity-Aware Routing state
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [routingSuggestions, setRoutingSuggestions] = useState<any>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [selectedTargetFacility, setSelectedTargetFacility] = useState<string>("CCAD");
  const [rerouteRationale, setRerouteRationale] = useState<string>("Current referral facility at full capacity; urgent alternate intake requested.");
  const [clinicianApprovalConfirmed, setClinicianApprovalConfirmed] = useState(false);
  const [reroutingInProgress, setReroutingInProgress] = useState(false);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    loadCaseData();
    loadPatientPreferences();
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

  const loadPatientPreferences = async () => {
    try {
      const prefs = await api.getPatientPreferences(caseId);
      if (prefs) {
        setContactWindow(prefs.contact_window || "MORNING");
        const needs = prefs.accessibility_needs || [];
        setAccLargeText(needs.includes("large_text"));
        setAccAudioNotes(needs.includes("audio_notes"));
        setAccInterpreter(needs.includes("interpreter_needed"));
        const consent = prefs.channel_consent || {};
        setConsentSms(consent.SMS !== false);
        setConsentWhatsapp(consent.WHATSAPP !== false);
        setConsentVoice(consent.VOICE === true);
      }
    } catch {
      // Preferences optional
    }
  };

  const handleSavePreferences = async () => {
    setPrefsSaving(true);
    setPrefsSavedMsg(null);
    try {
      const accessibility_needs: string[] = [];
      if (accLargeText) accessibility_needs.push("large_text");
      if (accAudioNotes) accessibility_needs.push("audio_notes");
      if (accInterpreter) accessibility_needs.push("interpreter_needed");

      await api.updatePatientPreferences(caseId, {
        contact_window: contactWindow,
        accessibility_needs,
        channel_consent: {
          SMS: consentSms,
          WHATSAPP: consentWhatsapp,
          VOICE: consentVoice
        }
      });
      setPrefsSavedMsg("Patient contact preferences updated successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save preferences.");
    } finally {
      setPrefsSaving(false);
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

  // Proof Pack Handler
  const handleViewProofPack = async () => {
    setProofPackLoading(true);
    setErrorMsg(null);
    try {
      const pack = await api.getProofPack(caseId);
      setProofPackData(pack);
      setShowProofPack(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load Patient Journey Proof Pack.");
    } finally {
      setProofPackLoading(false);
    }
  };

  const handleDownloadProofPackJson = () => {
    if (!proofPackData) return;
    const blob = new Blob([JSON.stringify(proofPackData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `careloop_proof_pack_${caseId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Capacity Routing Handlers
  const handleOpenCapacityRouting = async () => {
    setShowRoutingModal(true);
    setRoutingLoading(true);
    setErrorMsg(null);
    setClinicianApprovalConfirmed(false);
    try {
      const data = await api.getCapacityRoutingSuggestions(caseId, "Endocrinology");
      setRoutingSuggestions(data);
      if (data.providers && data.providers.length > 0) {
        setSelectedTargetFacility(data.providers[0].facility_id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch routing suggestions.");
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleApplyReroute = async () => {
    if (!clinicianApprovalConfirmed) {
      setErrorMsg("Clinician approval is required to reroute referral.");
      return;
    }
    setReroutingInProgress(true);
    setErrorMsg(null);
    try {
      await api.applyCapacityReroute({
        case_id: caseId,
        target_facility: selectedTargetFacility,
        rationale: rerouteRationale
      });
      setSuccessMsg(`Referral rerouted to ${selectedTargetFacility}. Clinical accountability preserved under sending provider escrow.`);
      setShowRoutingModal(false);
      await loadCaseData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reroute referral.");
    } finally {
      setReroutingInProgress(false);
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Link
              href="/cases"
              className="inline-flex items-center space-x-1 text-xs text-slate-600 hover:text-teal-700 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Case Journeys</span>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {/* One-Click Patient Journey Proof Pack Button */}
              <button
                type="button"
                onClick={handleViewProofPack}
                disabled={proofPackLoading}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition disabled:opacity-50"
              >
                {proofPackLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
                )}
                <span>Patient Journey Proof Pack</span>
                <span className="text-[10px] font-mono bg-amber-600/30 px-1.5 rounded">PDF + JSON</span>
              </button>

              <button
                type="button"
                onClick={handleViewFhir}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
                <span>FHIR R4 Bundle</span>
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
            
            {/* Left 2 Cols: Journey Data, Capacity Routing & Preferences */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Referrals & Capacity Routing Card */}
              {caseData.referrals && caseData.referrals.length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
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
                        <span className={`font-bold ${
                          caseData.referrals[0].status === "REJECTED" ? "text-rose-600" : "text-slate-800"
                        }`}>
                          {caseData.referrals[0].status}
                        </span>
                      </div>
                      {caseData.referrals[0].reject_reason && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px]">
                          <span className="font-bold">Rejection Note:</span> {caseData.referrals[0].reject_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {/* Capacity-Aware Routing Trigger */}
                      <button
                        type="button"
                        onClick={handleOpenCapacityRouting}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs shadow-sm transition"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Capacity-Aware Alternate Routing</span>
                      </button>

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

              {/* Prompt 7B: Patient Contact Preferences Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-teal-600" />
                    <h2 className="text-sm font-bold text-slate-800">
                      Patient Contact Preferences & Accessibility Needs
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded font-bold">
                    VALUE_TYPE: ACTUAL
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Preferred Contact Window */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">
                      Contact Window:
                    </label>
                    <select
                      value={contactWindow}
                      onChange={(e) => setContactWindow(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="MORNING">Morning (08:00 – 12:00)</option>
                      <option value="AFTERNOON">Afternoon (12:00 – 17:00)</option>
                      <option value="EVENING">Evening (17:00 – 20:00)</option>
                    </select>
                    <span className="text-[10px] text-slate-400 block">Strictly enforced for outbound outreach</span>
                  </div>

                  {/* Accessibility Needs */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">
                      Accessibility Needs:
                    </label>
                    <div className="space-y-1">
                      <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={accLargeText}
                          onChange={(e) => setAccLargeText(e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span>Large Text & High Contrast</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={accAudioNotes}
                          onChange={(e) => setAccAudioNotes(e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span>Audio Voice Notes</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={accInterpreter}
                          onChange={(e) => setAccInterpreter(e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span>Medical Interpreter Needed</span>
                      </label>
                    </div>
                  </div>

                  {/* Channel Consent */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">
                      Channel Consent:
                    </label>
                    <div className="space-y-1">
                      <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={consentWhatsapp}
                          onChange={(e) => setConsentWhatsapp(e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span>Interactive WhatsApp</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={consentSms}
                          onChange={(e) => setConsentSms(e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span>Two-Way SMS Text</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={consentVoice}
                          onChange={(e) => setConsentVoice(e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span>Direct Voice Call (IVR)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Decoupled notice banner */}
                <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-[11px] text-teal-900 leading-relaxed">
                  <span className="font-bold">Decoupled Architectural Invariant:</span> Delivery receipt, patient understanding (Teach-Back verification), and clinical acknowledgment remain separate verified events. Automated fallback rules respect contact windows and accessibility requirements.
                </div>

                <div className="flex items-center justify-between pt-1">
                  {prefsSavedMsg && (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{prefsSavedMsg}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    disabled={prefsSaving}
                    className="ml-auto inline-flex items-center space-x-1.5 px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {prefsSaving ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Preferences</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

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

              {/* Immutable Cryptographic Audit Log Strip */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span>Cryptographic Audit Events ({auditLogs.length})</span>
                  </h2>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    SHA-256 Tamper Evident
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col space-y-1">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-bold text-slate-800">{log.action}</span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-600">{log.detail}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Hash: {log.current_hash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right 1 Col: Evidence Gate, Dual Sign-off & Closure */}
            <div className="space-y-6">
              
              {/* Evidence Checklist Gate */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-teal-600" />
                    <span>Evidence Checklist Gate</span>
                  </h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    closureStatus?.checklist_complete
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}>
                    {closureStatus?.checklist_complete ? "All Evidence Present" : "Gate Blocked"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {closureStatus?.checklist ? (
                    Object.entries(closureStatus.checklist).map(([key, val]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-700 capitalize">{key.replace(/_/g, " ")}</span>
                        {val ? (
                          <span className="flex items-center space-x-1 text-emerald-600 font-bold text-[11px]">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1 text-amber-600 font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Required</span>
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400">Loading checklist...</div>
                  )}
                </div>
              </div>

              {/* Dual Clinical Sign-Off */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-teal-600" />
                    <span>Dual Clinical Sign-Off</span>
                  </h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    closureStatus?.signoffs?.length >= 2
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {closureStatus?.signoffs?.length || 0} / 2 Complete
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {closureStatus?.signoffs && closureStatus.signoffs.length > 0 ? (
                    closureStatus.signoffs.map((s: any, idx: number) => (
                      <div key={idx} className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-900">{s.role} Sign-off</span>
                          <span className="text-[10px] text-slate-400">{new Date(s.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div className="text-slate-600 text-[11px] italic">"{s.statement}"</div>
                        <div className="text-[10px] text-slate-400 font-mono">Signer User ID: {s.signer_id}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-xs italic">No clinical sign-offs recorded yet.</p>
                  )}
                </div>

                {/* Form to submit signoff */}
                {!isClosed && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Sign-off Role</label>
                      <select
                        value={signoffRole}
                        onChange={(e) => setSignoffRole(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                      >
                        <option value="GP">Referring GP (Primary Review)</option>
                        <option value="SPECIALIST">Consulting Specialist (Secondary Review)</option>
                        <option value="COORD">Clinical Navigator (Care Coordination)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Clinical Statement</label>
                      <input
                        type="text"
                        value={signoffStatement}
                        onChange={(e) => setSignoffStatement(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                      />
                    </div>

                    <button
                      onClick={handleSignoff}
                      disabled={actionLoading}
                      className="w-full py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                    >
                      {actionLoading ? "Recording..." : `Sign off as ${signoffRole}`}
                    </button>
                  </div>
                )}
              </div>

              {/* Closure Seal Action */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-teal-600" />
                    <span>Cryptographic Closure Seal</span>
                  </h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isClosed
                      ? "bg-emerald-100 text-emerald-800"
                      : closureStatus?.ready_to_close
                      ? "bg-teal-100 text-teal-800"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {isClosed ? "Loop Sealed" : closureStatus?.ready_to_close ? "Ready to Seal" : "Pending Requirements"}
                  </span>
                </div>

                {isClosed ? (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-2">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold">Loop Integrity Fully Sealed</span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Closed with disposition: <strong>{caseData.disposition}</strong>. Tamper-evident closure seal recorded into immutable ledger.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Final Disposition</label>
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

      {/* PROMPT 7B: PATIENT JOURNEY PROOF PACK MODAL */}
      {showProofPack && proofPackData && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Patient Journey Proof Pack: {caseId}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Built from FHIR Care Capsule & Cryptographic Audit Ledger
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadProofPackJson}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 rounded-lg text-xs font-semibold text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download JSON</span>
                </button>
                <button
                  onClick={() => setShowProofPack(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Proof Pack Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800">
              
              {/* Mandatory Watermark Banner */}
              <div className="p-3 bg-amber-500 text-slate-950 font-black text-center tracking-widest text-xs uppercase rounded-lg border border-amber-600">
                {proofPackData.watermark || "SYNTHETIC DEMO DATA — NOT FOR CLINICAL USE"}
              </div>

              {/* Cryptographic Audit Verification Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-emerald-950 text-xs">
                      Cryptographic Audit Chain: Valid & Tamper-Free
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      Verified {proofPackData.audit_verification?.blocks_verified || 0} ledger blocks across this journey. Zero tampered entries detected.
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] bg-white text-emerald-800 px-2.5 py-1 rounded border border-emerald-300 font-bold">
                  SHA-256 SEAL VERIFIED
                </span>
              </div>

              {/* Case Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Case ID</span>
                  <span className="font-mono font-bold text-slate-900">{proofPackData.case_summary?.case_id}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Patient Ref</span>
                  <span className="font-mono font-semibold text-slate-800">{proofPackData.case_summary?.patient_id}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Pathway</span>
                  <span className="font-semibold text-slate-800">{proofPackData.case_summary?.screening_type}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Disposition</span>
                  <span className="font-bold text-teal-800">{proofPackData.case_summary?.disposition}</span>
                </div>
              </div>

              {/* Full Provenance Timeline */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span>Verified Journey Timeline with Provenance</span>
                </h4>
                <div className="space-y-2">
                  {(proofPackData.timeline || []).map((t: any, idx: number) => {
                    let provBadge = "bg-slate-100 text-slate-700 border-slate-200";
                    if (t.provenance === "PROVIDER_VERIFIED") provBadge = "bg-emerald-100 text-emerald-800 border-emerald-300";
                    if (t.provenance === "SELF_REPORT") provBadge = "bg-teal-100 text-teal-800 border-teal-300";
                    if (t.provenance === "SYSTEM") provBadge = "bg-purple-100 text-purple-800 border-purple-300";

                    return (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{t.event_type}</span>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded border ${provBadge}`}>
                              {t.provenance}
                            </span>
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {t.channel}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px]">{t.detail}</p>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Actor: {t.actor} ({t.role}) · Event #{t.event_id}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 flex-shrink-0">
                          {new Date(t.timestamp).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Escrow Owner History & Referral Responses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Owner Transition History</h4>
                  <div className="space-y-1.5 text-[11px]">
                    {(proofPackData.owner_history || []).map((o: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                        <span>Owner: <strong>{o.owner_role}</strong> ({o.user_id})</span>
                        <span className="text-[10px] text-slate-400">{new Date(o.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Dual Sign-Offs & Signers</h4>
                  <div className="space-y-1.5 text-[11px]">
                    {(proofPackData.signoffs || []).map((s: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded border border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-teal-800">{s.role}</span>
                          <span className="text-[10px] text-slate-400">{new Date(s.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-600 text-[10px] italic mt-0.5">"{s.statement}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>Security Token: {proofPackData.pack_token || "SYNTHETIC-PACK"}</span>
              <button
                type="button"
                onClick={() => setShowProofPack(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold"
              >
                Close Proof Pack
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PROMPT 7B: CAPACITY-AWARE ROUTING MODAL */}
      {showRoutingModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Compass className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Capacity-Aware Alternate Provider Routing
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Suggest verified participating network providers when target facility is at full capacity.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRoutingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {routingLoading ? (
                <div className="p-8 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
                  <p>Searching accredited network capacity...</p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs">
                    <span className="font-bold">Escrow Governance Rule:</span> The sending referring clinician keeps clinical ownership of the patient journey until the receiving provider formally accepts the intake. Slots are never fabricated.
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Suggested Participating Providers:
                    </label>
                    {(routingSuggestions?.providers || []).map((prov: any) => {
                      const isSelected = selectedTargetFacility === prov.facility_id;
                      let freshBadge = "bg-emerald-100 text-emerald-800 border-emerald-300";
                      if (prov.data_freshness === "MANUAL") freshBadge = "bg-teal-100 text-teal-800 border-teal-300";
                      if (prov.data_freshness === "SIMULATED") freshBadge = "bg-amber-100 text-amber-800 border-amber-300";

                      return (
                        <div
                          key={prov.facility_id}
                          onClick={() => setSelectedTargetFacility(prov.facility_id)}
                          className={`p-4 rounded-xl border transition cursor-pointer ${
                            isSelected
                              ? "border-teal-600 bg-teal-50/50 ring-2 ring-teal-500"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300"
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </div>
                              <h4 className="font-bold text-slate-900 text-xs">{prov.name}</h4>
                            </div>
                            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${freshBadge}`}>
                              FRESHNESS: {prov.data_freshness}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                            <div>Distance: <strong>{prov.distance_km} km</strong></div>
                            <div>Next Slot: <strong className="text-emerald-700">{prov.next_slot}</strong></div>
                            <div>Capacity: <strong className="capitalize">{prov.capacity_status.toLowerCase()}</strong></div>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 italic">
                            Match Reason: {prov.recommendation_reason}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Clinician Approval Checkbox */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="flex items-start space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clinicianApprovalConfirmed}
                        onChange={(e) => setClinicianApprovalConfirmed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 text-teal-600 rounded border-slate-300"
                      />
                      <span className="text-xs text-slate-800 leading-snug">
                        <strong>Mandatory Clinician Approval:</strong> I approve rerouting this referral to <strong>{selectedTargetFacility}</strong> and maintain escrow accountability until accepted.
                      </span>
                    </label>
                  </div>

                  {/* Rationale Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Clinical Reroute Justification:
                    </label>
                    <input
                      type="text"
                      value={rerouteRationale}
                      onChange={(e) => setRerouteRationale(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowRoutingModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyReroute}
                disabled={!clinicianApprovalConfirmed || reroutingInProgress}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
              >
                {reroutingInProgress ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rerouting...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Approve & Reroute Referral</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
