from fastapi import APIRouter
from services.health_service import get_health

router = APIRouter(prefix="/health", tags=["Health", "Status"])

@router.get("/")
def system_health():
    return get_health()
