"""
Cloudinary service for avatar upload and management.

Handles all Cloudinary operations including upload, deletion, and configuration.
Provides clean abstraction for file storage operations.
"""

import logging
import cloudinary
import cloudinary.uploader
from app.core.config import settings
from app.utils.api_error import ApiError
from app.core.error_codes import ErrorCodes

logger = logging.getLogger(__name__)


def configure_cloudinary():
    """
    Initialize Cloudinary with credentials from environment variables.
    Call this at application startup.
    """
    if not all([settings.CLOUDINARY_CLOUD_NAME, settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET]):
        logger.warning("Cloudinary credentials not fully configured. File uploads will fail.")
        return

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET
    )


def upload_avatar_to_cloudinary(file, user_id: str) -> dict:
    """
    Upload avatar file to Cloudinary.

    Uploads the file to the "avatars" folder with the user ID as the public_id.
    Overwrites existing avatars for the same user.

    Args:
        file: UploadFile object from FastAPI
        user_id: User UUID as string (used as public_id)

    Returns:
        dict with keys:
            - secure_url: HTTPS URL of uploaded image
            - public_id: Cloudinary public ID for deletion

    Raises:
        ApiError: If upload fails (500 AVATAR_UPLOAD_FAILED)
    """
    try:
        result = cloudinary.uploader.upload(
            file.file,
            folder="avatars",
            public_id=f"avatar_{user_id}",
            overwrite=True,  # Replace if exists
            resource_type="auto"
        )
        return {
            "secure_url": result.get("secure_url"),
            "public_id": result.get("public_id")
        }
    except Exception as e:
        logger.error(f"Failed to upload avatar for user {user_id}: {e}")
        raise ApiError(
            statusCode=500,
            message="Failed to upload avatar to storage",
            code=ErrorCodes.AVATAR_UPLOAD_FAILED
        )


def delete_avatar_from_cloudinary(public_id: str) -> bool:
    """
    Delete avatar from Cloudinary by public_id.

    Safe to call even if public_id is empty or None.
    Failures are logged but not raised (graceful degradation).

    Args:
        public_id: Cloudinary public ID

    Returns:
        True if successful, False on error
    """
    if not public_id:
        return True

    try:
        cloudinary.uploader.destroy(public_id)
        logger.info(f"Deleted avatar {public_id} from Cloudinary")
        return True
    except Exception as e:
        logger.warning(f"Failed to delete avatar {public_id} from Cloudinary: {e}")
        return False


# Initialize Cloudinary on module import
configure_cloudinary()
