"""
Utility functions for temporary token generation.

Handles creation of temporary tokens for password reset and email verification.
These tokens are two-part: unhashed (sent to user) and hashed (stored in DB).
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any


def generate_temporary_token(
    expiry_minutes: int = 20
) -> Dict[str, Any]:
    """
    Generate a temporary token for password reset or email verification.

    Creates two versions of the token for security:
    - Unhashed token: sent to user (in email link or form)
    - Hashed token: stored in database (prevents exposure if DB is compromised)

    The unhashed token is what the user receives and should send back when
    resetting password or verifying email. The hashed version is what gets
    stored and compared against.

    Args:
        expiry_minutes: Token expiration time in minutes (default: 20 minutes)

    Returns:
        Dictionary with:
        {
            "unHashedToken": str (40 hex characters, sent to user),
            "hashedToken": str (SHA256 hash, stored in database),
            "tokenExpiry": datetime (when token expires)
        }

    Example:
        token_data = generate_temporary_token(expiry_minutes=20)
        # Store in DB:
        user.forgot_password_token = token_data["hashedToken"]
        user.forgot_password_token_expiry = token_data["tokenExpiry"]
        db.commit()
        # Send to user:
        reset_link = f"example.com/reset?token={token_data['unHashedToken']}"
    """
    # Generate random bytes and convert to hex (40 characters)
    unhashed_token = secrets.token_hex(20)

    # Create SHA256 hash of the unhashed token
    hashed_token = hashlib.sha256(unhashed_token.encode()).hexdigest()

    # Calculate expiration time
    token_expiry = datetime.utcnow() + timedelta(minutes=expiry_minutes)

    return {
        "unHashedToken": unhashed_token,
        "hashedToken": hashed_token,
        "tokenExpiry": token_expiry
    }


def verify_temporary_token(
    provided_token: str,
    stored_hashed_token: str,
    token_expiry: datetime
) -> bool:
    """
    Verify if a provided temporary token is valid.

    Checks if:
    1. The hashed version of provided token matches stored hash
    2. Token has not expired

    Args:
        provided_token: The unhashed token provided by user (from email link, etc.)
        stored_hashed_token: The hashed token stored in database
        token_expiry: The expiration datetime stored in database

    Returns:
        True if token is valid (matches hash and not expired), False otherwise

    Example:
        is_valid = verify_temporary_token(
            provided_token=request.query_params.get("token"),
            stored_hashed_token=user.forgot_password_token,
            token_expiry=user.forgot_password_token_expiry
        )
    """
    # Check expiration first
    if datetime.utcnow() > token_expiry:
        return False

    # Hash the provided token and compare with stored hash
    hashed_provided = hashlib.sha256(provided_token.encode()).hexdigest()
    return hashed_provided == stored_hashed_token
