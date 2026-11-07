import secrets
from fastapi import Header, HTTPException
from app.core.config import settings

def require_admin(authorization: str | None = Header(default=None)):
    expected = f"Bearer {settings.admin_api_token}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Admin authentication required")

def require_device_token(x_device_token: str | None = Header(default=None)):
    # Starter placeholder: replace with hashed, revocable per-device tokens.
    if not x_device_token or len(x_device_token) < 24:
        raise HTTPException(status_code=401, detail="Device authentication required")
    return x_device_token
