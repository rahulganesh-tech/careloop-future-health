"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  Activity,
  Heart,
  CheckCircle,
  Clock,
  PhoneCall,
  Calendar,
  AlertCircle,
  Languages,
  ShieldCheck,
  ChevronRight,
  MessageSquare,
  Sparkles
} from "lucide-react";

export default function PatientPortalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const caseId = params.id as string;
  const initialToken = searchParams.get("token") || "";

  const [token, setToken] = useState<string>(initialToken);
  const [isRTL, setIsRTL] = useState(false);
  const [dobInput, setDobInput] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [caseInfo, setCaseInfo] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Teach-back responses
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [callRequested, setCallRequested] = useState(false);

  useEffect(() => {
    if (token) {
      loadPatientCase(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadPatientCase = async (activeToken: string) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.getPatientCase(activeToken);
      setCaseInfo(data);
      setVerified(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired access token.");
      setVerified(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDobChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg(null);
      // Attempt exchange using token or default demo token for case
      const testToken = token || `patient_demo_PT-${caseId.replace("CASE-", "")}`;
      const res = await api.patientExchangeLink(testToken, dobInput);
      setToken(res.access_token);
      await loadPatientCase(res.access_token);
    } catch (err: any) {
      setErrorMsg("Date of birth verification failed. For demo, try 1980-05-14 or 1975-08-22.");
    } finally {
      setLoading(false);
    }
  };

  const handleTeachBackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q1 || !q2 || !q3) {
      setErrorMsg(isRTL ? "يرجى الإجابة على جميع الأسئلة الثلاثة." : "Please answer all 3 questions to confirm understanding.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await api.submitTeachBack(token, isRTL ? "ar" : "en", { q1, q2, q3 });
      await api.acknowledgePatient(token);
      setSuccessMsg(isRTL ? "تم استلام تأكيدك بنجاح. فريق الرعاية على دراية بجاهزيتك." : "Thank you! Your understanding is confirmed and shared with your care team.");
      await loadPatientCase(token);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit confirmation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestCall = async () => {
    try {
      setSubmitting(true);
      await api.requestPatientCall(token, "", "Patient requested call via portal button");
      setCallRequested(true);
      setSuccessMsg(isRTL ? "تم إرسال طلبك. سيتصل بك منسق الرعاية قريباً." : "Call request sent! A Care Navigator will reach out shortly.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send call request.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLanguage = () => {
    setIsRTL(!isRTL);
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen bg-gradient-to-b from-teal-900 via-teal-950 to-slate-950 text-slate-100 flex flex-col justify-between"
    >
      {/* Top Banner */}
      <div className="bg-amber-400 text-slate-950 text-[11px] font-bold py-1.5 px-4 text-center tracking-wide uppercase">
        {isRTL
          ? "بيانات تجريبية مصطنعة — ليست سجلاً طبياً حقيقياً"
          : "SYNTHETIC DEMO PATIENT PORTAL — NOT A REAL MEDICAL RECORD"}
      </div>

      <div className="max-w-md w-full mx-auto px-4 py-6 flex-1 flex flex-col justify-start">
        {/* Brand & Language Selector */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-400 flex items-center justify-center">
              <Heart className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">HealthPulse CareLoop</h1>
              <p className="text-[10px] text-teal-300">Department of Health - Abu Dhabi Partner</p>
            </div>
          </div>
          <button
            onClick={toggleLanguage}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-teal-800/60 border border-teal-600 text-xs text-teal-200 hover:text-white"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{isRTL ? "English" : "العربية"}</span>
          </button>
        </div>

        {/* DOB Challenge if unverified */}
        {!verified && !loading && (
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl space-y-4">
            <div className="text-center">
              <ShieldCheck className="w-10 h-10 text-teal-400 mx-auto mb-2" />
              <h2 className="text-base font-bold text-white">
                {isRTL ? "التحقق من الهوية الشخصية" : "Identity Verification"}
              </h2>
              <p className="text-xs text-teal-200/80 mt-1">
                {isRTL
                  ? "لحماية خصوصيتك، يرجى إدخال تاريخ ميلادك المسجل لعرض نتائج الفحص."
                  : "To view your screening follow-up, please enter your registered Date of Birth."}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-900/50 border border-rose-500 text-rose-200 rounded-lg text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleDobChallenge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-teal-200 mb-1">
                  {isRTL ? "تاريخ الميلاد (YYYY-MM-DD)" : "Date of Birth (YYYY-MM-DD)"}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1980-05-14"
                  value={dobInput}
                  onChange={(e) => setDobInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/40 border border-teal-500/40 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-lg"
              >
                {isRTL ? "عرض حالتي ومتابعة الرعاية" : "Access Care Status"}
              </button>
            </form>

            <div className="text-[10px] text-teal-300/60 text-center">
              {isRTL
                ? "عرض توضيحي سريع: تاريخ الميلاد الافتراضي 1980-05-14 أو 1975-08-22"
                : "Demo shortcut: Try 1980-05-14 (CASE-1001) or 1975-08-22 (CASE-1004)"}
            </div>
          </div>
        )}

        {/* Verified Patient Portal View */}
        {verified && caseInfo && (
          <div className="space-y-4">
            {/* Feedback Banners */}
            {errorMsg && (
              <div className="p-3 bg-rose-900/60 border border-rose-500 text-rose-200 rounded-xl text-xs">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-900/60 border border-emerald-400 text-emerald-200 rounded-xl text-xs flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Screening Result Hero Card */}
            <div className="bg-gradient-to-br from-teal-800/80 to-teal-950/90 p-5 rounded-2xl border border-teal-400/30 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                  {isRTL ? "نتيجة الفحص الوقائي" : "Screening Result"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950">
                  {isRTL ? "مطلوب متابعة" : "Follow-up Required"}
                </span>
              </div>

              <div className="flex items-baseline space-x-2">
                <h2 className="text-xl font-extrabold text-white">{caseInfo.screening_type}</h2>
                <span className="text-lg font-mono font-bold text-amber-300">
                  {caseInfo.screening_value} {caseInfo.screening_unit}
                </span>
              </div>

              <p className="text-xs text-teal-100/90 mt-2 leading-relaxed">
                {isRTL
                  ? "أظهر الفحص مستوى سكر تراكمي مرتفع عن المعدل الطبيعي. التدخل المبكر يمنع المضاعفات المستقبلية ويحمي صحتك."
                  : "Your screening showed an elevated HbA1c result. Early medical guidance helps stabilize sugar levels and safeguards your long-term health."}
              </p>

              <div className="mt-4 pt-3 border-t border-teal-700/50 flex items-center justify-between text-xs text-teal-200">
                <span>{isRTL ? "الطبيب المشرف:" : "Assigned Clinician:"}</span>
                <span className="font-semibold text-white">{caseInfo.current_owner}</span>
              </div>
            </div>

            {/* Care Progress Stepper */}
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300 mb-4">
                {isRTL ? "مراحل مسار الرعاية" : "Your Care Journey"}
              </h3>

              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-200 font-medium">
                    {isRTL ? "1. اكتمال الفحص المخبري" : "1. Lab Screening Completed"}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-200 font-medium">
                    {isRTL ? "2. مراجعة الطبيب وتحديد التدخل" : "2. Clinician Review & Pathway Selected"}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {caseInfo.stage === "REFERRAL_SENT" || caseInfo.stage === "SPECIALIST_ACCEPTED" || caseInfo.stage === "APPOINTMENT_ATTENDED" || caseInfo.stage === "CLOSED_LOOP" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
                  )}
                  <span className="text-slate-200 font-medium">
                    {isRTL ? "3. تحويل إلكتروني مباشر للاختصاصي" : "3. Specialist Referral Escrow"}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {caseInfo.stage === "APPOINTMENT_ATTENDED" || caseInfo.stage === "CLOSED_LOOP" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-500 flex-shrink-0" />
                  )}
                  <span className="text-slate-300">
                    {isRTL ? "4. حضور الموعد واستلام الخطة" : "4. Specialist Consultation"}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {caseInfo.stage === "CLOSED_LOOP" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-500 flex-shrink-0" />
                  )}
                  <span className="text-slate-400">
                    {isRTL ? "5. خطة علاج مستقرة وإغلاق الدورة بأمان" : "5. Closed Loop Care Plan"}
                  </span>
                </div>
              </div>
            </div>

            {/* 3-Question Teach-Back Confirmation */}
            {caseInfo.stage === "RESULT_ACTIONABLE" || caseInfo.stage === "NOTIFIED" ? (
              <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-teal-400/40 shadow-xl space-y-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-teal-300" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300">
                    {isRTL ? "تأكيد الفهم (Teach-Back)" : "Confirm Your Understanding"}
                  </h3>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {isRTL
                    ? "لضمان سلامتك، يرجى الإجابة على هذه الأسئلة البسيطة لنقل حالتك إلى المرحلة التالية وتحديد موعدك:"
                    : "To ensure clear communication, please confirm your understanding so your care team can schedule your priority appointment:"}
                </p>

                <form onSubmit={handleTeachBackSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-white block mb-1">
                      {isRTL ? "1. ما هي نتيجة فحصك؟" : "1. What is the status of your screening result?"}
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center space-x-2 bg-black/30 p-2 rounded-lg cursor-pointer hover:bg-black/50">
                        <input
                          type="radio"
                          name="q1"
                          value="abnormal"
                          checked={q1 === "abnormal"}
                          onChange={() => setQ1("abnormal")}
                          className="text-teal-500"
                        />
                        <span>{isRTL ? "مستوى السكر مرتفع ويحتاج لمتابعة طبية" : "Blood sugar is elevated and needs medical follow-up"}</span>
                      </label>
                      <label className="flex items-center space-x-2 bg-black/30 p-2 rounded-lg cursor-pointer hover:bg-black/50">
                        <input
                          type="radio"
                          name="q1"
                          value="normal"
                          checked={q1 === "normal"}
                          onChange={() => setQ1("normal")}
                          className="text-teal-500"
                        />
                        <span>{isRTL ? "الفحص سليم ولا يحتاج لأي إجراء" : "Everything is normal, no action required"}</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-white block mb-1">
                      {isRTL ? "2. ما هي الخطوة الطبية التالية المقررة لك؟" : "2. What is the recommended next step?"}
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center space-x-2 bg-black/30 p-2 rounded-lg cursor-pointer hover:bg-black/50">
                        <input
                          type="radio"
                          name="q2"
                          value="consult"
                          checked={q2 === "consult"}
                          onChange={() => setQ2("consult")}
                          className="text-teal-500"
                        />
                        <span>{isRTL ? "حضور موعد مع اختصاصي الغدد لوضع خطة علاجية" : "Attend specialist consultation for treatment plan"}</span>
                      </label>
                      <label className="flex items-center space-x-2 bg-black/30 p-2 rounded-lg cursor-pointer hover:bg-black/50">
                        <input
                          type="radio"
                          name="q2"
                          value="wait"
                          checked={q2 === "wait"}
                          onChange={() => setQ2("wait")}
                          className="text-teal-500"
                        />
                        <span>{isRTL ? "الانتظار حتى العام القادم" : "Wait until next year's screening"}</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-white block mb-1">
                      {isRTL ? "3. خلال أي فترة زمنية ينبغي إتمام المتابعة؟" : "3. When should your follow-up happen?"}
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center space-x-2 bg-black/30 p-2 rounded-lg cursor-pointer hover:bg-black/50">
                        <input
                          type="radio"
                          name="q3"
                          value="soon"
                          checked={q3 === "soon"}
                          onChange={() => setQ3("soon")}
                          className="text-teal-500"
                        />
                        <span>{isRTL ? "خلال 7 إلى 14 يوماً" : "Within 7 to 14 days"}</span>
                      </label>
                      <label className="flex items-center space-x-2 bg-black/30 p-2 rounded-lg cursor-pointer hover:bg-black/50">
                        <input
                          type="radio"
                          name="q3"
                          value="months"
                          checked={q3 === "months"}
                          onChange={() => setQ3("months")}
                          className="text-teal-500"
                        />
                        <span>{isRTL ? "بعد 6 أشهر" : "After 6 months"}</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{isRTL ? "تأكيد الفهم والموافقة على التحويل" : "Confirm & Advance Referral"}</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-xs text-emerald-200 flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <span className="font-bold">{isRTL ? "تم تأكيد فهمك لحالتك:" : "Teach-back verified:"}</span>{" "}
                  {isRTL
                    ? "أكدت استلامك وتفهمك لخطة المتابعة. فريق التنسيق يباشر الترتيبات."
                    : "You have verified understanding of the care plan. Coordination is actively underway."}
                </div>
              </div>
            )}

            {/* Assistance Action: Request Coordinator Call */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-white">
                  {isRTL ? "هل لديك استفسار أو صعوبة في الحضور؟" : "Need help with transportation or language?"}
                </div>
                <div className="text-[11px] text-teal-300/80">
                  {isRTL
                    ? "اطلب مكالمة هاتفية مباشرة من منسق الرعاية."
                    : "Request a callback from your dedicated Care Navigator."}
                </div>
              </div>
              <button
                onClick={handleRequestCall}
                disabled={submitting || callRequested}
                className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition flex-shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{callRequested ? (isRTL ? "تم الطلب" : "Requested") : (isRTL ? "اتصل بي" : "Call Me")}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-[10px] text-teal-400/50 border-t border-white/5">
        HealthPulse AI CareLoop • Department of Health - Abu Dhabi Ecosystem • Secure FHIR Gateway
      </footer>
    </div>
  );
}
