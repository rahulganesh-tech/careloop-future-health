from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.services.rules_engine import load_rules_from_disk
from app.models.entities import User
try:
    from seed_data import seed
except ImportError:
    from backend.seed_data import seed

# Import routers
from app.api.auth import router as auth_router, patient_router as patient_auth_router
from app.api.dashboard import router as dashboard_router
from app.api.cases import router as cases_router, results_router
from app.api.patient import router as patient_router
from app.api.referrals import router as referrals_router
from app.api.appointments_outcomes import router as appt_outcome_router
from app.api.closure import router as closure_router
from app.api.coordination import router as coord_router
from app.api.rules_admin import router as admin_router
from app.api.audit_fhir import router as audit_fhir_router
from app.api.ws import router as ws_router
from app.api.prompt7b_router import router as prompt7b_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="HealthPulse AI CareLoop — Population Health Screening-to-Care Platform"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup
@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    should_seed = False
    try:
        init_db(db)
        load_rules_from_disk(db)
        try:
            if db.query(User).count() == 0:
                should_seed = True
        except Exception:
            should_seed = True
    finally:
        db.close()

    if should_seed:
        seed()

# Include Routers
app.include_router(auth_router)
app.include_router(patient_auth_router)
app.include_router(dashboard_router)
app.include_router(cases_router)
app.include_router(results_router)
app.include_router(patient_router)
app.include_router(referrals_router)
app.include_router(appt_outcome_router)
app.include_router(closure_router)
app.include_router(coord_router)
app.include_router(admin_router)
app.include_router(audit_fhir_router)
app.include_router(ws_router)
app.include_router(prompt7b_router)

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs_url": "/docs",
        "notice": "SYNTHETIC DEMO DATA - NOT FOR CLINICAL USE"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "data_residency": settings.DATA_RESIDENCY}
