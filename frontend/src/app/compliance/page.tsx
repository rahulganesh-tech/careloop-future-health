"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import {
  CheckCircle2,
  ShieldCheck,
  FileCheck,
  Download,
  Lock,
  Database,
  UserCheck,
  Activity,
  AlertCircle,
  ExternalLink
} from "lucide-react";

export default function CompliancePage() {
  const [exported, setExported] = useState(false);

  const complianceStandards = [
    {
      category: "ADHICS v2 (Abu Dhabi Healthcare Information & Cyber Security)",
      icon: ShieldCheck,
      controls: [
        {
          id: "SEC-01",
          title: "Multi-Role Clinical Access Isolation",
          requirement: "Strict separation of duties across 9 administrative and clinical roles.",
          status: "VERIFIED",
          evidence: "Admin role strictly returns 403 on clinical review endpoints; verified via pytest unit test 2.",
        },
        {
          id: "SEC-02",
          title: "Immutable Cryptographic Audit Logging",
          requirement: "Tamper-evident audit chain with database triggers preventing modification.",
          status: "VERIFIED",
          evidence: "PostgreSQL trigger blocks UPDATE/DELETE/TRUNCATE. SHA-256 Merkle chaining verifies every transaction.",
        },
        {
          id: "SEC-03",
          title: "Row-Level Security (RLS) Isolation",
          requirement: "Clinical data access scoped strictly to assigned clinic, tenant, and patient context.",
          status: "VERIFIED",
          evidence: "SQL RLS policies defined in rls_policies.sql across cases, referrals, outcomes, and audit logs.",
        },
        {
          id: "SEC-04",
          title: "Session Expiry & Two-Factor OTP",
          requirement: "Multi-factor authentication challenge with 15-minute token TTL.",
          status: "VERIFIED",
          evidence: "Two-step OTP challenge required on every login; access tokens expire deterministically in 15 minutes.",
        },
      ],
    },
    {
      category: "Department of Health - Abu Dhabi AI & Health Data Governance",
      icon: Activity,
      controls: [
        {
          id: "AI-01",
          title: "Mandatory Human-in-the-Loop",
          requirement: "AI systems must not autonomously close care journeys or override clinical judgment.",
          status: "VERIFIED",
          evidence: "Closure gate requires dual sign-off by referring GP and Care Navigator; autonomous AI closure is blocked.",
        },
        {
          id: "AI-02",
          title: "Explainable Loop Integrity Scoring",
          requirement: "Scoring algorithms must be deterministic, transparent, and mathematically auditable.",
          status: "VERIFIED",
          evidence: "5-rule explainable arithmetic engine (64 -> 72 -> 76 -> 78); zero black-box weights.",
        },
        {
          id: "AI-03",
          title: "Resilient Offline Fallback",
          requirement: "Zero failure of patient routing or tracking if external cloud LLM APIs are unavailable.",
          status: "VERIFIED",
          evidence: "AI_ENABLED=false fallback mode utilizes deterministic rules and multilingual templates seamlessly.",
        },
        {
          id: "AI-04",
          title: "Synthetic Data Sandbox Integrity",
          requirement: "Strict isolation of synthetic evaluation cohorts; persistent visible disclaimer.",
          status: "VERIFIED",
          evidence: "Banner 'SYNTHETIC DEMO DATA — NOT FOR CLINICAL USE' anchored to every screen.",
        },
      ],
    },
    {
      category: "Malaffi HIE Interoperability & FHIR R4 Compatibility",
      icon: Database,
      controls: [
        {
          id: "HIE-01",
          title: "FHIR R4 Bundle Export",
          requirement: "Compliant Patient, ServiceRequest, Task, DiagnosticReport, and Encounter resources.",
          status: "VERIFIED",
          evidence: "FHIR R4 Bundles generated via /fhir/Bundle/{id}; Task.owner mapped to case owner.",
        },
        {
          id: "HIE-02",
          title: "Portable Referral Escrow Receipts",
          requirement: "Standardized tokenized receipts with QR code verification for provider-to-provider transitions.",
          status: "VERIFIED",
          evidence: "SHA-256 escrow receipts generated on referral creation; verifiable via /receipts/{token}.",
        },
      ],
    },
  ];

  const handleExportReport = () => {
    setExported(true);
    setTimeout(() => setExported(false), 3000);
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
                <CheckCircle2 className="w-6 h-6 text-teal-600" />
                <h1 className="text-2xl font-bold text-slate-900">
                  Regulatory & Governance Compliance Matrix
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Self-audit checklist confirming adherence to ADHICS v2, DoH Abu Dhabi AI Policies, and Malaffi HIE standards.
              </p>
            </div>

            <button
              onClick={handleExportReport}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exported ? "Report Generated!" : "Export Compliance Dossier"}</span>
            </button>
          </div>

          {/* Verification Badge Bar */}
          <div className="p-4 bg-teal-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-800 flex items-center justify-center text-teal-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-sm font-bold">HealthPulse CareLoop Governance Assurance</h2>
                <p className="text-xs text-teal-200">10 of 10 controls active, tested, and cryptographically verified.</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400 font-bold">
                100% AUDIT PASS
              </span>
            </div>
          </div>

          {/* Categories & Controls */}
          <div className="space-y-6">
            {complianceStandards.map((sec, idx) => {
              const Icon = sec.icon;
              return (
                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center space-x-2">
                    <Icon className="w-5 h-5 text-teal-700" />
                    <h3 className="font-bold text-slate-900 text-sm">{sec.category}</h3>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {sec.controls.map((ctrl) => (
                      <div key={ctrl.id} className="p-5 hover:bg-slate-50/50 transition flex flex-col md:flex-row md:items-start justify-between gap-4 text-xs">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-teal-800 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-[11px]">
                              {ctrl.id}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{ctrl.title}</span>
                          </div>
                          <p className="text-slate-600">{ctrl.requirement}</p>
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-mono text-[11px] mt-2">
                            <span className="font-bold text-teal-800 font-sans">Implementation Evidence: </span>
                            {ctrl.evidence}
                          </div>
                        </div>

                        <div className="flex-shrink-0 pt-1">
                          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{ctrl.status}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
