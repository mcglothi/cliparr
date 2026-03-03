from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cliparr_env: str = "development"
    cliparr_web_origin: str = "http://localhost:3000"
    cliparr_encryption_key: str
    database_url: str
    redis_url: str


settings = Settings()
