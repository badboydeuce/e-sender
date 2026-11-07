from sqlalchemy.orm import Session
from app.models.campaign import Campaign
from app.models.command import DeviceCommand

ALLOWED_COMMANDS = {"start", "pause", "resume", "stop"}

def create_campaign(db: Session, name: str, message_template: str):
    item = Campaign(name=name, message_template=message_template)
    db.add(item); db.commit(); db.refresh(item)
    return item

def queue_command(db: Session, device_id: int, campaign_id: int | None, command: str):
    if command not in ALLOWED_COMMANDS:
        raise ValueError("Unsupported command")
    item = DeviceCommand(device_id=device_id, campaign_id=campaign_id, command=command)
    db.add(item); db.commit(); db.refresh(item)
    return item
