from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    PROJECT_NAME: str = "Bridge"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "bridge-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    # SQLite (async через aiosqlite). Файл: ./bridge.db
    DATABASE_URL: str = "sqlite+aiosqlite:///./bridge.db"
    DATABASE_URL_SYNC: str = "sqlite:///./bridge.db"
    # CORS: при allow_credentials=True нельзя использовать "*" — нужен список origin
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
