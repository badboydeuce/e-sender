from fastapi import APIRouter, Depends
from app.core.security import require_device_token
from app.schemas.report import ReportCreate
router = APIRouter()
@router.post("", dependencies=[Depends(require_device_token)])
def submit_report(payload: ReportCreate):
    # TODO: persist report after resolving authenticated device identity.
    return {"accepted": True, "outcome": payload.outcome}
