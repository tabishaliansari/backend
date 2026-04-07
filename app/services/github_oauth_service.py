"""
GitHub OAuth service layer.

Handles GitHub OAuth flow:
1. Exchange code for access token
2. Fetch user data from GitHub API
3. Resolve user email (handle cases where email is private)
4. Handle user creation vs existing user login
5. Generate JWT tokens
"""

import httpx
from uuid import uuid4
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.core.error_codes import ErrorCodes
from app.utils.api_error import ApiError
from app.models.user import User
from app.repositories.user_repo import (
    get_user_by_email,
    get_user_by_username,
    update_user,
)


async def exchange_code_for_token(code: str) -> str:
    """
    Exchange GitHub authorization code for access token.

    Args:
        code: Authorization code from GitHub callback

    Returns:
        GitHub access token

    Raises:
        ApiError(400): If access_token not returned from GitHub
        ApiError(500): If HTTP request fails
    """
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )

        token_data = token_res.json()
        access_token = token_data.get("access_token")

        if not access_token:
            error_description = token_data.get("error_description", "Unknown error")
            raise ApiError(
                statusCode=400,
                message=f"Failed to exchange code for token: {error_description}",
                code=ErrorCodes.OAUTH_INVALID_CODE,
            )

        return access_token


async def fetch_github_user(access_token: str) -> dict:
    """
    Fetch GitHub user data using access token.

    Args:
        access_token: GitHub access token

    Returns:
        Dict with keys: id, login, email, name, avatar_url

    Raises:
        ApiError(401): If access token is invalid
        ApiError(500): If HTTP request fails
    """
    async with httpx.AsyncClient() as client:
        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if user_res.status_code != 200:
            raise ApiError(
                statusCode=401,
                message="Failed to fetch GitHub user data",
                code=ErrorCodes.OAUTH_PROVIDER_ERROR,
            )

        user_data = user_res.json()

        return {
            "id": user_data.get("id"),
            "login": user_data.get("login"),
            "email": user_data.get("email"),
            "name": user_data.get("name"),
            "avatar_url": user_data.get("avatar_url"),
        }


async def resolve_user_email(access_token: str, primary_email: str | None) -> str:
    """
    Resolve user email - fetch from emails endpoint if primary is None.

    GitHub allows users to set email as private. This function:
    1. Returns primary_email if available
    2. Otherwise fetches all user emails and finds the primary verified email
    3. Falls back to {login}@github.com if no verified email found

    Args:
        access_token: GitHub access token
        primary_email: Email from main user endpoint (may be None if private)

    Returns:
        Email address to use (guaranteed to be a string)

    Raises:
        ApiError(500): If HTTP request fails
    """
    # If primary email is available, use it
    if primary_email:
        return primary_email

    # Otherwise fetch emails endpoint
    async with httpx.AsyncClient() as client:
        emails_res = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if emails_res.status_code != 200:
            # Fall back to github.com email
            return None  # Will be handled by caller

        emails_data = emails_res.json()

        # Find primary verified email
        primary = next(
            (e for e in emails_data if e.get("primary") and e.get("verified")),
            None,
        )

        if primary:
            return primary["email"]

        # Fall back to first verified email
        verified = next(
            (e for e in emails_data if e.get("verified")),
            None,
        )

        if verified:
            return verified["email"]

        return None  # Will be handled by caller


async def handle_github_oauth(db: Session, code: str) -> User:
    """
    Complete GitHub OAuth flow and handle user creation/login.

    Flow:
    1. Exchange code for GitHub access token
    2. Fetch GitHub user data
    3. Resolve user email (handle private emails)
    4. Query database for existing user by email
    5. Handle 3 cases:
       - Case 1: Existing GitHub user → normal login (no change needed)
       - Case 2: Existing local user → error (account exists with email/password)
       - Case 3: New user → create account with GitHub provider

    Args:
        db: Database session
        code: Authorization code from GitHub callback

    Returns:
        User object (either existing or newly created)

    Raises:
        ApiError: Various OAuth errors or account conflict errors
    """
    # Step 1: Exchange code for token
    access_token = await exchange_code_for_token(code)

    # Step 2: Fetch GitHub user data
    github_user = await fetch_github_user(access_token)

    github_id = github_user["id"]
    login = github_user["login"]
    name = github_user["name"]
    avatar_url = github_user["avatar_url"]
    email = github_user["email"]

    # Step 3: Resolve email (handle private emails)
    if not email:
        email = await resolve_user_email(access_token, email)

    if not email:
        # Fall back to generated GitHub email
        email = f"{login}@github.com"

    # Step 4: Query for existing user by email
    user = get_user_by_email(db, email)

    if user:
        # Case 1: Existing GitHub user → normal login
        if user.github_id:
            return user

        # Case 2: Existing local user → error (must connect manually)
        else:
            raise ApiError(
                statusCode=400,
                message="Account exists with email/password. Please login with your credentials or connect GitHub from profile settings.",
                code=ErrorCodes.OAUTH_ACCOUNT_EXISTS,
            )

    # Case 3: New user → create account
    else:
        # Check if username is available or generate unique one
        username = login
        existing_username = get_user_by_username(db, username)

        if existing_username:
            # Generate unique username with UUID suffix
            username = f"{login}-{uuid4().hex[:5]}"

        # Create new user with GitHub auth
        new_user = User(
            email=email,
            username=username,
            fullname=name or login,
            github_id=str(github_id),
            auth_provider="github",
            is_email_verified=True,  # GitHub already verified the email
            avatar={
                "url": avatar_url or "https://placehold.co/600x400",
                "public_id": ""
            },
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return new_user


def create_github_oauth_tokens(user: User) -> tuple[str, str]:
    """
    Generate access and refresh tokens for authenticated GitHub user.

    Args:
        user: Authenticated user object

    Returns:
        Tuple of (access_token: str, refresh_token: str)
    """
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "username": user.username}
    )

    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "email": user.email, "username": user.username}
    )

    # Store refresh token in database
    user.refresh_token = refresh_token
    # Note: caller must commit the session
    # This follows the same pattern as login_user service

    return (access_token, refresh_token)
