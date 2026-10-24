export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("careloop_token");
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("careloop_token", token);
  }
}

export function removeToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("careloop_token");
    localStorage.removeItem("careloop_user");
  }
}

export function getCurrentUser(): any {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("careloop_user");
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem("careloop_user", JSON.stringify(user));
  }
}

export async function apiRequest(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const data = await res.json();
      errorDetail = data.detail || errorDetail;
    } catch {
      errorDetail = res.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

// API methods
export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  verifyOtp: (email: string, otp_code: string) =>
    apiRequest("/auth/otp", { method: "POST", body: JSON.stringify({ email, otp_code }) }),
  getMe: () => apiRequest("/auth/me"),
  patientExchangeLink: (token: string, dob: string) =>
    apiRequest(`/patient/link/${token}`, { method: "POST", body: JSON.stringify({ dob }) }),

  // Dashboard & Metrics
  getDashboard: () => apiRequest("/dashboard"),
  getMetrics: () => apiRequest("/dashboard/metrics"),
  getEquity: () => apiRequest("/dashboard/equity"),

  // Cases
  getCases: (params?: { stage?: string; urgency?: string; owner?: string; overdue?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.stage) q.append("stage", params.stage);
    if (params?.urgency) q.append("urgency", params.urgency);
    if (params?.owner) q.append("owner", params.owner);
    if (params?.overdue !== undefined) q.append("overdue", String(params.overdue));
    return apiRequest(`/cases?${q.toString()}`);
  },
  getCaseDetail: (id: string) => apiRequest(`/cases/${id}`),
  assignCase: (id: string, data: any) =>
    apiRequest(`/cases/${id}/assign`, { method: "POST", body: JSON.stringify(data) }),
  reviewCase: (id: string, data: any) =>
    apiRequest(`/cases/${id}/review`, { method: "POST", body: JSON.stringify(data) }),

  // Referrals & Receipts
  createReferral: (caseId: string, data: any) =>
    apiRequest(`/cases/${caseId}/referrals`, { method: "POST", body: JSON.stringify(data) }),
  getReceipt: (token: string) => apiRequest(`/receipts/${token}`),
  respondReceipt: (token: string, data: any) =>
    apiRequest(`/receipts/${token}/respond`, { method: "POST", body: JSON.stringify(data) }),
  acceptReferral: (id: string) =>
    apiRequest(`/referrals/${id}/accept`, { method: "POST" }),
  rejectReferral: (id: string, reason: string) =>
    apiRequest(`/referrals/${id}/reject`, { method: "POST", body: JSON.stringify({ status: "REJECTED", reject_reason: reason }) }),
  needsInfoReferral: (id: string, reason: string) =>
    apiRequest(`/referrals/${id}/needs-info`, { method: "POST", body: JSON.stringify({ status: "NEEDS_INFO", reject_reason: reason }) }),
  resubmitReferral: (id: string) =>
    apiRequest(`/referrals/${id}/resubmit`, { method: "POST" }),

  // Appointments & Outcomes
  bookAppointment: (caseId: string, data: any) =>
    apiRequest(`/cases/${caseId}/appointments`, { method: "POST", body: JSON.stringify(data) }),
  returnOutcome: (caseId: string, data: any) =>
    apiRequest(`/cases/${caseId}/outcome`, { method: "POST", body: JSON.stringify(data) }),

  // Closure & Signoff
  checkClosure: (caseId: string) => apiRequest(`/cases/${caseId}/closure-check`),
  signoffCase: (caseId: string, role: string, statement: string) =>
    apiRequest(`/cases/${caseId}/signoff`, { method: "POST", body: JSON.stringify({ role, statement }) }),
  closeCase: (caseId: string, disposition: string, reason: string) =>
    apiRequest(`/cases/${caseId}/close`, { method: "POST", body: JSON.stringify({ disposition, reason }) }),

  // Patient App-free status
  getPatientCase: (patientToken: string) =>
    apiRequest("/patient/case", { headers: { Authorization: `Bearer ${patientToken}` } }),
  submitTeachBack: (patientToken: string, language: string, answers: any) =>
    apiRequest("/patient/teach-back", {
      method: "POST",
      headers: { Authorization: `Bearer ${patientToken}` },
      body: JSON.stringify({ language, answers }),
    }),
  acknowledgePatient: (patientToken: string) =>
    apiRequest("/patient/acknowledge", {
      method: "POST",
      headers: { Authorization: `Bearer ${patientToken}` },
      body: JSON.stringify({ confirmed: true }),
    }),
  requestPatientCall: (patientToken: string, phone?: string, note?: string) =>
    apiRequest("/patient/request-call", {
      method: "POST",
      headers: { Authorization: `Bearer ${patientToken}` },
      body: JSON.stringify({ phone, note }),
    }),

  // Coordination & Queue
  getStalledQueue: () => apiRequest("/queue/stalled"),
  completeTask: (taskId: number, outcome: string) =>
    apiRequest(`/tasks/${taskId}/complete`, { method: "POST", body: JSON.stringify({ outcome }) }),
  recordBarrier: (caseId: string, data: any) =>
    apiRequest(`/cases/${caseId}/barriers`, { method: "POST", body: JSON.stringify(data) }),
  createConsult: (caseId: string, data: any) =>
    apiRequest(`/cases/${caseId}/consults`, { method: "POST", body: JSON.stringify(data) }),
  answerConsult: (consultId: number, answer: string) =>
    apiRequest(`/consults/${consultId}/answer`, { method: "POST", body: JSON.stringify({ answer }) }),

  // Audit & FHIR
  getAuditLog: (caseId?: string) => apiRequest(`/audit${caseId ? `?case_id=${caseId}` : ""}`),
  verifyAuditChain: () => apiRequest("/audit/verify"),
  getFhirBundle: (caseId: string) => apiRequest(`/fhir/Bundle/${caseId}`),

  // Rules & Admin
  getRules: () => apiRequest("/rules"),
  updateRule: (id: string, data: any) =>
    apiRequest(`/rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getPathways: () => apiRequest("/pathways"),
  getUsers: () => apiRequest("/users"),

  // Prompt 7B: Recovery Simulator, Barrier Analytics, Proof Pack & Capacity Routing
  getSimulationAssumptions: () => apiRequest("/recovery/assumptions"),
  getSimulationRuns: () => apiRequest("/recovery/runs"),
  simulateRecovery: (data: { case_id?: string; scenario_template?: string }) =>
    apiRequest("/recovery/simulate", { method: "POST", body: JSON.stringify(data) }),
  applyRecovery: (data: { run_id: number; option_code: string; review_notes: string }) =>
    apiRequest("/recovery/apply", { method: "POST", body: JSON.stringify(data) }),

  getBarrierAnalytics: (params?: { facility?: string; language?: string; channel?: string; barrier?: string }) => {
    const q = new URLSearchParams();
    if (params?.facility) q.append("facility", params.facility);
    if (params?.language) q.append("language", params.language);
    if (params?.channel) q.append("channel", params.channel);
    if (params?.barrier) q.append("barrier", params.barrier);
    return apiRequest(`/analytics/barriers?${q.toString()}`);
  },

  getProofPack: (caseId: string) => apiRequest(`/cases/${caseId}/proof-pack`),

  getCapacityRoutingSuggestions: (caseId: string, specialty?: string) =>
    apiRequest(`/routing/suggestions?case_id=${caseId}${specialty ? `&specialty=${encodeURIComponent(specialty)}` : ""}`),
  applyCapacityReroute: (data: { case_id: string; target_facility: string; rationale: string }) =>
    apiRequest("/routing/apply", { method: "POST", body: JSON.stringify(data) }),

  getPatientPreferences: (caseId: string) => apiRequest(`/cases/${caseId}/patient-preferences`),
  updatePatientPreferences: (caseId: string, data: any) =>
    apiRequest(`/cases/${caseId}/patient-preferences`, { method: "PUT", body: JSON.stringify(data) }),
};
