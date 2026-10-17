from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.entities import Case, Referral, EvidenceItem, Signoff

def calculate_loop_integrity_score(db: Session) -> Dict[str, Any]:
    """
    Calculates the explainable Loop Integrity Score (0-100) based on 5 strict rules:
    1. Overdue active cases (non-critical): -3 each, max -24
    2. Unowned handoffs (referral sent, no response > 48h): -4 each, max -12
    3. Critical result not acknowledged by patient within 24h: -8 each, max -16
    4. Referral completion rate below 80% target: -1 per 2% shortfall, max -15
    5. Cases closed without complete evidence: -10 each (critical safety flag)
    """
    now = datetime.now(timezone.utc)
    all_cases = db.query(Case).filter(Case.archived == False).all()

    # Rule 1: Overdue active cases (excluding critical unacknowledged)
    # Rule 3: Critical result not acknowledged within 24 hours
    overdue_count = 0
    crit_unack_count = 0
    closed_without_evidence_count = 0

    for c in all_cases:
        if c.closed_at:
            # Check if all required evidence and dual signoffs were provided
            ev_missing = [e for e in c.evidence if e.status == "MISSING"]
            signoff_roles = {s.role for s in c.signoffs}
            has_dual_signoff = ("RECEIVER" in signoff_roles and "REFERRER" in signoff_roles)
            if ev_missing or not has_dual_signoff:
                closed_without_evidence_count += 1
            continue

        # Active case checks
        # Critical unacknowledged check
        is_ack = any(e.event_type in ("PATIENT_ACKNOWLEDGED", "TEACH_BACK_PASSED") for e in c.events)
        if c.urgency == "CRITICAL" and not is_ack:
            opened = c.opened_at.replace(tzinfo=timezone.utc) if c.opened_at and c.opened_at.tzinfo is None else (c.opened_at or now)
            if (now - opened).total_seconds() > 24 * 3600:
                crit_unack_count += 1
                continue # Do not double count in general overdue

        # General overdue check
        if c.due_at:
            due = c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at
            if now > due:
                overdue_count += 1

    # Rule 2: Unowned handoffs (referral sent, not accepted, no response > 48 hours)
    # Also includes rejected referrals returned to sender until resubmitted/accepted
    unowned_handoffs = 0
    all_referrals = db.query(Referral).all()
    for ref in all_referrals:
        if ref.status in ("SENT", "NO_RESPONSE", "REJECTED"):
            sent = ref.sent_at.replace(tzinfo=timezone.utc) if ref.sent_at and ref.sent_at.tzinfo is None else (ref.sent_at or now)
            # In demo, check if status is unowned/stalled
            if (now - sent).total_seconds() > 48 * 3600 or ref.status == "REJECTED":
                unowned_handoffs += 1

    # Rule 4: Referral completion rate (completed / total sent against 80% target)
    total_referrals_sent = len(all_referrals)
    completed_referrals = len([r for r in all_referrals if r.status == "COMPLETED"])
    
    if total_referrals_sent > 0:
        completion_pct = (completed_referrals / total_referrals_sent) * 100.0
    else:
        completion_pct = 100.0

    target_pct = 80.0
    if completion_pct < target_pct:
        shortfall = target_pct - completion_pct
        referral_penalty = int(shortfall // 2)
        referral_penalty = min(referral_penalty, 15)
    else:
        referral_penalty = 0

    # Calculate penalties
    p1 = min(overdue_count * 3, 24)
    p2 = min(unowned_handoffs * 4, 12)
    p3 = min(crit_unack_count * 8, 16)
    p4 = referral_penalty
    p5 = closed_without_evidence_count * 10

    total_penalty = p1 + p2 + p3 + p4 + p5
    score = max(0, 100 - total_penalty)

    breakdown = [
        {
            "rule": "Overdue active cases",
            "count": overdue_count,
            "penalty": -p1,
            "max_penalty": -24,
            "explanation": f"{overdue_count} active case(s) past SLA due date (-3 each, max -24)"
        },
        {
            "rule": "Unowned handoffs (>48h pending or rejected)",
            "count": unowned_handoffs,
            "penalty": -p2,
            "max_penalty": -12,
            "explanation": f"{unowned_handoffs} referral(s) pending acceptance over 48h or rejected (-4 each, max -12)"
        },
        {
            "rule": "Critical result unacknowledged (>24h)",
            "count": crit_unack_count,
            "penalty": -p3,
            "max_penalty": -16,
            "explanation": f"{crit_unack_count} critical case(s) unacknowledged after 24h (-8 each, max -16)"
        },
        {
            "rule": "Referral completion below 80% target",
            "completion_rate": f"{completion_pct:.1f}%",
            "target": "80.0%",
            "penalty": -p4,
            "max_penalty": -15,
            "explanation": f"Referral completion is {completion_pct:.0f}% vs 80% target (-1 per 2% shortfall, max -15)"
        },
        {
            "rule": "Cases closed without complete evidence",
            "count": closed_without_evidence_count,
            "penalty": -p5,
            "explanation": f"{closed_without_evidence_count} case(s) closed without complete evidence (-10 each)"
        }
    ]

    return {
        "score": score,
        "max_score": 100,
        "total_penalty": total_penalty,
        "breakdown": breakdown,
        "metrics": {
            "overdue_cases": overdue_count,
            "unowned_handoffs": unowned_handoffs,
            "critical_unacknowledged": crit_unack_count,
            "referral_completion_rate": round(completion_pct, 1),
            "total_referrals": total_referrals_sent,
            "completed_referrals": completed_referrals,
            "closed_without_evidence": closed_without_evidence_count
        }
    }
