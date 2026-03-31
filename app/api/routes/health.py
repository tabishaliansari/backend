from fastapi import APIRouter
from app.services.health_service import get_health
from app.db.database import check_db_connection

router = APIRouter(prefix="/health", tags=["Health", "Status"])

@router.get("/")
def system_health():
    return get_health()


@router.get("/db")
def db_status():
    return check_db_connection()