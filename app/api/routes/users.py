from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.user import UserResponse
from app.api.deps import get_current_admin
from app.repositories.user_repo import get_user_by_id
from app.utils.api_error import ApiError
from app.core.error_codes import ErrorCodes

"""
User management routes.

Contains endpoints for user-related operations (viewing, updating, deleting).
Most endpoints are admin-only.
"""

router = APIRouter(prefix="/users", tags=["Users"])


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
