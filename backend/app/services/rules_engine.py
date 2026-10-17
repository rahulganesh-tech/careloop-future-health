import json
import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Case, Rule, RuleFiring, Task, Message, CaseEvent

def load_rules_from_disk(db: Session, config_path: str = "config/rules.json"):
    """Loads JSON rules from disk and synchronizes with rules database table."""
    if not os.path.exists(config_path):
        # Check alternative path if running from parent dir
        alt_path = os.path.join(os.path.dirname(__file__), "..", "..", config_path)
        if os.path.exists(alt_path):
            config_path = alt_path
        else:
            return

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            rule_defs = json.load(f)
            for r_data in rule_defs:
                existing = db.query(Rule).filter(Rule.id == r_data["id"]).first()
                if not existing:
                    new_rule = Rule(
                        id=r_data["id"],
                        name=r_data["name"],
                        json=r_data,
                        active=r_data.get("active", True),
                        version=r_data.get("version", "1.0"),
                        approved_by=r_data.get("approved_by")
                    )
                    db.add(new_rule)
                else:
                    existing.name = r_data["name"]
                    existing.json = r_data
                    existing.active = r_data.get("active", True)
                    existing.version = r_data.get("version", "1.0")
            db.commit()
    except Exception as e:
        print(f"Error loading rules from {config_path}: {e}")

def evaluate_case_rules(db: Session, case_id: str) -> List[Dict[str, Any]]:
    """
    Evaluates active rules for a specific case and generates rule firings & tasks.
    Returns list of newly fired rule actions.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case or case.closed_at or case.archived:
        return []

    now = datetime.now(timezone.utc)
    opened = case.opened_at.replace(tzinfo=timezone.utc) if case.opened_at and case.opened_at.tzinfo is None else (case.opened_at or now)
    hours_open = (now - opened).total_seconds() / 3600.0

    firings_created = []
    
    # 1. R-ACK-24H: Critical result unacknowledged in 24h
    if case.urgency == "CRITICAL":
        is_ack = any(e.event_type in ("PATIENT_ACKNOWLEDGED", "TEACH_BACK_PASSED") for e in case.events)
        if not is_ack and hours_open >= 24:
            rule_id = "R-ACK-24H"
            existing_firing = db.query(RuleFiring).filter(
                RuleFiring.rule_id == rule_id,
                RuleFiring.case_id == case.id
            ).first()
            if not existing_firing:
                reason = "Critical HbA1c result delivered over 24 hours ago without patient acknowledgement."
                action_desc = "Created urgent CALL task for Coordinator and notified Referring Clinician (GP)."
                firing = RuleFiring(
                    rule_id=rule_id,
                    case_id=case.id,
                    reason=reason,
                    action=action_desc
                )
                db.add(firing)

                # Check if task already exists
                existing_task = db.query(Task).filter(
                    Task.case_id == case.id,
                    Task.created_by_rule == rule_id
                ).first()
                if not existing_task:
                    call_task = Task(
                        case_id=case.id,
                        kind="CALL",
                        assigned_role="COORD",
                        assigned_user=None,
                        due_at=now + timedelta(hours=4),
                        status="PENDING",
                        created_by_rule=rule_id,
                        outcome=None
                    )
                    db.add(call_task)
                
                firings_created.append({"rule_id": rule_id, "reason": reason, "action": action_desc})

    # 2. R-ACK-72H: High result unacknowledged in 72h
    if case.urgency == "HIGH":
        is_ack = any(e.event_type in ("PATIENT_ACKNOWLEDGED", "TEACH_BACK_PASSED") for e in case.events)
        if not is_ack and hours_open >= 72:
            rule_id = "R-ACK-72H"
            existing_firing = db.query(RuleFiring).filter(
                RuleFiring.rule_id == rule_id,
                RuleFiring.case_id == case.id
            ).first()
            if not existing_firing:
                reason = "High abnormal HbA1c result unacknowledged after 72 hours."
                action_desc = "Triggered secondary reminder and coordinator follow-up call task."
                firing = RuleFiring(
                    rule_id=rule_id,
                    case_id=case.id,
                    reason=reason,
                    action=action_desc
                )
                db.add(firing)
                
                existing_task = db.query(Task).filter(
                    Task.case_id == case.id,
                    Task.created_by_rule == rule_id
                ).first()
                if not existing_task:
                    call_task = Task(
                        case_id=case.id,
                        kind="CALL",
                        assigned_role="COORD",
                        assigned_user=None,
                        due_at=now + timedelta(hours=24),
                        status="PENDING",
                        created_by_rule=rule_id
                    )
                    db.add(call_task)
                firings_created.append({"rule_id": rule_id, "reason": reason, "action": action_desc})

    # 3. R-CRIT-REVIEW-48H: Critical case without clinical review in 48h
    if case.urgency == "CRITICAL" and case.stage in ("RESULT_RECEIVED", "OWNER_ASSIGNED") and hours_open >= 48:
        has_review = any(e.event_type == "CLINICAL_REVIEW_COMPLETED" for e in case.events)
        if not has_review:
            rule_id = "R-CRIT-REVIEW-48H"
            existing_firing = db.query(RuleFiring).filter(
                RuleFiring.rule_id == rule_id,
                RuleFiring.case_id == case.id
            ).first()
            if not existing_firing:
                reason = "Critical abnormal result without documented clinician review after 48 hours."
                action_desc = "Escalated case to Facility Clinical Lead for safety audit."
                firing = RuleFiring(
                    rule_id=rule_id,
                    case_id=case.id,
                    reason=reason,
                    action=action_desc
                )
                db.add(firing)
                firings_created.append({"rule_id": rule_id, "reason": reason, "action": action_desc})

    db.commit()
    return firings_created
