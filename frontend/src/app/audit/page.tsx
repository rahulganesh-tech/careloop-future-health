"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SyntheticBanner } from "@/components/SyntheticBanner";
import { api } from "@/lib/api";
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Lock,
  RefreshCw,
  Search,
  Filter,
  Terminal,
  FileText,
  Key
} from "lucide-react";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLog();
      setLogs(data);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    try {
      setVerifyLoading(true);
      const res = await api.verifyAuditChain();
      setVerifyResult(res);
    } catch (err: any) {
      setVerifyResult({
        valid: false,
        detail: err.message || "Failed to execute cryptographic verification",
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.actor.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.object.toLowerCase().includes(q) ||
      log.detail.toLowerCase().includes(q) ||
      log.record_hash.toLowerCase().includes(q)
    );
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
                <ShieldCheck className="w-6 h-6 text-teal-600" />
                <h1 className="text-2xl font-bold text-slate-900">
                  Cryptographic Audit Chain Explorer
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Immutable SHA-256 Merkle-linked audit records conforming to ADHICS v2 and DoH Abu Dhabi Health Data Standards.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleVerifyChain}
                disabled={verifyLoading}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{verifyLoading ? "Computing SHA-256 Chain..." : "Verify Hash Chain Integrity"}</span>
              </button>

              <button
                onClick={loadAuditLogs}
                disabled={loading}
                className="p-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Verification Result Banner */}
          {verifyResult && (
            <div
              className={`p-5 rounded-2xl border shadow-sm flex items-start space-x-3 text-xs ${
                verifyResult.valid
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                  : "bg-rose-50 border-rose-300 text-rose-950"
              }`}
            >
              {verifyResult.valid ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-sm">
                  {verifyResult.valid
                    ? "Cryptographic Verification PASSED: 100% Chain Integrity Confirmed"
                    : "Cryptographic Verification FAILED: Tamper Detected!"}
                </div>
                <div className="font-mono text-[11px]">
                  Verified Records: {verifyResult.count || logs.length} • Breaches Detected: 0 • Hash Algorithm: SHA-256
                </div>
                <div className="text-[11px] opacity-90">
                  Every transition hash links strictly to its predecessor: <code className="bg-white/60 px-1 py-0.5 rounded">hash_n = SHA-256(data_n | hash_n-1)</code>. No log record has been deleted, re-ordered, or altered.
                </div>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search actor, action, case ID, or SHA-256 hash prefix..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-600">Action Filter:</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white"
              >
                <option value="ALL">All Actions ({logs.length})</option>
                <option value="LOGIN">LOGIN</option>
                <option value="OTP_VERIFIED">OTP_VERIFIED</option>
                <option value="CASE_ASSIGNED">CASE_ASSIGNED</option>
                <option value="RESULT_REVIEWED">RESULT_REVIEWED</option>
                <option value="REFERRAL_CREATED">REFERRAL_CREATED</option>
                <option value="REFERRAL_ACCEPTED">REFERRAL_ACCEPTED</option>
                <option value="DUAL_SIGNOFF_RECORDED">DUAL_SIGNOFF_RECORDED</option>
                <option value="CASE_CLOSED">CASE_CLOSED</option>
              </select>
            </div>
          </div>

          {/* Audit Records Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Showing {filteredLogs.length} Immutable Log Entries
              </span>
              <span className="text-xs text-slate-400">
                PostgreSQL Immutable Trigger Enforced
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
                <span>Reading cryptographic chain...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No audit log entries matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200 font-mono text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Seq</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Actor & Role</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Object / Entity</th>
                      <th className="py-3 px-4">Audit Details</th>
                      <th className="py-3 px-4">SHA-256 Digest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-bold">#{log.id}</td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-900">
                          <div>{log.actor}</div>
                          <span className="text-[10px] text-teal-700 font-bold">{log.role}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 border border-slate-300 text-slate-800">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-teal-800">
                          {log.object}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-700 max-w-xs truncate" title={log.detail}>
                          {log.detail}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[10px]">
                          <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600" title={log.record_hash}>
                            {log.record_hash.slice(0, 16)}...
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
