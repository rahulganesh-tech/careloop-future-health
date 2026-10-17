"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  ShieldCheck,
  CheckCircle,
  Building,
  User,
  Calendar,
  Printer,
  Copy,
  ArrowLeft,
  QrCode,
  Lock,
  Clock,
  AlertCircle
} from "lucide-react";

export default function ReceiptPage() {
  const params = useParams();
  const token = params.token as string;

  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReceipt();
  }, [token]);

  const loadReceipt = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.getReceipt(token);
      setReceipt(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or unknown receipt token.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center text-slate-500 text-xs">
          <Clock className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
          <span>Verifying cryptographic hand-off receipt...</span>
        </div>
      </div>
    );
  }

  if (errorMsg || !receipt) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Invalid Hand-Off Receipt</h2>
          <p className="text-xs text-slate-500">
            {errorMsg || "The requested receipt token could not be cryptographically validated."}
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 text-slate-800">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Top actions bar (hidden on print) */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/referrals"
            className="inline-flex items-center space-x-1 text-xs text-slate-600 hover:text-teal-700 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Referrals</span>
          </Link>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm flex items-center space-x-1"
            >
              <Copy className="w-3.5 h-3.5 text-teal-600" />
              <span>{copied ? "Link Copied!" : "Copy Verification URL"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Receipt</span>
            </button>
          </div>
        </div>

        {/* Printable Official Receipt Card */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 space-y-6 relative overflow-hidden">
          {/* Watermark badge */}
          <div className="absolute top-4 right-4 bg-teal-50 border border-teal-200 text-teal-800 px-3 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>MALAFFI-READY ESCROW HANDOFF</span>
          </div>

          {/* Header */}
          <div className="border-b border-slate-200 pb-4">
            <div className="text-[10px] uppercase font-bold tracking-wider text-teal-700">
              Department of Health - Abu Dhabi • Screening-to-Care Loop
            </div>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              Official Care Hand-off Receipt
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Receipt Token: {receipt.receipt_token}
            </p>
          </div>

          {/* Escrow Status Banner */}
          <div className={`p-4 rounded-xl border flex items-center space-x-3 text-xs ${
            receipt.status === "ACCEPTED"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : receipt.status === "REJECTED"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}>
            <Lock className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-bold">
                Escrow State: {receipt.status}
              </div>
              <div className="text-[11px] opacity-90">
                Currently Accountable Clinician: <span className="font-mono font-bold">{receipt.escrow_owner}</span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Referral Record</span>
              <div className="font-mono font-bold text-slate-900">{receipt.id}</div>
              <div className="text-slate-600 font-mono">Case: {receipt.case_id}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Patient Synthetic ID</span>
              <div className="font-mono font-bold text-slate-900">{receipt.patient_id || "PT-SYNTH-ESCROW"}</div>
              <div className="text-slate-500 text-[10px]">Identified under DoH Privacy Sandbox</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Receiving Facility</span>
              <div className="font-bold text-slate-900">{receipt.receiving_facility}</div>
              <div className="text-slate-500 text-[10px]">Endocrinology & Diabetes Clinic</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Timestamp</span>
              <div className="font-mono font-medium text-slate-800">
                {new Date(receipt.created_at).toLocaleString()}
              </div>
              <div className="text-slate-500 text-[10px]">SLA Target: 72 Hours</div>
            </div>
          </div>

          {/* QR Code & Cryptographic Stamp */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cryptographically Audited Hand-off</span>
              </div>
              <p className="text-[10px] text-slate-500 max-w-xs">
                Scan QR code at clinical intake desk to verify escrow release without logging into secondary software.
              </p>
              <div className="text-[9px] font-mono text-slate-400 pt-1">
                SHA-256 Digest: {receipt.receipt_token.slice(0, 32)}...
              </div>
            </div>

            {/* Stylized QR placeholder container */}
            <div className="w-24 h-24 bg-slate-900 p-2 rounded-xl border border-slate-300 flex flex-col items-center justify-center text-teal-400">
              <QrCode className="w-16 h-16" />
              <span className="text-[8px] font-mono text-slate-400 mt-0.5">SCAN RECEIPT</span>
            </div>
          </div>

          {/* Legal Synthetic Disclaimer */}
          <div className="text-[9px] text-slate-400 text-center border-t border-slate-100 pt-3">
            SYNTHETIC DEMO ASSET — CREATED FOR THE FUTURE HEALTH CHALLENGE 2026. DO NOT USE FOR REAL CLINICAL CARE.
          </div>
        </div>
      </div>
    </div>
  );
}
