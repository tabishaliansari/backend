"""
FastAPI dependencies for shared request logic.

Provides reusable dependency functions for routes including authentication
and authorization. Dependencies inject required data into route handlers.

This module replaces Express middleware patterns with FastAPI's dependency
injection system.
"""

from uuid import UUID
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

from app.db.database import get_db
from app.core.security import decode_token
from app.repositories.user_repo import get_user_by_id
from app.models.user import User
from app.utils.api_error import ApiError
from app.core.error_codes import ErrorCodes

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


def get_token(request: Request, token: str | None = Depends(oauth2_scheme)) -> str:
    """
    Extract access token from either cookies or Authorization header.

    Priority:
    1. Cookies (browser)
    2. Authorization header (Bearer token)
    """

    # 1️⃣ Try cookie first (primary for web)
    cookie_token = request.cookies.get("accessToken")
    if cookie_token:
        return cookie_token

    # 2️⃣ Fallback to Authorization header
    if token:
        return token

    # 3️⃣ No token found
    raise ApiError(
        statusCode=401,
        message="Access token missing. Please log in.",
        code=ErrorCodes.USER_NOT_LOGGED_IN,
    )


def get_current_user(request: Request, db: Session = Depends(get_db), token: str = Depends(get_token)) -> User:
    """
    FastAPI dependency to get the currently authenticated user.

    Replicates Express middleware behavior of "isLoggedIn" - validates the
    JWT token from cookies and returns the authenticated user object.

    Flow:
    1. Extract `accessToken` from cookies
    2. Validate token exists
    3. Decode JWT token
    4. Validate token is valid (not expired, valid signature)
    5. Extract user ID from token payload ("sub" claim)
    6. Fetch user from database
    7. Validate user exists
    8. Return authenticated user

    Args:
        request: FastAPI Request object
        db: Database session (FastAPI injected via Depends)

    Returns:
        User object of authenticated user

    Raises:
        ApiError(401): If token missing, invalid, expired, or user not found

    Usage in routes:
        @router.get("/profile")
        def get_profile(current_user: User = Depends(get_current_user)):
            return {"username": current_user.username}
    
    
    Hybrid authentication dependency:
    Supports both cookie-based and Bearer token authentication.

    Flow:
    1. Extract token (cookie or header)
    2. Decode JWT
    3. Validate payload
    4. Fetch user from DB
    """

    # Step 1: Decode and validate token
    payload = decode_token(token)

    if payload is None:
        raise ApiError(
            statusCode=401,
            message="Invalid or expired access token",
            code=ErrorCodes.INVALID_ACCESS_TOKEN,
        )

    # Step 2: Extract user ID from token payload
    user_id_str = payload.get("sub")

    if not user_id_str:
        raise ApiError(
            statusCode=401,
            message="Invalid token payload",
            code=ErrorCodes.INVALID_ACCESS_TOKEN,
        )

    # Step 3: Convert to UUID
    try:
        user_id = UUID(user_id_str)
    except (ValueError, TypeError, AttributeError):
        raise ApiError(
            statusCode=401,
            message="Invalid token payload",
            code=ErrorCodes.INVALID_ACCESS_TOKEN,
        )

    # Step 4: Fetch user from database
    user = get_user_by_id(db, user_id)

    # Step 5: Validate user exists
    if not user:
        raise ApiError(
            statusCode=401,
            message="User not found",
            code=ErrorCodes.INVALID_ACCESS_TOKEN,
        )

    # Step 6: Return authenticated user
    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    FastAPI dependency to get the currently authenticated admin user.

    Validates that the authenticated user has admin role.

    Args:
        current_user: Authenticated user (FastAPI injected via Depends)

    Returns:
        User object if user is admin

    Raises:
        ApiError(403): If user is not an admin

    Usage in routes:
        @router.delete("/users/{user_id}")
        def delete_user(user_id: int, admin: User = Depends(get_current_admin)):
            # Only admins can call this
            return {"message": "User deleted"}
    """
    if current_user.role != "admin":
        raise ApiError(
            statusCode=403,
            message="Admin access required",
            code=ErrorCodes.UNAUTHORIZED_ACCESS,
        )

    return current_user

