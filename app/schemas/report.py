from pydantic import BaseModel, Field
class ReportCreate(BaseModel):
    campaign_id: int | None = None
    outcome: str = Field(pattern="^(sent|skipped|failed|opted_out)$")
    detail: str | None = None
