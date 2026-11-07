import hashlib
import hmac

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.device import Device


def _token_digest(raw_token: str) -> str:
    return hmac.new(
        settings.device_token_secret.encode("utf-8"),
        raw_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def require_admin(authorization: str | None = Header(default=None)):
    expected = f"Bearer {settings.admin_api_token}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return True


def require_device_token(
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
    db: Session = Depends(get_db),
) -> Device:
    if not x_device_token or len(x_device_token) < 32 or len(x_device_token) > 256:
        raise HTTPException(status_code=401, detail="Device authentication required")

    digest = _token_digest(x_device_token)
    device = db.query(Device).filter(Device.token_hash == digest).first()
    if device is None or not device.active:
        raise HTTPException(status_code=401, detail="Invalid or revoked device token")
    return device
