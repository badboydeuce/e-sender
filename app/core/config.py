from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite:///./esim_sender.db"
    admin_api_token: str = "change-me"
    device_enrollment_code: str = "change-me-too"
    device_token_secret: str = "change-me-three"
    heartbeat_timeout_seconds: int = 180

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.app_env.lower() == "production":
            for name in ("admin_api_token", "device_enrollment_code", "device_token_secret"):
                value = getattr(self, name)
                if value.startswith("change-me") or len(value) < 32:
                    raise ValueError(f"{name} must be a unique secret of at least 32 characters in production")
        if len(self.device_token_secret) < 32 and self.app_env.lower() != "development":
            raise ValueError("DEVICE_TOKEN_SECRET must contain at least 32 characters outside development")
        return self


settings = Settings()
