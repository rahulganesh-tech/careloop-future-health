# HealthPulse AI CareLoop
**Future Health Challenge 2026** · *[Population Health] Closing the Screening-to-Care Loop*
Organized by **Department of Health - Abu Dhabi**, with **Microsoft**, **Inception**, **MBZUAI**, and **Hack2skill** · Deadline: **20 Nov 2026**

> **SYNTHETIC DEMO DATA — NOT FOR CLINICAL USE**
> All patient records, test results, clinician identities, and facilities in this demonstration are synthetically generated for technical evaluation.

---

## 🎯 The Core Thesis
> *"Every actionable screening result gets a named owner, a time-bound next step, an app-free patient route, and evidence before closure. Success is measured by completed care journeys, not sent messages."*

In conventional population health programs, health systems report victory when an SMS notification is sent to a patient with an abnormal screening result. Yet across global screening programs, **30% to 50% of abnormal findings fail to receive timely diagnostic workup or specialist care**. Patients fall into the "chasm" between primary screening clinics and secondary specialist centers.

**HealthPulse AI CareLoop** replaces "sent messages" with an **enforced state machine**, **cryptographic referral escrow**, and **evidence gates** to ensure zero silent drop-offs.

---

## 📊 Preserved Benchmark Demonstration Numbers
The synthetic evaluation cohort begins at a baseline Loop Integrity Score of **64/100**, and through clinical actions taken live during the demonstration, advances deterministically:

$$\mathbf{64/100} \longrightarrow \mathbf{72/100} \longrightarrow \mathbf{76/100} \longrightarrow \mathbf{78/100}$$

- **Baseline Score: 64/100**
  - **150** total screened patients, **60** actionable cases, **30** referrals initiated (**21** completed = 70% rate).
  - 1 critical abnormal unacknowledged (`CASE-1004`, HbA1c 11.2%): **-15 pts penalty**
  - 2 unowned handoffs in escrow (`REF-031`, `REF-034`): **-8 pts penalty**
  - 5 overdue cases breaching SLA: **-8 pts penalty**
  - Referral completion shortfall (70% vs 80% benchmark = 10% gap): **-5 pts penalty**
  - $100 - 15 - 8 - 8 - 5 = \mathbf{64}$
- **Step 1: Patient / Coordinator acknowledges CASE-1004** $\longrightarrow \mathbf{72/100}$ (+8 pts, clears critical penalty)
- **Step 2: Resubmit & Accept rejected referral REF-034** $\longrightarrow \mathbf{76/100}$ (+4 pts, unowned handoffs drop from 2 to 1)
- **Step 3: Dual sign-off & seal case CASE-1001** $\longrightarrow \mathbf{78/100}$ (+2 pts, referral completes, rate climbs to 73.3%, reducing completion penalty)
- **Zero Evidence Breaches**: **0** cases closed on notification alone.

---

## 🔒 The 6 Non-Negotiable Technical Invariants

1. **Named Owner & Deterministic SLA Deadlines**:
   Every case at every stage has an accountable clinician or care coordinator. No case ever enters an "unassigned" state.
2. **Referral Escrow Protocol**:
   When a GP creates a referral, clinical responsibility remains in escrow with the referring GP until the receiving specialist clinic explicitly clicks **"Accept Referral"**. If rejected, accountability reverts instantly to the GP with a mandatory reason code and coordinator escalation.
3. **Evidence Gate Before Closure**:
   A case cannot transition to `CLOSED_LOOP` until 4 concrete evidence items exist:
   - Primary screening result record
   - Specialist referral receipt / consult note
   - Documented attendance verification
   - Final clinical outcome with management plan
4. **Dual Role Sign-Off**:
   Closure requires sign-off from both the Referring GP and the Care Navigator. The system mathematically prevents the same user account from signing off on both roles.
5. **Cryptographically Chained Audit Trail**:
   Every state change is sealed into an immutable SHA-256 hash chain:
   $$\text{hash}_n = \text{SHA-256}(\text{ts}_n \mid \text{actor}_n \mid \text{role}_n \mid \text{action}_n \mid \text{object}_n \mid \text{detail}_n \mid \text{hash}_{n-1})$$
   Direct SQL database tampering breaks the hash chain and is immediately flagged by the auditor tool.
6. **App-Free Patient Experience**:
   Patients require **zero app downloads or account logins**. A mobile-first magic link with Date of Birth challenge and a 3-question **Teach-Back Comprehension Check** verifies patient understanding in Arabic or English.

---

## ☁️ Microsoft Tools & Technologies Stack

HealthPulse AI CareLoop is built ground-up on the **Microsoft Cloud for Healthcare** and **Azure AI** ecosystem, engineered to comply with the **Department of Health - Abu Dhabi** digital standards, **ADHICS v2**, and UAE national health data residency mandates (`DATA_RESIDENCY=UAE`).

```
                               ┌────────────────────────────────────────────────────────┐
                               │           Microsoft Entra ID (IAM & RBAC)              │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
┌───────────────────────────────┐        ┌────────────────┴───────────────┐        ┌──────────────────────────────┐
│       Frontend (Next.js)      │        │        Backend (FastAPI)       │        │   Microsoft Fabric / PowerBI │
│   Azure Container Apps / CDN  │◄──────►│   Azure Container Apps (AKS)   │◄──────►│  Population Health & Equity  │
└───────────────────────────────┘        └────────────────┬───────────────┘        └──────────────────────────────┘
                                                          │
               ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
               ▼                                          ▼                                          ▼
┌──────────────────────────────┐        ┌──────────────────────────────────┐       ┌──────────────────────────────┐
│       Azure AI Services      │        │    Azure Health Data Services    │       │     Azure Flexible Data      │
│ • Azure OpenAI (GPT-4o-mini) │        │ • FHIR Service (HL7 FHIR R4)     │       │ • Azure Database PostgreSQL  │
│ • Azure AI Speech (uaenorth) │        │ • Malaffi HIE Bundles            │       │ • RLS & Cryptographic Ledger │
│ • Azure AI Content Safety    │        │ • Escrow QR Receipt Tokens       │       │ • Azure Key Vault (HSM Keys) │
│ • Azure AI Search (Cognitive)│        └──────────────────────────────────┘       └──────────────────────────────┘
└──────────────────────────────┘
```

### 1. Azure OpenAI Service & Azure AI Foundry
- **Clinical Model**: `gpt-4o-mini` / `gpt-4o` provisioned in Azure AI Studio.
- **Teach-Back Comprehension Engine**: Translates complex lab findings (e.g., elevated HbA1c 11.2%, pre-diabetes) into culturally adapted, low-health-literacy questions in Emirati Arabic, English, and Hindi. Verifies patient understanding without clinical jargon.
- **Clinical Review Assistance**: Synthesizes consult summaries and referral histories for receiving endocrinologists and care navigators while enforcing mandatory human-in-the-loop sign-off.
- **Resilient Offline Fallback**: Governed by the `AI_ENABLED=false` configuration switch. If cloud AI endpoints are unreachable, CareLoop seamlessly and deterministically falls back to pre-certified clinical rule templates with zero interruption to patient routing.

### 2. Azure Health Data Services (FHIR Service)
- **Malaffi HIE Interoperability**: Built on native HL7 FHIR R4 specifications for full bi-directional integration with Abu Dhabi’s Malaffi Health Information Exchange.
- **FHIR R4 Bundle Generator**: Standardized `/fhir/Bundle/{case_id}` endpoints export complete patient journey capsules enclosing `Patient`, `Task` (escrow handoff tracking), `ServiceRequest`, `DiagnosticReport`, and `Encounter` resources.
- **Escrow Handoff Protocols**: Referral states correspond to FHIR `Task.status` transitions (`requested` $\rightarrow$ `received` $\rightarrow$ `accepted` $\rightarrow$ `completed`), ensuring zero unowned handoffs between primary care and specialist facilities.

### 3. Azure AI Speech & Multimodal Delivery
- **UAE North Datacenter (`uaenorth`)**: Speech synthesis and recognition hosted locally in Abu Dhabi / Dubai for sovereign latency and data residency compliance.
- **App-Free Voice & Audio Routing**: Delivers interactive voice messages and audio playback of screening results for elderly or low-literacy patients who cannot use smartphone apps.
- **Localized Dialects**: Acoustic models tailored for Gulf Arabic (Emirati dialect) and English.

### 4. Azure AI Content Safety
- **Medical Communication Guardrails**: Automated real-time scanning of all outbound patient messages and navigator callback notes.
- **Harm & Hallucination Prevention**: Blocks unvetted medical advice, self-harm references, and toxic phrasing before message transmission across WhatsApp, SMS, or Voice channels.

### 5. Azure AI Search (Cognitive Search)
- **Clinical Pathway Indexing**: Semantic vector search across Department of Health Abu Dhabi screening pathways, clinical escalation criteria, and diagnostic guidelines.
- **Barrier Resolution Knowledge Base**: Enables Care Navigators to instantly query vetted local interventions for reported social determinants of health (SDOH), including transportation assistance, mobile clinic routing, and language support.

### 6. Azure Database for PostgreSQL (Flexible Server) & Azure Key Vault
- **UAE Sovereign Data Residency**: Fully isolated in **Azure UAE North**, satisfying UAE Federal Health Data Law and ADHICS v2 requirements.
- **Row-Level Security (RLS)**: Enforces role-based database policies ensuring clinicians only view assigned patients and preventing non-clinical administrators from reading Protected Health Information (PHI).
- **Cryptographic Audit Ledger**: Database triggers and SHA-256 hash chaining guarantee tamper-evident preservation of every clinical state transition.
- **Azure Key Vault**: Hardware Security Module (HSM)-backed custody of JWT encryption keys, database credentials, and one-time password (OTP) seed secrets.

### 7. Microsoft Entra ID (Azure Active Directory) & Role-Based Access Control
- **Healthcare IAM**: Enterprise identity management supporting clinical role separation across GP, Endocrinologist, Care Navigator, Program Manager, Community Health Worker (CHW), Compliance Auditor, and IT Administrator.
- **Segregation of Duties**: Enforces multi-factor authentication (MFA with OTP challenge), 15-minute token TTL, and cryptographically blocks the same user identity from executing dual GP/Navigator sign-offs.

### 8. Microsoft Fabric & Power BI Embedded
- **Population Health Intelligence**: Live operational dashboards tracking cohort conversion funnels, screening-to-consult drop-offs, and facility capacity bottlenecks.
- **Explainable Loop Integrity Telemetry**: Live computation and auditing of the 5-rule arithmetic Loop Integrity Score ($64 \rightarrow 72 \rightarrow 76 \rightarrow 78$).
- **Health Equity & Barrier Analytics**: Disaggregated barrier frequency, resolution rate, and median resolution times by facility and demographic cohort.

### 9. Microsoft Developer Ecosystem & DevOps
- **GitHub Actions**: Continuous integration pipeline running 16 automated pytest verification suites on every pull request.
- **Visual Studio Code & Dev Containers**: Standardized, reproducible development container environments for Python 3.10+ and Node.js 18+.

---

### 📋 Microsoft Tools & Architecture Matrix

| CareLoop Module | Microsoft / Azure Technology | Configuration / Region | Clinical / Regulatory Purpose |
| :--- | :--- | :--- | :--- |
| **Patient Teach-Back & Translation** | Azure OpenAI Service (`gpt-4o-mini`) | Azure AI Project Endpoint | Multilingual patient comprehension in Arabic/English/Hindi |
| **HIE Interoperability** | Azure Health Data Services (FHIR) | HL7 FHIR R4 Service | Malaffi HIE export (`Task`, `ServiceRequest`, `DiagnosticReport`) |
| **Voice Channel & IVR** | Azure AI Speech | `uaenorth` (Abu Dhabi) | App-free voice access for elderly and low-literacy patients |
| **Message Guardrails** | Azure AI Content Safety | Azure Content Safety Endpoint | Zero medical misinformation or unverified clinical guidance |
| **Clinical Guidelines Retrieval** | Azure AI Search (Cognitive Search) | Azure Search Endpoint | Semantic indexing of DoH Abu Dhabi clinical screening pathways |
| **Transactional Database** | Azure Database for PostgreSQL | UAE North (Flexible Server) | Sovereign storage, RLS policies, and SHA-256 audit triggers |
| **Secrets Management** | Azure Key Vault | FIPS 140-2 Level 3 HSM | Zero hardcoded keys, rotation of JWT secrets & OTP seeds |
| **Identity & Access Control** | Microsoft Entra ID (Azure AD) | Enterprise IAM & MFA | Strict ADHICS v2 role separation and dual sign-off enforcement |
| **Population Health Analytics** | Microsoft Fabric & Power BI | Power BI Embedded | Real-time Loop Integrity Score telemetry and equity tracking |
| **Application Hosting** | Azure Container Apps / AKS | Managed Microservices | Zero-trust container networking for FastAPI & Next.js |
| **CI/CD & Source Control** | GitHub & GitHub Actions | GitHub Enterprise / Cloud | 16-point automated verification testing on every commit |

---

## 👥 Demo Personas & Logins
All accounts use password: `demo123` · Demo OTP: `482913`

| Role | Email | Name | Focus / Responsibility |
| :--- | :--- | :--- | :--- |
| **PM** | `pm@careloop.demo` | Noura Al-Zaabi | Programme Manager (Dashboard, SLAs, Equity) |
| **COORD** | `coord@careloop.demo` | Mariam Al-Hosani | Care Navigator (Queue, Callbacks, Barriers) |
| **GP** | `gp@careloop.demo` | Dr. Ahmed Al-Mansouri | Referring Doctor (Clinical Review, Sign-off) |
| **SPEC** | `specialist@careloop.demo` | Dr. Tariq Al-Hashimi | Endocrinologist at DEC (Accept/Reject Referrals) |
| **CHW** | `chw@careloop.demo` | Zainab Al-Baloushi | Community Health Worker (Field Tablet Mode) |
| **AUDITOR**| `auditor@careloop.demo` | Hamad Al-Kaabi | Compliance Auditor (Audit Chain, ADHICS v2) |
| **ADMIN** | `admin@careloop.demo` | Sultan Al-Dhaheri | IT System Admin (Non-clinical system management) |

---

## 🚀 Quickstart: Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm

### 1. Backend Setup
```bash
cd backend
# Create virtual environment & install requirements
python -m venv venv
./venv/Scripts/pip install -r requirements.txt

# Seed database with baseline (Score 64/100)
./venv/Scripts/python seed_data.py

# Run test suite (16 tests, 100% pass)
./venv/Scripts/pytest -v tests/test_careloop.py

# Start FastAPI server
./venv/Scripts/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
cd frontend
# Install dependencies
npm install

# Start Next.js development server
npm run dev -- -p 3000
```
Application interface will be live at: `http://localhost:3000`

---

## 🧪 Automated Pytest Test Suite
The backend contains **16 comprehensive automated verification tests** verifying every architectural and regulatory invariant (100% pass rate):

### Core Architecture & State Machine (Tests 1–9)
1. `test_login_and_otp_flow`: Validates 2-step OTP, password verification, 401 rejection on wrong credentials.
2. `test_role_authorization`: Proves ADMIN is strictly forbidden from clinical review (returns HTTP 403).
3. `test_state_machine_and_referral_conflict_409`: Enforces transition prerequisites (HTTP 409 conflict when booking appointment before referral is accepted).
4. `test_ownership_escrow`: Confirms GP retains escrow responsibility until specialist accepts, and regains it if rejected.
5. `test_evidence_gate_blocks_closure`: Blocks case closure if checklist items are incomplete.
6. `test_dual_signoff_rejection_for_same_user`: Rejects sign-off if the same user attempts to sign both GP and Coordinator roles.
7. `test_audit_log_cryptographic_verification`: Injects synthetic database tampering and proves the auditor detects the exact corrupted row via SHA-256 chain verification.
8. `test_demo_journey_score_progression_64_72_76_78`: Validates the exact score sequence ($64 \rightarrow 72 \rightarrow 76 \rightarrow 78$).
9. `test_fhir_care_capsule_bundle`: Validates FHIR R4 bundle structure, `Task.owner`, and `Task.status` consistency for Malaffi HIE readiness.

### Prompt 7B Advanced Capabilities (Tests 10–16)
10. `test_recovery_simulator_never_changes_case_state`: Verifies simulation sandbox cannot alter real clinical case attributes.
11. `test_recovery_simulator_deterministic_reproducibility`: Confirms identical inputs yield identical simulation projections without ML hallucination.
12. `test_recovery_simulator_apply_requires_approval_and_links_task`: Verifies clinician approval is required to convert a simulated recommendation into a real operational Task.
13. `test_patient_journey_proof_pack_matches_timeline_and_audit`: Verifies comprehensive journey timeline, provenance tracking, and cryptographic audit seal.
14. `test_capacity_routing_preserves_owner`: Confirms capacity-aware provider rerouting maintains referring GP escrow responsibility.
15. `test_barrier_analytics_reconciles_and_shows_denominators`: Verifies disaggregated barrier resolution rates, low-sample warnings ($n < 10$), and non-causal disclaimers.
16. `test_kpi_metrics_show_denominators_and_value_types`: Confirms all population health KPIs display explicit denominators and value type badges (`ACTUAL`, `TARGET`, `ESTIMATED`).

Run tests anytime with:
```bash
backend/venv/Scripts/pytest backend/tests/test_careloop.py -v
```

---

## 🏛️ Standards Alignment
- **ADHICS v2 (Abu Dhabi Healthcare Information and Cyber Security Standard)**: Role separation, cryptographic audit trail, and database triggers.
- **DoH Abu Dhabi AI & Health Data Policies**: Deterministic explainable scoring, human-in-the-loop closure invariants, synthetic data isolation.
- **Malaffi HIE Readiness**: FHIR R4 Bundles (`Task`, `ServiceRequest`, `DiagnosticReport`), portable QR escrow receipts via Azure Health Data Services.
- **UAE Health Data Residency**: 100% cloud architecture localized to Microsoft Azure UAE North (Abu Dhabi) region.

---

## 📜 License
Developed for the **Future Health Challenge 2026**. Designed to align with Department of Health - Abu Dhabi standards.
Synthetic demo dataset — not for clinical use.
