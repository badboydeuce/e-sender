from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import device, campaign, command, report  # noqa: F401

app = FastAPI(title="eSIM Sender Admin API", version="0.2.0")
app.include_router(api_router, prefix="/api")
app.mount("/", StaticFiles(directory="app/web", html=True), name="web")

@app.on_event("startup")
def create_dev_tables():
    # Development convenience only. Use Alembic migrations in production.
    if settings.app_env == "development":
        Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"status": "ok"}
