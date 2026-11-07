import hashlib
import hmac
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.device import Device


def _token_digest(raw_token: str) -> str:
    return hmac.new(
        settings.device_token_secret.encode("utf-8"),
        raw_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def enroll(db: Session, code: str, name: str, platform: str):
    if not hmac.compare_digest(code, settings.device_enrollment_code):
        raise HTTPException(status_code=403, detail="Invalid enrollment code")

    raw_token = secrets.token_urlsafe(48)
    device = Device(
        name=name.strip(),
        platform=platform,
        token_hash=_token_digest(raw_token),
        active=True,
    )
    db.add(device)
    db.commit()
    db.refresh(device)

    # The raw token is returned once. Only its keyed digest is persisted.
    return {
        "device_id": device.id,
        "device_name": device.name,
        "device_token": raw_token,
        "token_type": "Device",
        "message": "Save this token securely. It cannot be retrieved again.",
    }


def record_heartbeat(db: Session, device: Device, app_version: str | None, shortcut_version: str | None):
    device.last_seen = datetime.now(timezone.utc)
    db.add(device)
    db.commit()
    return {
        "accepted": True,
        "device_id": device.id,
        "server_time": device.last_seen.isoformat(),
        "app_version": app_version,
        "shortcut_version": shortcut_version,
    }


def revoke_device(db: Session, device_id: int):
    device = db.query(Device).filter(Device.id == device_id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    device.active = False
    db.add(device)
    db.commit()
    return {"device_id": device.id, "active": False}
