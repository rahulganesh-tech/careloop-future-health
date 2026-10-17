import csv
import io
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Rule, Pathway, User, Facility, Case
from app.api.deps import get_current_user, require_roles, append_audit_entry
from app.core.security import get_password_hash

router = APIRouter(tags=["Rules, Admin & Export"])

@router.get("/rules")
def get_rules(db: Session = Depends(get_db)):
    rules = db.query(Rule).all()
    return [{"id": r.id, "name": r.name, "active": r.active, "version": r.version, "approved_by": r.approved_by, "definition": r.json} for r in rules]

@router.put("/rules/{id}")
def update_rule(
    id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles("ADMIN", "PM")),
    db: Session = Depends(get_db)
):
    rule = db.query(Rule).filter(Rule.id == id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.name = payload.get("name", rule.name)
    rule.active = payload.get("active", rule.active)
    rule.json = payload.get("definition", rule.json)
    if current_user.role == "PM":
        rule.approved_by = current_user.name

    append_audit_entry(
        db=db,
        actor=current_user.email,
        role=current_user.role,
        action="UPDATE_RULE",
        object_id=rule.id,
        detail=f"Rule {rule.id} updated by {current_user.name}."
    )
    db.commit()
    return {"id": rule.id, "status": "UPDATED"}

@router.get("/pathways")
def get_pathways(db: Session = Depends(get_db)):
    pathways = db.query(Pathway).all()
    return [
        {
            "code": p.code,
            "name": p.name,
            "version": p.version,
            "approved_by": p.approved_by,
            "protocol": p.protocol_json,
            "closure_checklist": p.closure_checklist_json,
            "sla": p.sla_json
        }
        for p in pathways
    ]

@router.get("/users")
def list_users(
    current_user: User = Depends(require_roles("ADMIN", "PM")),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "facility_code": u.facility_code,
            "active": u.active
        }
        for u in users
    ]

@router.post("/users")
def create_user(
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == payload["email"]).first()
    if existing:
        raise HTTPException(status_code=400, detail="User email already exists")

    new_user = User(
        email=payload["email"],
        name=payload["name"],
        role=payload["role"],
        facility_code=payload.get("facility_code"),
        password_hash=get_password_hash(payload.get("password", "demo123")),
        otp_required=payload.get("otp_required", True),
        active=True
    )
    db.add(new_user)
    db.commit()
    return {"id": new_user.id, "email": new_user.email, "role": new_user.role}

@router.get("/reports/loop.csv")
def export_loop_csv(
    current_user: User = Depends(require_roles("PM", "COORD", "AUDITOR", "ADMIN")),
    db: Session = Depends(get_db)
):
    cases = db.query(Case).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Case ID", "Patient ID", "Urgency", "Stage", "Sub Status", "HbA1c Value", "Owner Role", "Opened At", "Closed At", "Disposition"])
    for c in cases:
        writer.writerow([
            c.id,
            c.patient_id,
            c.urgency,
            c.stage,
            c.sub_status,
            c.result.value if c.result else "",
            c.owner_role or "",
            c.opened_at.isoformat() if c.opened_at else "",
            c.closed_at.isoformat() if c.closed_at else "",
            c.disposition or ""
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=careloop_summary.csv"}
    )
