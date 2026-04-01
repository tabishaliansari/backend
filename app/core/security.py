"""
Authentication security utilities for FastAPI application.

Provides password hashing and JWT token handling for user authentication.
Uses passlib with bcrypt for passwords and python-jose for JWT tokens.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

# JWT Configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt.

    Args:
        password: The plain text password to hash

    Returns:
        The hashed password string
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password.

    Args:
        plain_password: The plain text password provided by user
        hashed_password: The hashed password stored in database

    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a signed JWT access token.

    Args:
        data: Dictionary containing token claims (typically includes "sub" for user id)
        expires_delta: Optional custom expiration time. If not provided, uses default (60 minutes)

    Returns:
        Encoded JWT token string

    Example:
        token = create_access_token({"sub": "user_id", "email": "user@example.com"})
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT token.

    Verifies the token signature and expiration. Returns None if token is invalid
    or expired instead of raising an exception, making it safe for use in FastAPI
    dependencies.

    Args:
        token: The JWT token string to decode

    Returns:
        Dictionary containing token payload if valid, None if invalid or expired

    Example:
        payload = decode_token(token)
        if payload is None:
            # Token is invalid or expired
            raise ApiError(401, "Invalid or expired token")
        user_id = payload.get("sub")
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None