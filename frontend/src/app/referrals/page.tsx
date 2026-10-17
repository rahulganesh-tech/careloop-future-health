"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import { api, getCurrentUser } from "@/lib/api";
import {
  GitBranch,
  Building,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  ExternalLink,
  RefreshCw,
  QrCode,
  FileQuestion,
  RotateCcw,
  ShieldCheck,
  Check,
  Compass,
  CheckSquare
} from "lucide-react";

export default function ReferralsPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reject modal
  const [selectedRef, setSelectedRef] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState<string>("Missing HbA1c lab verification within 30 days");
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Capacity-Aware Routing modal
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [routingSuggestions, setRoutingSuggestions] = useState<any>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [selectedTargetFacility, setSelectedTargetFacility] = useState<string>("CCAD");
  const [rerouteRationale, setRerouteRationale] = useState<string>("Specialist capacity exceeded at original facility; alternate network routing requested.");
  const [clinicianApprovalConfirmed, setClinicianApprovalConfirmed] = useState(false);
  const [reroutingInProgress, setReroutingInProgress] = useState(false);

  const handleOpenAlternateRouting = async (ref: any) => {
    setSelectedRef(ref);
    setShowRoutingModal(true);
    setRoutingLoading(true);
    setErrorMsg(null);
    setClinicianApprovalConfirmed(false);
    try {
      const data = await api.getCapacityRoutingSuggestions(ref.case_id, "Endocrinology");
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

  const handleConfirmReroute = async () => {
    if (!clinicianApprovalConfirmed || !selectedRef) {
      setErrorMsg("Clinician approval is required to reroute referral.");
      return;
    }
    setReroutingInProgress(true);
    setErrorMsg(null);
    try {
      await api.applyCapacityReroute({
        case_id: selectedRef.case_id,
        target_facility: selectedTargetFacility,
        rationale: rerouteRationale
      });
      setSuccessMsg(`Referral ${selectedRef.id} successfully rerouted to ${selectedTargetFacility}. Sender escrow preserved.`);
      setShowRoutingModal(false);
      await loadReferrals();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reroute referral.");
    } finally {
      setReroutingInProgress(false);
    }
  };

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.getCases();
      // Extract cases that have referrals
      setCases(data.filter((c: any) => c.referrals && c.referrals.length > 0));
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load referrals.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (refId: string) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.acceptReferral(refId);
      setSuccessMsg(`Referral ${refId} accepted! Escrow responsibility transferred to specialist.`);
      await loadReferrals();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to accept referral.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReject = (ref: any) => {
    setSelectedRef(ref);
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedRef) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.rejectReferral(selectedRef.id, rejectReason);
      setSuccessMsg(`Referral ${selectedRef.id} rejected with reason: "${rejectReason}". Escrow ownership safely returned to referring GP.`);
      setShowRejectModal(false);
      await loadReferrals();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reject referral.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async (refId: string) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.resubmitReferral(refId);
      setSuccessMsg(`Referral ${refId} resubmitted to specialist with updated documentation!`);
      await loadReferrals();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resubmit referral.");
    } finally {
      setActionLoading(false);
    }
  };

  // Flatten referrals with parent case context
  const referralItems: any[] = [];
  cases.forEach((c) => {
    if (c.referrals) {
      c.referrals.forEach((r: any) => {
        referralItems.push({
          ...r,
          parentCase: c,
        });
      });
    }
  });

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
                <GitBranch className="w-6 h-6 text-teal-600" />
                <h1 className="text-2xl font-bold text-slate-900">
                  Specialist Referral Receiving Inbox
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Facility: <span className="font-semibold text-slate-700">Demo Endocrinology Centre (DEC)</span> • Referral Escrow & Hand-off Ledger
              </p>
            </div>

            <button
              onClick={loadReferrals}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Inbox</span>
            </button>
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

          {/* Concept Explainer Banner */}
          <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-start space-x-3 text-xs text-teal-900">
            <ShieldCheck className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Referral Escrow Invariant:</span> When a GP submits a referral, clinical accountability remains in escrow with the referring GP until the specialist explicitly accepts it. If rejected or stalled past 72 hours, an alert triggers automatically so the patient is never lost between providers.
            </div>
          </div>

          {/* Referrals List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Total Incoming / Managed Referrals ({referralItems.length})
              </span>
              <span className="text-xs text-slate-400">
                Logged with SHA-256 Receipts
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
                <p className="text-xs">Loading referrals ledger...</p>
              </div>
            ) : referralItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No active referrals recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {referralItems.map((ref: any) => {
                  const isPending = ref.status === "PENDING" || ref.status === "SENT";
                  const isAccepted = ref.status === "ACCEPTED";
                  const isRejected = ref.status === "REJECTED";
                  const isCompleted = ref.status === "COMPLETED";

                  return (
                    <div
                      key={ref.id}
                      className="p-6 hover:bg-slate-50/60 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono font-bold text-slate-900 text-sm">{ref.id}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            isAccepted
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : isPending
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : isRejected
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : "bg-teal-100 text-teal-800"
                          }`}>
                            {ref.status}
                          </span>
                          <span className="text-xs text-slate-500">
                            Case: <Link href={`/cases/${ref.parentCase.id}`} className="font-mono font-semibold text-teal-700 hover:underline">{ref.parentCase.id}</Link>
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>Patient: <span className="font-mono font-semibold">{ref.parentCase.patient_id}</span></span>
                          <span>Screening: <span className="font-semibold text-slate-800">{ref.parentCase.screening_type} ({ref.parentCase.screening_value} {ref.parentCase.screening_unit})</span></span>
                          <span>Target: <span className="font-semibold">{ref.receiving_facility}</span></span>
                        </div>

                        {/* Escrow ownership line */}
                        <div className="text-[11px] flex items-center space-x-2 pt-1">
                          <span className="text-slate-400">Escrow Responsible Clinician:</span>
                          <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {ref.escrow_owner}
                          </span>
                        </div>

                        {/* Rejection notice if present */}
                        {ref.reject_reason && (
                          <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-900 text-xs">
                            <span className="font-bold">Rejection Rationale:</span> {ref.reject_reason}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleAccept(ref.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1 transition disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Accept Referral</span>
                            </button>
                            <button
                              onClick={() => handleOpenReject(ref)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1 transition disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject / Return</span>
                            </button>
                          </>
                        )}

                        {isRejected && (
                          <>
                            <button
                              onClick={() => handleResubmit(ref.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1 transition disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Resubmit to Specialist</span>
                            </button>
                            <button
                              onClick={() => handleOpenAlternateRouting(ref)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1 transition"
                            >
                              <Compass className="w-3.5 h-3.5" />
                              <span>Capacity-Aware Routing</span>
                            </button>
                          </>
                        )}

                        <Link
                          href={`/receipts/${ref.receipt_token}`}
                          target="_blank"
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                        >
                          <QrCode className="w-3.5 h-3.5 text-teal-600" />
                          <span>Receipt</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">
                Reject & Return Referral {selectedRef?.id}
              </h3>
            </div>

            <p className="text-xs text-slate-500">
              Select the clinical or administrative reason for returning this referral. Escrow responsibility will immediately transfer back to the referring GP with priority task creation.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Reason Code
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white"
              >
                <option value="Missing HbA1c lab verification within 30 days">Missing baseline lab verification</option>
                <option value="Clinic specialist capacity exceeded - redirect to alternate centre">Clinic specialist capacity exceeded</option>
                <option value="Out of scope - requires pediatric endocrinology rather than adult">Out of scope / wrong specialty</option>
                <option value="Patient already under active specialty care at Cleveland Clinic Abu Dhabi">Patient already in active specialty care</option>
              </select>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                {actionLoading ? "Processing..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capacity-Aware Routing Modal */}
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
                  <p className="text-[10px] text-slate-500 font-mono">
                    Referral #{selectedRef?.id} · Case #{selectedRef?.case_id}
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
                onClick={handleConfirmReroute}
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
    </div>
  );
}
