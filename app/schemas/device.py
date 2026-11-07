from pydantic import BaseModel, Field, field_validator


class DeviceEnroll(BaseModel):
    enrollment_code: str = Field(min_length=1, max_length=256)
    name: str = Field(min_length=1, max_length=100)
    platform: str = Field(default="iOS", min_length=2, max_length=30)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Device name cannot be blank")
        return value.strip()

    @field_validator("platform")
    @classmethod
    def supported_platform(cls, value: str) -> str:
        if value not in {"iOS"}:
            raise ValueError("Only iOS devices are currently supported")
        return value


class DeviceHeartbeat(BaseModel):
    app_version: str | None = Field(default=None, max_length=40)
    shortcut_version: str | None = Field(default=None, max_length=40)
