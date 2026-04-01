"""
OAuth and authentication helper utilities.

Provides logic for OAuth user verification and conditional field requirements.
Replaces Mongoose pre-save hook logic for SQLAlchemy models.
"""

from typing import Optional
from app.models.user import User


def auto_verify_oauth_user(user: User) -> None:
    """
    Automatically verify email for OAuth users.

    Replaces Mongoose pre-save hook logic:
    ```javascript
    if (this.isNew) {
        if (this.googleId || this.githubId) {
            this.isEmailVerified = true;
        }
    }
    ```

    OAuth providers (Google, GitHub) have already verified the user's email,
    so we can mark it as verified immediately on account creation.

    Args:
        user: The User object to potentially verify

    Example:
        user = User(email="user@gmail.com", google_id="google_123")
        auto_verify_oauth_user(user)  # Sets is_email_verified = True
        db.add(user)
        db.commit()
    """
    if user.google_id or user.github_id:
        user.is_email_verified = True


def should_require_password(
    google_id: Optional[str] = None,
    github_id: Optional[str] = None
) -> bool:
    """
    Determine if password field is required for user.

    Password is REQUIRED for traditional username/password signup.
    Password is OPTIONAL for OAuth users (they authenticate via provider).

    Replaces Mongoose schema validation:
    ```javascript
    password: {
        required: [!this.googleId && !this.githubId, "..."]
    }
    ```

    Args:
        google_id: Optional Google OAuth ID
        github_id: Optional GitHub OAuth ID

    Returns:
        True if password is required (user is NOT using OAuth)
        False if password is optional (user IS using OAuth)

    Example:
        if should_require_password(google_id=None, github_id=None):
            # Traditional signup - validate password
            if not user_data.password:
                raise ApiError(400, "Password is required")
    """
    # If NO OAuth credentials, password IS required
    # If ANY OAuth credential exists, password is NOT required
    return not (google_id or github_id)


def should_require_username(
    google_id: Optional[str] = None,
    github_id: Optional[str] = None
) -> bool:
    """
    Determine if username field is required for user.

    Username is REQUIRED for traditional username/password signup.
    Username is OPTIONAL for OAuth users (but still recommended for user profile).

    Same logic as should_require_password.

    Args:
        google_id: Optional Google OAuth ID
        github_id: Optional GitHub OAuth ID

    Returns:
        True if username is required (user is NOT using OAuth)
        False if username is optional (user IS using OAuth)

    Example:
        if should_require_username(google_id=None, github_id=None):
            # Traditional signup - validate username
            if not user_data.username:
                raise ApiError(400, "Username is required")
    """
    # If NO OAuth credentials, username IS required
    # If ANY OAuth credential exists, username is NOT required
    return not (google_id or github_id)


def is_oauth_user(user: User) -> bool:
    """
    Check if a user authenticated via OAuth.

    Args:
        user: The User object to check

    Returns:
        True if user has any OAuth credentials, False otherwise

    Example:
        if is_oauth_user(user):
            # User authenticated via Google or GitHub
            # They don't need password reset functionality
        else:
            # Traditional username/password user
            # Can use password reset flow
    """
    return bool(user.google_id or user.github_id)
