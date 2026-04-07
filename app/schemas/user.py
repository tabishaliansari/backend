from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from uuid import UUID


class UserRegister(BaseModel):
    """
    User registration request validation.

    Validates: fullname, email, username, password with constraints.
    """
    fullname: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="User's full name (letters, spaces, apostrophes only)"
    )
    email: EmailStr = Field(..., description="Valid email address")
    username: str = Field(
        ...,
        min_length=3,
        max_length=13,
        pattern=r'^[a-zA-Z0-9_-]+$',
        description="Username (3-13 chars, alphanumeric with underscore/hyphen)"
    )
    password: str = Field(
        ...,
        min_length=6,
        max_length=100,
        description="Password (minimum 6 characters)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "fullname": "John Doe",
                "email": "john@example.com",
                "username": "johndoe",
                "password": "securepass123"
            }
        }


class UserLogin(BaseModel):
    """
    User login request validation.

    Validates: email and password.
    """
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(
        ...,
        min_length=6,
        description="User password (minimum 6 characters)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "email": "john@example.com",
                "password": "securepass123"
            }
        }


class UserUpdate(BaseModel):
    """
    User update request validation.

    Validates: fullname and username for profile updates.
    """
    fullname: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-zA-Z\s.'-]+$",
        description="User's full name (letters, spaces, hyphens, apostrophes only)"
    )
    username: str = Field(
        ...,
        min_length=3,
        max_length=13,
        pattern=r'^[a-zA-Z0-9]+$',
        description="Username (3-13 chars, alphanumeric only)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "fullname": "Jane Doe",
                "username": "janedoe"
            }
        }


class VerifyEmailToken(BaseModel):
    """
    Email verification token validation.

    Used for email verification endpoints via URL parameter.
    """
    token: str = Field(
        ...,
        min_length=40,
        max_length=80,
        description="Email verification token (40-80 characters)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
            }
        }


class UserResponse(BaseModel):
    """
    User data response model.

    Returned after successful registration, login, or profile fetch.
    """
    id: UUID
    fullname: str
    username: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "fullname": "John Doe",
                "username": "johndoe",
                "email": "john@example.com",
                "role": "user"
            }
        }


class TokenResponse(BaseModel):
    """
    Authentication token response model.

    Returned after successful login with access token.
    """
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type (always 'bearer')")

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer"
            }
        }


class EmailRequest(BaseModel):
    """
    Email request validation.

    Used for email-based operations like resending verification emails.
    """
    email: EmailStr = Field(..., description="User email address")

    model_config = ConfigDict(json_schema_extra={"example": {"email": "user@example.com"}})


class RefreshTokenResponse(BaseModel):
    """
    Refresh token response model.

    Returned after successful token refresh with new access and refresh tokens.
    """
    newAccessToken: str = Field(..., description="New JWT access token")
    newRefreshToken: str = Field(..., description="New JWT refresh token")

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "newAccessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "newRefreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        }
    })


class EmailVerificationStatus(BaseModel):
    """
    Email verification status response model.

    Returned when user tries to resend verification but email is already verified.
    """
    isEmailVerified: bool = Field(..., description="Whether the email is verified")

    model_config = ConfigDict(json_schema_extra={"example": {"isEmailVerified": True}})


class ForgotPasswordRequest(BaseModel):
    """
    Forgot password request validation.

    Used for password reset request endpoint - just needs email.
    """
    email: EmailStr = Field(..., description="User email address")

    model_config = ConfigDict(json_schema_extra={"example": {"email": "user@example.com"}})


class PasswordResetRequest(BaseModel):
    """
    Password reset request validation.

    Used for resetting password with token - requires new password and confirmation.
    """
    password: str = Field(
        ...,
        min_length=6,
        max_length=100,
        description="New password (minimum 6 characters)"
    )
    confPassword: str = Field(
        ...,
        min_length=6,
        max_length=100,
        description="Password confirmation (must match password)"
    )

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "password": "newpassword123",
            "confPassword": "newpassword123"
        }
    })


class UpdateProfileRequest(BaseModel):
    """
    Update user profile request validation.

    Used for updating username and fullname fields.
    """
    fullname: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="User's full name (letters, spaces, apostrophes only)"
    )
    username: str = Field(
        ...,
        min_length=3,
        max_length=13,
        pattern=r'^[a-zA-Z0-9_-]+$',
        description="Username (3-13 chars, alphanumeric with underscore/hyphen)"
    )

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "fullname": "John Updated",
            "username": "johnupdated"
        }
    })