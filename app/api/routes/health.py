from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.services.health_service import get_health, check_db_connection
from app.db.database import get_db

router = APIRouter(prefix="/health", tags=["Health", "Status"])


@router.get("/")
def system_health():
    """Get basic application health status."""
    return get_health()


@router.get("/db")
def db_status(db: Session = Depends(get_db)):
    """Check database connection status."""
    return check_db_connection(db)