import hashlib, secrets
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.device import Device

def enroll(db: Session, code: str, name: str, platform: str):
    if not secrets.compare_digest(code, settings.device_enrollment_code):
        raise HTTPException(status_code=403, detail="Invalid enrollment code")
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    device = Device(name=name, platform=platform, token_hash=token_hash)
    db.add(device); db.commit(); db.refresh(device)
    return {"device_id": device.id, "device_token": raw_token}
