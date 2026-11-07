from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite:///./esim_sender.db"
    admin_api_token: str = "change-me"
    device_enrollment_code: str = "change-me-too"
    device_token_secret: str = "change-me-three"
    heartbeat_timeout_seconds: int = 180
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
