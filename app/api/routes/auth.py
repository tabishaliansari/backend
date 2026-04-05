from fastapi import APIRouter, Request, Response
from fastapi.params import Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.user import UserRegister, UserResponse, UserLogin
from app.schemas.response import ApiResponse
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
    """
    Register a new user with email and password.

    Validates unique username and email, hashes password, creates user account.
    User must verify email before logging in.

    Args:
        request: FastAPI request object (required for rate limiting)
        user_data: Registration data (fullname, email, username, password)
        db: Database session

    Returns:
        UserResponse with created user data (id, fullname, username, email, role)

    Raises:
        ApiError(400): If username or email already exists
    """
    return register_user(db, user_data)


@router.post("/login")
@limiter.limit("1/second")
def login(
    request: Request,
    login_data: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Authenticate user and return JWT tokens via HTTP-only cookies.

    Validates email and password, then creates access and refresh tokens.
    Tokens are set as HTTP-only secure cookies to prevent XSS attacks.

    Flow (mirrors Express loginUser controller):
    1. Validate email is registered in database
    2. Check email is verified
    3. Verify password matches hashed password
    4. Generate access token (15 minutes, for API requests)
    5. Generate refresh token (7 days, for token refresh)
    6. Store refresh token in database
    7. Set tokens as HTTP-only cookies
    8. Return user data in response body

    Args:
        request: FastAPI request object (required for rate limiting)
        login_data: Login credentials (email, password)
        db: Database session
        response: FastAPI Response object (injected for cookie setting)

    Returns:
        ApiResponse with:
        - accessToken and refreshToken set as HTTP-only cookies
        - User data in response body (without sensitive fields)
        - Success message

    Raises:
        ApiError(401): If email not found or password invalid
        ApiError(400): If email not verified (USER_NOT_VERIFIED)
    """
    # Get tokens and user from service
    access_token, refresh_token, user = login_user(db, login_data)

    # Set HTTP-only secure cookies for tokens (Express pattern)
    # accessToken: Short-lived (1 hour), used for API authentication
    response.set_cookie(
        key="accessToken",
        value=access_token,
        httponly=True,  # Prevent JavaScript access (XSS protection)
        secure=True,    # Send only over HTTPS
        samesite="lax", # CSRF protection
        max_age=3600,   # 1 hour (3600 seconds)
    )

    # refreshToken: Long-lived (7 days), used to obtain new access tokens
    response.set_cookie(
        key="refreshToken",
        value=refresh_token,
        httponly=True,  # Prevent JavaScript access
        secure=True,    # Send only over HTTPS
        samesite="lax", # CSRF protection
        max_age=604800, # 7 days (604800 seconds)
    )

    # Return custom response schema
    # FastAPI auto-serializes Pydantic model to JSON
    return ApiResponse(
        statusCode=200,
        success=True,
        message="Login successful",
        data={
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "fullname": user.fullname,
            "role": user.role,
        },
    )



