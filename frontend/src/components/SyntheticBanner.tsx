import React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export function SyntheticBanner() {
  return (
    <div className="w-full bg-amber-500 text-slate-900 px-4 py-1.5 text-xs font-semibold flex items-center justify-between tracking-wide shadow-sm z-50">
      <div className="flex items-center space-x-2">
        <AlertTriangle className="w-4 h-4 text-slate-950 flex-shrink-0" />
        <span>SYNTHETIC DEMO DATA — NOT FOR CLINICAL USE</span>
      </div>
      <div className="hidden sm:flex items-center space-x-3 text-[11px] font-medium text-slate-900">
        <span className="flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
          <span>ADHICS-Aligned Security Sandbox</span>
        </span>
        <span className="border-l border-amber-600 pl-3">Future Health Challenge · DoH Abu Dhabi</span>
      </div>
    </div>
  );
}
