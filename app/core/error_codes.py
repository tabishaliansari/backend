"""
Centralized error codes for consistent API error handling.

These error codes provide machine-readable error identifiers that allow frontend
applications to handle specific error scenarios programmatically, independent of
language and HTTP status codes.

Organized by category:
- GENERAL: Common errors applicable across the application
- AUTH: Authentication and authorization errors
- VALIDATION: Input validation errors
- TOKEN: JWT token related errors
- USER: User management errors
- PASSWORD: Password related errors
- DATABASE: Database operation errors
- RATELIMIT: Rate limiting errors
"""


class ErrorCodes:
    """Machine-readable error codes for API responses."""

    # General Errors
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    BAD_REQUEST = "BAD_REQUEST"
    FORBIDDEN = "FORBIDDEN"

    # Authentication & Authorization
    UNAUTHORIZED = "UNAUTHORIZED"
    UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS"
    USER_NOT_LOGGED_IN = "USER_NOT_LOGGED_IN"
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS"

    # Token Management
    INVALID_ACCESS_TOKEN = "INVALID_ACCESS_TOKEN"
    EXPIRED_ACCESS_TOKEN = "EXPIRED_ACCESS_TOKEN"
    INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN"
    EXPIRED_REFRESH_TOKEN = "EXPIRED_REFRESH_TOKEN"
    TOKEN_REQUIRED = "TOKEN_REQUIRED"
    TOKEN_DECODE_ERROR = "TOKEN_DECODE_ERROR"
    MALFORMED_TOKEN = "MALFORMED_TOKEN"

    # User Management
    USER_NOT_FOUND = "USER_NOT_FOUND"
    USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    USER_NOT_VERIFIED = "USER_NOT_VERIFIED"
    USER_ACCOUNT_DISABLED = "USER_ACCOUNT_DISABLED"
    USER_ALREADY_VERIFIED = "USER_ALREADY_VERIFIED"
    DUPLICATE_USERNAME = "DUPLICATE_USERNAME"
    DUPLICATE_EMAIL = "DUPLICATE_EMAIL"

    # Password & Authentication
    PASSWORD_RESET_FAILED = "PASSWORD_RESET_FAILED"
    RESET_TOKEN_INVALID = "RESET_TOKEN_INVALID"
    RESET_TOKEN_EXPIRED = "RESET_TOKEN_EXPIRED"
    PASSWORDS_DO_NOT_MATCH = "PASSWORDS_DO_NOT_MATCH"
    INVALID_PASSWORD = "INVALID_PASSWORD"
    PASSWORD_CHANGE_FAILED = "PASSWORD_CHANGE_FAILED"
    PASSWORD_TOO_WEAK = "PASSWORD_TOO_WEAK"

    # OAuth & Social Auth
    INVALID_OAUTH_STATE = "INVALID_OAUTH_STATE"
    INVALID_NONCE = "INVALID_NONCE"
    MISSING_ID_TOKEN = "MISSING_ID_TOKEN"
    OAUTH_NO_ACCESS_TOKEN = "OAUTH_NO_ACCESS_TOKEN"
    OAUTH_PROVIDER_ERROR = "OAUTH_PROVIDER_ERROR"
    OAUTH_INVALID_CODE = "OAUTH_INVALID_CODE"

    # File Upload
    FILE_UPLOAD_FAILED = "FILE_UPLOAD_FAILED"
    AVATAR_UPLOAD_FAILED = "AVATAR_UPLOAD_FAILED"
    AVATAR_NOT_PROVIDED = "AVATAR_NOT_PROVIDED"
    INVALID_FILE_TYPE = "INVALID_FILE_TYPE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"

    # Database & Data
    DATABASE_ERROR = "DATABASE_ERROR"
    DATABASE_CONNECTION_ERROR = "DATABASE_CONNECTION_ERROR"
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY"
    INVALID_DATA = "INVALID_DATA"
    DATA_NOT_FOUND = "DATA_NOT_FOUND"

    # Rate Limiting
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"

    # Business Logic
    OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    RESOURCE_EXHAUSTED = "RESOURCE_EXHAUSTED"

    # Missing Fields/Parameters
    MISSING_FIELDS = "MISSING_FIELDS"
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"
    MISSING_REQUEST_BODY = "MISSING_REQUEST_BODY"


# Organize error codes by category for documentation
ERROR_CODE_CATEGORIES = {
    "general": [
        ErrorCodes.INTERNAL_SERVER_ERROR,
        ErrorCodes.VALIDATION_ERROR,
        ErrorCodes.NOT_FOUND,
        ErrorCodes.CONFLICT,
        ErrorCodes.BAD_REQUEST,
        ErrorCodes.FORBIDDEN,
    ],
    "authentication": [
        ErrorCodes.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED_ACCESS,
        ErrorCodes.USER_NOT_LOGGED_IN,
        ErrorCodes.INSUFFICIENT_PERMISSIONS,
    ],
    "tokens": [
        ErrorCodes.INVALID_ACCESS_TOKEN,
        ErrorCodes.EXPIRED_ACCESS_TOKEN,
        ErrorCodes.INVALID_REFRESH_TOKEN,
        ErrorCodes.EXPIRED_REFRESH_TOKEN,
        ErrorCodes.TOKEN_REQUIRED,
    ],
    "users": [
        ErrorCodes.USER_NOT_FOUND,
        ErrorCodes.USER_ALREADY_EXISTS,
        ErrorCodes.INVALID_CREDENTIALS,
        ErrorCodes.DUPLICATE_USERNAME,
        ErrorCodes.DUPLICATE_EMAIL,
    ],
    "password": [
        ErrorCodes.PASSWORD_RESET_FAILED,
        ErrorCodes.INVALID_PASSWORD,
        ErrorCodes.PASSWORDS_DO_NOT_MATCH,
    ],
    "oauth": [
        ErrorCodes.INVALID_OAUTH_STATE,
        ErrorCodes.OAUTH_PROVIDER_ERROR,
    ],
    "files": [
        ErrorCodes.FILE_UPLOAD_FAILED,
        ErrorCodes.AVATAR_UPLOAD_FAILED,
        ErrorCodes.INVALID_FILE_TYPE,
    ],
    "database": [
        ErrorCodes.DATABASE_ERROR,
        ErrorCodes.DATABASE_CONNECTION_ERROR,
    ],
    "ratelimit": [
        ErrorCodes.TOO_MANY_REQUESTS,
        ErrorCodes.RATE_LIMIT_EXCEEDED,
    ],
}
