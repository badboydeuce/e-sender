from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_admin, require_device_token
from app.db.session import get_db
from app.models.device import Device
from app.schemas.device import DeviceEnroll, DeviceHeartbeat
from app.services.devices import enroll, record_heartbeat, revoke_device

router = APIRouter()


@router.post("/enroll")
def register(payload: DeviceEnroll, db: Session = Depends(get_db)):
    return enroll(db, payload.enrollment_code, payload.name, payload.platform)


@router.post("/heartbeat")
def heartbeat(
    payload: DeviceHeartbeat,
    device: Device = Depends(require_device_token),
    db: Session = Depends(get_db),
):
    return record_heartbeat(db, device, payload.app_version, payload.shortcut_version)


@router.post("/{device_id}/revoke", dependencies=[Depends(require_admin)])
def revoke(device_id: int, db: Session = Depends(get_db)):
    return revoke_device(db, device_id)
