import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "HealthPulse AI CareLoop"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./careloop.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "careloop-secret-key-for-future-health-challenge-2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    PATIENT_LINK_EXPIRE_MINUTES: int = 30
    
    # Challenge seed OTP demo code
    OTP_DEMO_CODE: str = os.getenv("OTP_DEMO_CODE", "482913")
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]
    
    # Azure & AI Settings
    AI_ENABLED: bool = os.getenv("AI_ENABLED", "false").lower() in ("true", "1", "yes")
    AZURE_AI_PROJECT_ENDPOINT: str = os.getenv("AZURE_AI_PROJECT_ENDPOINT", "")
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
    AZURE_SEARCH_ENDPOINT: str = os.getenv("AZURE_SEARCH_ENDPOINT", "")
    AZURE_CONTENT_SAFETY_ENDPOINT: str = os.getenv("AZURE_CONTENT_SAFETY_ENDPOINT", "")
    AZURE_SPEECH_REGION: str = os.getenv("AZURE_SPEECH_REGION", "uaenorth")
    DATA_RESIDENCY: str = os.getenv("DATA_RESIDENCY", "UAE")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
