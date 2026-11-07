from fastapi import APIRouter
from app.api.routes import admin, devices, campaigns, reports
api_router = APIRouter()
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(devices.router, prefix="/device", tags=["devices"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["campaigns"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
