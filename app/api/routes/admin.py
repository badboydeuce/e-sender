from fastapi import APIRouter, Depends
from app.core.security import require_admin
router = APIRouter()
@router.get("/overview", dependencies=[Depends(require_admin)])
def overview():
    return {"devices": [], "campaigns": [], "note": "Connect database-backed summaries here."}
