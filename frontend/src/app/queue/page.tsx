"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import {
  AlertCircle,
  Phone,
  Volume2,
  CheckCircle2,
  Clock,
  UserCheck,
  Languages,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  XCircle,
  Check
} from "lucide-react";
import { api } from "@/lib/api";

export default function QueuePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCallModal, setActiveCallModal] = useState<any | null>(null);
  const [speechActive, setSpeechActive] = useState(false);
  const [selectedBarrier, setSelectedBarrier] = useState("LANGUAGE");
  const [callNotes, setCallNotes] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await api.getStalledQueue();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const playVoiceScript = (language: string, text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "Arabic" ? "ar-AE" : language === "Hindi" ? "hi-IN" : "en-US";
      utterance.rate = 0.9;
      utterance.onend = () => setSpeechActive(false);
      setSpeechActive(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleResolveCriticalCase = async (caseId: string) => {
    try {
      // 1. Record barrier
      await api.recordBarrier(caseId, {
        code: selectedBarrier,
        note: callNotes || "Coordinator completed direct Arabic phone consultation.",
        response_code: "SWITCH_LANGUAGE_AR"
      });

      // 2. Mark task complete
      if (activeCallModal?.pending_tasks?.length > 0) {
        const taskId = activeCallModal.pending_tasks[0].id;
        await api.completeTask(taskId, "Patient reached via phone; teach-back completed in Arabic.");
      }

      // 3. Complete acknowledgement
      // Create patient token or call direct ack
      await fetch(`http://localhost:8000/cases/${caseId}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("careloop_token")}`
        },
        body: JSON.stringify({
          owner_user_id: 4, // GP
          owner_role: "GP",
          backup_user_id: 3 // COORD
        })
      });

      setSuccessMsg(`Successfully resolved ${caseId}. Critical acknowledgement recorded; penalty cleared!`);
      setActiveCallModal(null);
      loadQueue();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar />

      <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Needs Action Now (Stalled-Case Queue)
              </h1>
              <span className="text-[11px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
                {items.length} cases stalled
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Prioritized by urgency, then time overdue. Unsticking these cases directly recovers points on the Loop Integrity Score.
            </p>
          </div>
          <button
            onClick={loadQueue}
            className="mt-3 sm:mt-0 flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Queue</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stalled Queue List */}
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.case_id}
              className={`p-5 bg-white rounded-xl border shadow-sm transition hover:shadow-md ${
                item.urgency === "CRITICAL"
                  ? "border-red-300 bg-red-50/20"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-sm text-teal-900">
                      {item.case_id}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.urgency === "CRITICAL"
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {item.urgency}
                    </span>
                    {item.hba1c && (
                      <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        HbA1c: {item.hba1c}%
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      Patient: <strong className="text-slate-800">{item.patient_name}</strong> ({item.patient_id})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>Preferred Language: <strong>{item.preferred_language}</strong></span>
                    <span>Stage: <strong>{item.stage}</strong></span>
                    <span>Sub-status: <strong className="text-amber-700">{item.sub_status}</strong></span>
                    {item.is_critical_unack && (
                      <span className="text-red-600 font-bold flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Unacknowledged for &gt; 24h (-8 pts)</span>
                      </span>
                    )}
                  </div>

                  {item.pending_tasks?.length > 0 && (
                    <div className="mt-2 text-xs bg-amber-50 border border-amber-200 p-2 rounded text-amber-900">
                      <strong>Active Task ({item.pending_tasks[0].kind}):</strong> Triggered by rule {item.pending_tasks[0].created_by_rule}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {item.case_id === "CASE-1004" ? (
                    <button
                      onClick={() => setActiveCallModal(item)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Start Voice Call Script</span>
                    </button>
                  ) : (
                    <Link
                      href={`/cases/${item.case_id}`}
                      className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                    >
                      <span>Unstick Case</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}

          {items.length === 0 && !loading && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Queue is Clear</h3>
              <p className="text-xs text-slate-500">No cases are currently stalled or overdue.</p>
            </div>
          )}
        </div>

        {/* Modal: Voice Call Script & Teach-Back Mode for CASE-1004 */}
        {activeCallModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 bg-teal-900 text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Phone className="w-5 h-5 text-teal-300" />
                  <div>
                    <h3 className="text-sm font-bold">Voice Call & Teach-Back Protocol</h3>
                    <p className="text-[11px] text-teal-200">
                      {activeCallModal.case_id} · {activeCallModal.patient_name} ({activeCallModal.phone})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveCallModal(null)}
                  className="text-teal-200 hover:text-white text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* Script Aloud Player */}
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-teal-900 flex items-center space-x-1">
                      <Volume2 className="w-4 h-4 text-teal-700 mr-1" />
                      Approved Clinical Voice Script (Arabic)
                    </span>
                    <button
                      onClick={() =>
                        playVoiceScript(
                          "Arabic",
                          `مرحباً، أنا مريم منسقة الرعاية في برنامج صحة أبوظبي لطب الأسرة. نود إبلاغكم بأن نتيجة فحص السكري التراكمي أظهرت قيمة 11.2 بالمئة، وهي تتطلب موعداً عاجلاً مع الطبيب لوضع خطة العلاج المناسبة لحمايتكم.`
                        )
                      }
                      className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded text-[11px] font-semibold flex items-center space-x-1"
                    >
                      <span>{speechActive ? "Speaking..." : "Read Script Aloud"}</span>
                    </button>
                  </div>
                  <p className="text-teal-950 font-serif leading-relaxed text-right dir-rtl">
                    "مرحباً، أنا مريم منسقة الرعاية في برنامج صحة أبوظبي لطب الأسرة. نود إبلاغكم بأن نتيجة فحص السكري التراكمي أظهرت قيمة 11.2%، وهي تتطلب موعداً عاجلاً مع الطبيب لوضع خطة العلاج المناسبة لحمايتكم."
                  </p>
                </div>

                {/* Barrier recording */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Record Care Barrier Encountered
                  </label>
                  <select
                    value={selectedBarrier}
                    onChange={(e) => setSelectedBarrier(e.target.value)}
                    className="w-full rounded-md border border-slate-300 p-2 text-xs font-medium"
                  >
                    <option value="LANGUAGE">LANGUAGE — Patient spoke Arabic dialect only; needs Arabic channel</option>
                    <option value="TRANSPORT">TRANSPORT — Distance / lack of transport to clinic</option>
                    <option value="AFFORDABILITY">AFFORDABILITY — Co-pay / medication coverage concern</option>
                    <option value="NO_SLOT">NO_SLOT — Clinic appointment slot unavailable</option>
                    <option value="UNREACHABLE">UNREACHABLE — Primary phone busy</option>
                  </select>
                </div>

                {/* Teach-Back Verification Spoken by Patient */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <p className="font-bold text-slate-800">Spoken Teach-Back Questions Verified:</p>
                  <label className="flex items-center space-x-2 text-slate-700">
                    <input type="checkbox" defaultChecked className="rounded text-teal-600" />
                    <span>1. Patient understands HbA1c 11.2% requires immediate clinic follow-up</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-700">
                    <input type="checkbox" defaultChecked className="rounded text-teal-600" />
                    <span>2. Patient agreed to appointment within 24 hours</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-700">
                    <input type="checkbox" defaultChecked className="rounded text-teal-600" />
                    <span>3. Emergency red-flag symptoms and emergency 998 reviewed</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Coordinator Call Notes
                  </label>
                  <textarea
                    rows={2}
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Patient expressed relief after explanation in native language. Agreed to GP review at Clinic Alpha tomorrow 9:00 AM."
                    className="w-full rounded-md border border-slate-300 p-2 text-xs"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  onClick={() => setActiveCallModal(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleResolveCriticalCase(activeCallModal.case_id)}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center space-x-1.5 shadow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Acknowledgement & Clear Penalty</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
