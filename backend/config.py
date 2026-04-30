import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # .env dosyasında DATABASE_URL tanımla, yoksa varsayılan kullanılır
    DATABASE_URL: str = "postgresql+psycopg2://postgres:burdur15@localhost:5432/burdurdb"
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()

