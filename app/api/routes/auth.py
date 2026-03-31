from fastapi import APIRouter, HTTPException, Request
from fastapi.params import Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.user import UserRegister, UserResponse, UserLogin, TokenResponse
from app.services.auth_service import register_user, login_user
from ..limiter import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse)
@limiter.limit("1/second")
def register(
    request: Request, 
    user_data: UserRegister, 
    db: Session = Depends(get_db)
):
    return register_user(db, user_data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("1/second")
def login(
    request: Request,  # ✅ REQUIRED
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    return login_user(db, login_data)