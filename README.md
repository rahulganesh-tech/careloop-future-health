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

# Run test suite (9 tests, 100% pass)
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
The backend contains 9 comprehensive tests verifying every architectural requirement:
1. `test_login_and_otp_flow`: Validates 2-step OTP, password verification, 401 rejection on wrong credentials.
2. `test_role_authorization_admin_forbidden_clinical`: Proves ADMIN is strictly forbidden from clinical review (returns HTTP 403).
3. `test_case_state_machine_invalid_transition`: Enforces transition prerequisites (HTTP 409 conflict when booking appointment before referral is accepted).
4. `test_referral_escrow_ownership_transfer`: Confirms GP retains escrow responsibility until specialist accepts, and regains it if rejected.
5. `test_closure_gate_requires_evidence`: Blocks case closure if checklist items are incomplete.
6. `test_closure_gate_requires_dual_signoff`: Rejects sign-off if the same user attempts to sign both GP and Coordinator roles.
7. `test_cryptographic_audit_chain_tamper_detection`: Injects synthetic database tampering and proves the auditor detects the exact corrupted row.
8. `test_score_calculator_deterministic_progression`: Validates the exact score sequence ($64 \rightarrow 72 \rightarrow 76 \rightarrow 78$).
9. `test_fhir_r4_bundle_export`: Validates FHIR bundle structure, `Task.owner`, and `Task.status` consistency.

Run tests anytime with:
```bash
pytest backend/tests/test_careloop.py -v
```

---

## 🏛️ Standards Alignment
- **ADHICS v2 (Abu Dhabi Healthcare Information and Cyber Security Standard)**: Role separation, cryptographic audit trail, and database triggers.
- **DoH Abu Dhabi AI & Health Data Policies**: Deterministic explainable scoring, human-in-the-loop closure invariants, synthetic data isolation.
- **Malaffi HIE Readiness**: FHIR R4 Bundles (`Task`, `ServiceRequest`, `DiagnosticReport`), portable QR escrow receipts.

---

## 📜 License
Developed for the **Future Health Challenge 2026**. Designed to align with Department of Health - Abu Dhabi standards.
Synthetic demo dataset — not for clinical use.
