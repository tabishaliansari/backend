"""
User data transformation and serialization utilities.

Provides functions for safely converting user objects to response-safe formats.
Prevents accidental exposure of sensitive information in API responses.
"""

from typing import Dict, Any
from app.models.user import User


def get_public_user_data(user: User) -> Dict[str, Any]:
    """
    Return safe, public user data for API responses.

    Excludes all sensitive fields:
    - hashed_password: Never expose password hash
    - google_id: OAuth credentials are private
    - github_id: OAuth credentials are private
    - forgot_password_token: Security token, never expose
    - forgot_password_token_expiry: Related to security token
    - email_verification_token: Security token, never expose
    - email_verification_token_expiry: Related to security token
    - refresh_token: Session token, never expose in responses

    Includes safe, public user information:
    - id: User identifier
    - email: User email address
    - username: User handle/display name
    - fullname: User's full name
    - role: User's role (admin/user)
    - is_email_verified: Verification status
    - avatar: User's profile picture
    - created_at: Account creation timestamp
    - updated_at: Last update timestamp

    Replaces Mongoose method:
    ```javascript
    userSchema.methods.toPublicUserJSON = function () {
        return {
            _id: this._id,
            email: this.email,
            username: this.username,
            isEmailVerified: this.isEmailVerified,
            avatar: this.avatar,
        };
    };
    ```

    Args:
        user: The User object to serialize

    Returns:
        Dictionary with safe user data (no sensitive fields)

    Example:
        @router.get("/profile")
        def get_profile(current_user: User = Depends(get_current_user)):
            return {
                "success": True,
                "data": get_public_user_data(current_user)
            }
    """
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "fullname": user.fullname,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "is_email_verified": user.is_email_verified,
        "avatar": user.avatar,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }
