"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import { api, getCurrentUser } from "@/lib/api";
import {
  Stethoscope,
  MessageSquare,
  Clock,
  CheckCircle,
  Plus,
  Send,
  User,
  ArrowRight,
  RefreshCw,
  Building,
  HelpCircle,
  FileText
} from "lucide-react";

export default function MicroConsultsPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Consult Modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [targetSpecialty, setTargetSpecialty] = useState("Endocrinology");
  const [consultQuestion, setConsultQuestion] = useState("");

  // Answer Modal state
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [selectedConsult, setSelectedConsult] = useState<any>(null);
  const [consultAnswer, setConsultAnswer] = useState("");

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.getCases();
      setCases(data);
      if (data.length > 0 && !selectedCaseId) {
        setSelectedCaseId(data[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load consult cases.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !consultQuestion) return;

    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.createConsult(selectedCaseId, {
        specialty: targetSpecialty,
        question: consultQuestion,
        priority: "ROUTINE",
      });
      setSuccessMsg(`Micro-consult dispatched to ${targetSpecialty} team for case ${selectedCaseId}!`);
      setShowNewModal(false);
      setConsultQuestion("");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create micro-consult.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnswerConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsult || !consultAnswer) return;

    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.answerConsult(selectedConsult.id, consultAnswer);
      setSuccessMsg(`Answer documented for Consult #${selectedConsult.id}!`);
      setShowAnswerModal(false);
      setConsultAnswer("");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit consult answer.");
    } finally {
      setActionLoading(false);
    }
  };

  // Extract all consults across cases
  const consultList: any[] = [];
  cases.forEach((c) => {
    if (c.consults) {
      c.consults.forEach((cs: any) => {
        consultList.push({
          ...cs,
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
                <Stethoscope className="w-6 h-6 text-teal-600" />
                <h1 className="text-2xl font-bold text-slate-900">
                  Clinician-to-Clinician Micro-Consults
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Rapid asynchronous specialist guidance before or in lieu of formal hospital referrals.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Request Micro-Consult</span>
              </button>
              <button
                onClick={loadData}
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
              <HelpCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
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

          {/* Micro-consults List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Active Consult Threads ({consultList.length})
              </span>
              <span className="text-xs text-slate-400">Target Response SLA: 24 Hours</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
                <p className="text-xs">Loading consult discussions...</p>
              </div>
            ) : consultList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No micro-consults currently registered. Click &quot;Request Micro-Consult&quot; to initiate a clinical inquiry.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {consultList.map((cs: any) => {
                  const isAnswered = cs.status === "ANSWERED";
                  return (
                    <div
                      key={cs.id}
                      className="p-6 hover:bg-slate-50/50 transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            Consult #{cs.id}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                            {cs.specialty}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isAnswered ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {cs.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(cs.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Question box */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <span>Inquiring GP: <span className="font-semibold text-slate-700">{cs.requested_by}</span></span>
                          <Link href={`/cases/${cs.parentCase.id}`} className="font-mono text-teal-700 hover:underline">
                            Case {cs.parentCase.id} ({cs.parentCase.screening_type})
                          </Link>
                        </div>
                        <p className="text-slate-800 font-medium pt-1">&ldquo;{cs.question}&rdquo;</p>
                      </div>

                      {/* Answer box if present */}
                      {isAnswered && (
                        <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-teal-800 text-[11px]">
                            <span className="font-bold flex items-center space-x-1">
                              <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
                              <span>Specialist Guidance ({cs.answered_by})</span>
                            </span>
                            <span className="text-[10px] text-teal-600">{new Date(cs.answered_at).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-slate-800 pt-1">{cs.answer}</p>
                        </div>
                      )}

                      {/* Answer action for specialists */}
                      {!isAnswered && (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => {
                              setSelectedConsult(cs);
                              setShowAnswerModal(true);
                            }}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Provide Specialist Guidance</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Consult Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-teal-700">
                <Stethoscope className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-sm">Initiate Micro-Consult</h3>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateConsult} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Case</label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} - {c.screening_type} ({c.screening_value} {c.screening_unit}) - {c.current_owner}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Specialist Discipline</label>
                <select
                  value={targetSpecialty}
                  onChange={(e) => setTargetSpecialty(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                >
                  <option value="Endocrinology">Endocrinology & Diabetes</option>
                  <option value="Cardiology">Cardiology & Hypertension</option>
                  <option value="Gastroenterology">Gastroenterology (Colorectal)</option>
                  <option value="Pulmonology">Pulmonology</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Clinical Inquiry</label>
                <textarea
                  value={consultQuestion}
                  onChange={(e) => setConsultQuestion(e.target.value)}
                  placeholder="e.g. Borderline HbA1c 6.8% with metabolic syndrome: recommend starting metformin in primary care or immediate formal referral?"
                  rows={3}
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg shadow-sm"
                >
                  {actionLoading ? "Submitting..." : "Send Micro-Consult"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Answer Consult Modal */}
      {showAnswerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-teal-700">
                <Send className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Respond to Consult #{selectedConsult?.id}
                </h3>
              </div>
              <button
                onClick={() => setShowAnswerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Question from GP:</span>
              <p className="text-slate-800 italic">&ldquo;{selectedConsult?.question}&rdquo;</p>
            </div>

            <form onSubmit={handleAnswerConsult} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Specialist Recommendation & Guidance
                </label>
                <textarea
                  value={consultAnswer}
                  onChange={(e) => setConsultAnswer(e.target.value)}
                  placeholder="Provide structured guidance, e.g. 'Initiate Metformin 500mg daily in primary care. Repeat HbA1c in 90 days; if >7.0%, send formal referral.'"
                  rows={4}
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnswerModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg shadow-sm"
                >
                  {actionLoading ? "Submitting..." : "Publish Guidance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
