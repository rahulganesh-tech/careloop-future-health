import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
from jose import jwt, JWTError
from app.core.config import settings

SECRET_KEY = settings.JWT_SECRET
ALGORITHM = settings.JWT_ALGORITHM

def get_password_hash(password: str) -> str:
    salt = "careloop_salt_"
    h = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"sha256${h}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("sha256$"):
        expected = get_password_hash(plain_password)
        return hmac.compare_digest(expected, hashed_password)
    # Support plain match for seeded demo users if needed
    if plain_password == hashed_password:
        return True
    return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def create_patient_token(patient_id: str, case_id: Optional[str] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.PATIENT_LINK_EXPIRE_MINUTES)
    to_encode = {
        "sub": f"patient_{patient_id}",
        "patient_id": patient_id,
        "case_id": case_id,
        "role": "PATIENT",
        "exp": expire
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_patient_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "PATIENT":
            return None
        return payload
    except JWTError:
        return None
