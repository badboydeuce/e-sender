from pydantic import BaseModel, Field
class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    message_template: str = Field(min_length=1, max_length=5000)
