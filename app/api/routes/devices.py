from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.device import DeviceEnroll, DeviceHeartbeat
from app.services.devices import enroll
from app.core.security import require_device_token

router = APIRouter()
@router.post("/enroll")
def register(payload: DeviceEnroll, db: Session = Depends(get_db)):
    return enroll(db, payload.enrollment_code, payload.name, payload.platform)

@router.post("/heartbeat")
def heartbeat(payload: DeviceHeartbeat, token: str = Depends(require_device_token)):
    # TODO: resolve token hash to device, update last_seen, reject revoked devices.
    return {"accepted": True, "server_time": datetime.now(timezone.utc).isoformat()}
