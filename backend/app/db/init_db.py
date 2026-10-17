import json
import os
from sqlalchemy.orm import Session
from app.db.session import engine, Base
from app.models.entities import (
    Facility, User, Pathway, Rule
)
from app.core.security import get_password_hash

def init_db(db: Session):
    # Create all tables in database
    Base.metadata.create_all(bind=engine)

    # Initialize default pathway DIAB-HBA1C if not present
    pathway_path = os.path.join(os.path.dirname(__file__), "..", "..", "config", "pathway_diab_hba1c.json")
    if os.path.exists(pathway_path):
        try:
            with open(pathway_path, "r", encoding="utf-8") as f:
                p_data = json.load(f)
                existing = db.query(Pathway).filter(Pathway.code == p_data["code"]).first()
                if not existing:
                    new_p = Pathway(
                        code=p_data["code"],
                        name=p_data["name"],
                        protocol_json=p_data.get("protocol_json", {}),
                        closure_checklist_json=p_data.get("closure_checklist_json", []),
                        sla_json=p_data.get("sla_json", {}),
                        version=p_data.get("version", "1.0"),
                        approved_by=p_data.get("approved_by")
                    )
                    db.add(new_p)
                    db.commit()
        except Exception as e:
            print(f"Error initializing pathway: {e}")
