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

from app.db.database import get_db
from app.core.security import decode_token
from app.repositories.user_repo import get_user_by_id
from app.models.user import User
from app.utils.api_error import ApiError
from app.core.error_codes import ErrorCodes


def get_token(request: Request) -> str:
    """
    Extract access token from cookies.

    Args:
        request: FastAPI Request object

    Returns:
        Access token string

    Raises:
        ApiError(401): If token missing or invalid
    """
    # Extract token from cookies
    token = request.cookies.get("accessToken")
    if not token:
        raise ApiError(
            statusCode=401,
            message="Access token missing. Please log in.",
            code=ErrorCodes.USER_NOT_LOGGED_IN,
        )

    return token


def get_current_user(request: Request, db: Session = Depends(get_db), token: str = Depends(get_token)) -> User:
    """
    FastAPI dependency to get the currently authenticated user.

    Validates the JWT token from cookies and returns the authenticated user.

    Flow:
    1. Extract `accessToken` from cookies
    2. Decode JWT token
    3. Extract user ID from token payload ("sub" claim)
    4. Fetch user from database
    5. Return authenticated user

    Args:
        request: FastAPI Request object
        db: Database session
        token: Access token from cookies

    Returns:
        User object of authenticated user

    Raises:
        ApiError(401): If token invalid, expired, or user not found

    Usage in routes:
        @router.get("/profile")
        def get_profile(current_user: User = Depends(get_current_user)):
            return {"username": current_user.username}
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
        current_user: Authenticated user

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
