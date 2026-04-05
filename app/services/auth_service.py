"""
Authentication service layer.

Handles user registration, login, and token generation.
Implements business logic for authentication flows.

Note: Password hashing happens here (not in pre-save hook like Mongoose).
SQLAlchemy doesn't have equivalent pre-save hooks, so we hash in the service
layer BEFORE passing to repository.

Future utilities to integrate:
- auto_verify_oauth_user() from app.utils.auth_helpers
- should_require_password/username() for OAuth validation
- get_public_user_data() for response serialization
- generate_temporary_token() for password reset flow
- create_refresh_token() from app.core.security for token refresh
"""

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserRegister, UserLogin
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
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

    Password hashing:
    - Password is hashed using bcrypt in this service layer
    - Replaces Mongoose pre("save") hook that auto-hashed passwords
    - Hashing happens BEFORE user is saved to database
    - Uses passlib with bcrypt (10 salt rounds)

    OAuth verification (FUTURE):
    - Will use auto_verify_oauth_user() from utils.auth_helpers
    - If user has google_id or github_id, auto-set is_email_verified=True
    - OAuth providers already verified the email

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

    # Hash password BEFORE database insertion
    # Replaces Mongoose pre("save") hook behavior
    hashed_password = hash_password(user_data.password)
    new_user = create_user_repo(db, user_data, hashed_password)

    # FUTURE: OAuth auto-verification
    # from app.utils.auth_helpers import auto_verify_oauth_user
    # auto_verify_oauth_user(new_user)  # Sets is_email_verified=True if OAuth
    # db.commit()

    return new_user


def login_user(db: Session, login_data: UserLogin) -> tuple[str, str, User]:
    """
    Authenticate a user and return JWT tokens.

    Validates email and password, then creates both access and refresh tokens.
    This function mirrors the Express.js loginUser controller behavior.

    Flow (matching Express pattern):
    1. Get user by email
    2. Check email is verified (login blocked for unverified accounts)
    3. Verify password using bcrypt
    4. Generate access token (short-lived, 15 min)
    5. Generate refresh token (long-lived, 7 days)
    6. Store refresh token in database
    7. Return both tokens and user data

    Args:
        db: Database session
        login_data: Login credentials (email and password)

    Returns:
        Tuple of (access_token: str, refresh_token: str, user: User object)

    Raises:
        ApiError(401): If email not found or password invalid
        ApiError(400): If email not verified (USER_NOT_VERIFIED error code)
    """
    # Step 1: Query user by email
    user = get_user_by_email(db, login_data.email)
    if not user:
        # Generic error prevents email enumeration attacks (Express pattern)
        raise ApiError(
            statusCode=401,
            message="Invalid email or password",
            code=ErrorCodes.INVALID_CREDENTIALS,
        )

    # Step 2: Check email is verified
    # OAuth users auto-verify on signup; traditional users must verify email
    if not user.is_email_verified:
        raise ApiError(
            statusCode=400,
            message="User email not verified. Please verify your email to login.",
            code=ErrorCodes.USER_NOT_VERIFIED,
        )

    # Step 3: Verify password using bcrypt comparison
    if not verify_password(login_data.password, user.hashed_password):
        # Generic error prevents timing attacks and email enumeration
        raise ApiError(
            statusCode=401,
            message="Invalid email or password",
            code=ErrorCodes.INVALID_CREDENTIALS,
        )

    # Step 4: Generate access token (short-lived)
    # Used for authenticating API requests
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "username": user.username}
    )

    # Step 5: Generate refresh token (long-lived)
    # Used to obtain new access tokens without requiring re-authentication
    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "email": user.email, "username": user.username}
    )

    # Step 6: Store refresh token in database
    # Refresh tokens are stateful (stored in DB) unlike access tokens (stateless)
    # This allows server to revoke refresh tokens independently
    user.refresh_token = refresh_token
    db.commit()

    # Step 7: Return both tokens and user data
    # Route handler will set tokens as HTTP-only cookies
    return (access_token, refresh_token, user)

