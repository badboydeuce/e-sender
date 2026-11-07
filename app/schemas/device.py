from pydantic import BaseModel, Field
class DeviceEnroll(BaseModel):
    enrollment_code: str
    name: str = Field(min_length=1, max_length=100)
    platform: str = "iOS"
class DeviceHeartbeat(BaseModel):
    app_version: str | None = None
    shortcut_version: str | None = None
