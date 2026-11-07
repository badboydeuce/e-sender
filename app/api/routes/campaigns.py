from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.schemas.campaign import CampaignCreate
from app.services.campaigns import create_campaign

router = APIRouter()
@router.post("", dependencies=[Depends(require_admin)])
def new_campaign(payload: CampaignCreate, db: Session = Depends(get_db)):
    item = create_campaign(db, payload.name, payload.message_template)
    return {"id": item.id, "name": item.name, "status": item.status}
