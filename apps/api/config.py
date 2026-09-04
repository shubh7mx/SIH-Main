from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SIH26162 Thermal Intelligence API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"

    # Environment & Host
    ENV: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "*"]

    # Database
    DATABASE_URL: str = "postgresql://sih_user:sih_secret_2026@localhost:5432/sih26162_spatial"

    # NASA FIRMS
    FIRMS_API_KEY: str = "mock_key_demo"
    FIRMS_SOURCE: str = "VIIRS_SNPP_NRT"
    FIRMS_BBOX: str = "6,68,38,98"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI Intelligence Engine (Tactical Copilot & Incident Analysis backend)
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: str = "nvidia/nemotron-3.5-lightning:free"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    SITE_URL: str = "https://sih26162.ntro.gov.in"
    SITE_NAME: str = "NTRO Thermal Intelligence"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
