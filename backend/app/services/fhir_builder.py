import json
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.entities import Case, PatientIdentity, ScreeningResult, Referral, Task as DbTask

def utc_iso(dt):
    if not dt:
        return datetime.now(timezone.utc).isoformat()
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).isoformat()
    return dt.isoformat()

def build_fhir_care_capsule(db: Session, case: Case) -> Dict[str, Any]:
    """
    Builds a FHIR R4-compatible Bundle (Care Capsule) representing the full stateful case.
    Matches Task.owner to Case owner and Task.status to Case stage.
    """
    patient: PatientIdentity = case.patient
    result: ScreeningResult = case.result

    bundle_id = f"bundle-{case.id.lower()}"
    patient_ref = f"Patient/{patient.patient_id}"
    
    entries = []

    # 1. Patient Resource
    patient_resource = {
        "fullUrl": f"urn:uuid:patient-{patient.patient_id}",
        "resource": {
            "resourceType": "Patient",
            "id": patient.patient_id,
            "identifier": [
                {
                    "system": "https://doh.gov.ae/patient-id",
                    "value": patient.patient_id
                }
            ],
            "name": [
                {
                    "use": "official",
                    "text": patient.name
                }
            ],
            "birthDate": patient.dob,
            "telecom": [
                {
                    "system": "phone",
                    "value": patient.phone,
                    "use": "mobile"
                }
            ],
            "communication": [
                {
                    "language": {
                        "coding": [
                            {
                                "system": "urn:ietf:bcp:47",
                                "code": "ar" if patient.preferred_language == "Arabic" else "en",
                                "display": patient.preferred_language
                            }
                        ]
                    },
                    "preferred": True
                }
            ]
        }
    }
    entries.append(patient_resource)

    # 2. Observation (HbA1c)
    if result:
        obs_id = f"obs-{result.id}"
        obs_resource = {
            "fullUrl": f"urn:uuid:{obs_id}",
            "resource": {
                "resourceType": "Observation",
                "id": obs_id,
                "status": "final",
                "category": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                "code": "laboratory",
                                "display": "Laboratory"
                            }
                        ]
                    }
                ],
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": "4548-4",
                            "display": "Hemoglobin A1c/Hemoglobin.total in Blood"
                        }
                    ],
                    "text": "HbA1c Screening"
                },
                "subject": {"reference": patient_ref},
                "effectiveDateTime": utc_iso(result.collected_at),
                "issued": utc_iso(result.issued_at),
                "valueQuantity": {
                    "value": result.value,
                    "unit": result.unit or "%",
                    "system": "http://unitsofmeasure.org",
                    "code": "%"
                },
                "interpretation": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                                "code": "H" if result.value >= 6.5 else "N",
                                "display": "High" if result.value >= 6.5 else "Normal"
                            }
                        ]
                    }
                ]
            }
        }
        entries.append(obs_resource)

    # 3. DiagnosticReport
    diag_id = f"report-{case.id.lower()}"
    diag_resource = {
        "fullUrl": f"urn:uuid:{diag_id}",
        "resource": {
            "resourceType": "DiagnosticReport",
            "id": diag_id,
            "status": "final",
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "4548-4",
                        "display": "HbA1c Screening Report"
                    }
                ]
            },
            "subject": {"reference": patient_ref},
            "effectiveDateTime": utc_iso(case.opened_at),
            "result": [{"reference": f"Observation/obs-{result.id}"}] if result else []
        }
    }
    entries.append(diag_resource)

    # 4. ServiceRequest (Referral if exists)
    for ref in case.referrals:
        sr_id = f"servicerequest-{ref.id.lower()}"
        sr_resource = {
            "fullUrl": f"urn:uuid:{sr_id}",
            "resource": {
                "resourceType": "ServiceRequest",
                "id": ref.id,
                "status": "active" if ref.status in ("SENT", "ACCEPTED") else "completed",
                "intent": "order",
                "priority": "urgent" if ref.urgency == "CRITICAL" else "routine",
                "subject": {"reference": patient_ref},
                "reasonCode": [{"text": ref.reason}],
                "performer": [{"display": ref.to_facility}]
            }
        }
        entries.append(sr_resource)

    # 5. Stateful Task Resource (Matches Case Owner and Stage)
    # Stage to FHIR Task status mapping
    stage_to_task_status = {
        "RESULT_RECEIVED": "received",
        "OWNER_ASSIGNED": "accepted",
        "PATIENT_NOTIFIED": "in-progress",
        "CLINICAL_REVIEW": "in-progress",
        "REFERRAL_SENT": "in-progress",
        "RECEIVER_RESPONSE": "in-progress",
        "APPOINTMENT_SERVICE": "in-progress",
        "OUTCOME_RETURNED": "in-progress",
        "CLOSURE_REVIEW": "completed" if case.closed_at else "ready"
    }
    task_resource = {
        "fullUrl": f"urn:uuid:task-{case.id.lower()}",
        "resource": {
            "resourceType": "Task",
            "id": f"task-{case.id.lower()}",
            "identifier": [
                {
                    "system": "https://careloop.healthpulse.ae/case-id",
                    "value": case.id
                }
            ],
            "status": stage_to_task_status.get(case.stage, "in-progress"),
            "intent": "plan",
            "priority": "stat" if case.urgency == "CRITICAL" else "routine",
            "code": {
                "coding": [
                    {
                        "system": "http://hl7.org/fhir/CodeSystem/task-code",
                        "code": "fulfill",
                        "display": "Screening Follow-up and Care Journey"
                    }
                ],
                "text": f"Stage: {case.stage}"
            },
            "for": {"reference": patient_ref},
            "authoredOn": utc_iso(case.opened_at),
            "lastModified": utc_iso(datetime.now(timezone.utc)),
            "owner": {
                "display": f"User ID: {case.owner_user_id} ({case.owner_role})" if case.owner_user_id else "Unassigned Escrow"
            },
            "restriction": {
                "period": {
                    "end": utc_iso(case.due_at) if case.due_at else None
                }
            }
        }
    }
    entries.append(task_resource)

    # Return full Bundle
    return {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "collection",
        "timestamp": utc_iso(datetime.now(timezone.utc)),
        "meta": {
            "profile": ["http://hl7.org/fhir/StructureDefinition/Bundle"]
        },
        "entry": entries
    }
