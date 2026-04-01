from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserRegister, UserLogin
from app.core.security import hash_password, verify_password, create_access_token
from app.utils.api_error import ApiError
from app.core.error_codes import ErrorCodes
from app.repositories.user_repo import (
    get_user_by_email,
    get_user_by_username,
    create_user as create_user_repo,
)


def register_user(db: Session, user_data: UserRegister):
    """
    Register a new user with validation.

    Checks for duplicate username and email before creating user.

    Args:
        db: Database session
        user_data: User registration data

    Returns:
        The created User object

    Raises:
        ApiError: If username or email already exists
    """
    existing_username = get_user_by_username(db, user_data.username)
    if existing_username:
        raise ApiError(
            statusCode=400,
            message="Username already exists",
            code=ErrorCodes.DUPLICATE_USERNAME,
        )

    existing_email = get_user_by_email(db, user_data.email)
    if existing_email:
        raise ApiError(
            statusCode=400,
            message="Email already exists",
            code=ErrorCodes.DUPLICATE_EMAIL,
        )

    hashed_password = hash_password(user_data.password)
    new_user = create_user_repo(db, user_data, hashed_password)

    return new_user


def login_user(db: Session, login_data: UserLogin):
    """
    Authenticate a user and return JWT token.

    Validates email and password, then creates access token.

    Args:
        db: Database session
        login_data: Login credentials (email and password)

    Returns:
        Dictionary with access_token and token_type

    Raises:
        ApiError: If email not found or password invalid
    """
    user = get_user_by_email(db, login_data.email)
    if not user:
        raise ApiError(
            statusCode=401,
            message="Invalid email or password",
            code=ErrorCodes.INVALID_CREDENTIALS,
        )

    if not verify_password(login_data.password, user.hashed_password):
        raise ApiError(
            statusCode=401,
            message="Invalid email or password",
            code=ErrorCodes.INVALID_CREDENTIALS,
        )

    token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "username": user.username}
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }