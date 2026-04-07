"""
User management routes.

Contains endpoints for user-related operations (viewing, updating, deleting).
Most endpoints are admin-only.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.user import UserResponse, UpdateProfileRequest
from app.api.deps import get_current_user, get_current_admin
from app.repositories.user_repo import get_user_by_id
from app.services.auth_service import update_user_profile
from app.utils.api_error import ApiError
from app.core.error_codes import ErrorCodes
from app.api.limiter import limiter

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/profile", response_model=ApiResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Get authenticated user's profile information.

    Returns the current user's profile data without exposing sensitive fields
    like password or refresh tokens.

    Args:
        current_user: Authenticated user (from get_current_user dependency)

    Returns:
        ApiResponse 200 with:
        - data: UserResponse (id, fullname, username, email, role)
        - message: "User profile"

    Raises:
        ApiError(401): If not authenticated (automatic from get_current_user)
    """
    # Convert User model to UserResponse schema (validates and serializes)
    user_response = UserResponse.model_validate(current_user)

    return ApiResponse(
        statusCode=200,
        success=True,
        message="User profile",
        data=user_response,
    )


@router.get("/{user_id}", response_model=ApiResponse)
def get_user_profile(
    user_id: UUID,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Get any user's profile information (admin only).

    Allows admins to view any user's profile data. Non-admin users cannot
    access this endpoint (403 error is raised automatically by get_current_admin
    dependency).

    Args:
        user_id: UUID of user to view (from URL path)
        admin_user: Authenticated admin user (from get_current_admin dependency)
        db: Database session

    Returns:
        ApiResponse 200 with:
        - data: UserResponse (id, fullname, username, email, role)
        - message: "User profile"

    Raises:
        ApiError(401): If not authenticated
        ApiError(403): If user is not admin (automatic from get_current_admin)
        ApiError(400): If user_id doesn't exist (USER_NOT_FOUND)
    """
    # Query user by ID
    target_user = get_user_by_id(db, user_id)

    # If user not found, raise 400
    if not target_user:
        raise ApiError(
            statusCode=400,
            message="User not found",
            code=ErrorCodes.USER_NOT_FOUND,
        )

    # Convert User model to UserResponse schema (validates and serializes)
    user_response = UserResponse.model_validate(target_user)

    return ApiResponse(
        statusCode=200,
        success=True,
        message="User profile",
        data=user_response,
    )


@router.post("/updateProfile", response_model=ApiResponse)
@limiter.limit("5/minute")
def update_profile(
    request: Request,
    profile_data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update authenticated user's profile information.

    Allows users to update their own username and fullname. Validates that the
    new username is not already taken by another user.

    Args:
        request: FastAPI request object (required for rate limiting)
        profile_data: Request body with username and fullname fields
        current_user: Authenticated user (from get_current_user dependency)
        db: Database session

    Returns:
        ApiResponse 201 with:
        - data: UserResponse (updated user data)
        - message: "Account details updated successfully"

    Raises:
        ApiError(400): DUPLICATE_USERNAME if username already taken
        ApiError(401): If not authenticated
        ApiError(429): If rate limit exceeded
    """
    # Update user profile and get updated user
    updated_user = update_user_profile(
        db,
        current_user,
        profile_data.username,
        profile_data.fullname,
    )

    # Convert User model to UserResponse schema (validates and serializes)
    user_response = UserResponse.model_validate(updated_user)

    return ApiResponse(
        statusCode=201,
        success=True,
        message="Account details updated successfully",
        data=user_response,
    )


@router.patch("/{user_id}", response_model=ApiResponse)
@limiter.limit("5/minute")
def update_user(
    request: Request,
    user_id: UUID,
    profile_data: UpdateProfileRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Update any user's profile information (admin only).

    Allows admins to update any user's username and fullname. Validates that the
    new username is not already taken by another user.

    Args:
        request: FastAPI request object (required for rate limiting)
        user_id: UUID of user to update (from URL path)
        profile_data: Request body with username and fullname fields
        admin_user: Authenticated admin user (from get_current_admin dependency)
        db: Database session

    Returns:
        ApiResponse 201 with:
        - data: UserResponse (updated user data)
        - message: "Account details updated successfully"

    Raises:
        ApiError(400): USER_NOT_FOUND if user_id doesn't exist
        ApiError(400): DUPLICATE_USERNAME if username already taken
        ApiError(401): If not authenticated
        ApiError(403): If user is not admin
        ApiError(429): If rate limit exceeded
    """
    # Get target user from database
    target_user = get_user_by_id(db, user_id)

    if not target_user:
        raise ApiError(
            statusCode=400,
            message="User not found",
            code=ErrorCodes.USER_NOT_FOUND,
        )

    # Update user profile and get updated user
    updated_user = update_user_profile(
        db,
        target_user,
        profile_data.username,
        profile_data.fullname,
    )

    # Convert User model to UserResponse schema (validates and serializes)
    user_response = UserResponse.model_validate(updated_user)

    return ApiResponse(
        statusCode=201,
        success=True,
        message="Account details updated successfully",
        data=user_response,
    )
