import secrets
from fastapi import APIRouter, Request, Response
from fastapi.params import Depends
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from urllib.parse import urlencode

from app.db.database import get_db
from app.schemas.user import UserRegister, UserResponse, UserLogin, EmailRequest, RefreshTokenResponse, EmailVerificationStatus, ForgotPasswordRequest, PasswordResetRequest
from app.schemas.response import ApiResponse
from app.services.auth_service import register_user, login_user, logout_user, verify_email, resend_verification_email, refresh_access_token, forgot_password_request, reset_password
from app.services.github_oauth_service import handle_github_oauth, create_github_oauth_tokens
from app.models.user import User
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.error_codes import ErrorCodes
from app.utils.api_error import ApiError
from ..limiter import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=ApiResponse)
@limiter.limit("1/second")
async def register(
    request: Request,
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """
    Register a new user with email and password.

    Validates unique username and email, hashes password, creates user account,
    generates email verification token, and sends verification email to user.
    User must verify email before logging in.

    Flow:
    1. Validate all fields are present
    2. Check username is unique
    3. Check email is unique
    4. Hash password
    5. Create user
    6. Generate temporary email verification token
    7. Save token to database
    8. Send verification email with verification link
    9. Return user data in response

    Args:
        request: FastAPI request object (required for rate limiting)
        user_data: Registration data (fullname, email, username, password)
        db: Database session

    Returns:
        ApiResponse with:
        - User data in response body (without sensitive fields)
        - Success message and 201 Created status code
        - Instruction to verify email

    Raises:
        ApiError(400): If username or email already exists
        ApiError(400): If required fields are missing
    """
    # Register user and generate verification email
    user = await register_user(db, user_data)

    # Convert User model to UserResponse schema (validates and serializes)
    user_response = UserResponse.model_validate(user)

    # Return ApiResponse with UserResponse data
    return ApiResponse(
        statusCode=201,
        success=True,
        message="User registered successfully. Please verify your email now.",
        data=user_response,
    )


@router.post("/login", response_model=ApiResponse)
@limiter.limit("1/second")
def login(
    request: Request,
    login_data: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Authenticate user and return JWT tokens via HTTP-only cookies.

    Validates email and password, then creates access and refresh tokens.
    Tokens are set as HTTP-only secure cookies to prevent XSS attacks.

    Flow:
    1. Validate email is registered in database
    2. Check email is verified
    3. Verify password matches hashed password
    4. Generate access token (15 minutes, for API requests)
    5. Generate refresh token (7 days, for token refresh)
    6. Store refresh token in database
    7. Set tokens as HTTP-only cookies
    8. Return user data in response body

    Args:
        request: FastAPI request object (required for rate limiting)
        login_data: Login credentials (email, password)
        response: FastAPI Response object (injected for cookie setting)
        db: Database session

    Returns:
        ApiResponse with:
        - accessToken and refreshToken set as HTTP-only cookies
        - User data in response body (without sensitive fields)
        - Success message

    Raises:
        ApiError(401): If email not found or password invalid
        ApiError(400): If email not verified (USER_NOT_VERIFIED)
    """
    # Get tokens and user from service
    access_token, refresh_token, user = login_user(db, login_data)

    # Set HTTP-only secure cookies for tokens (Express pattern)
    # accessToken: Short-lived (1 hour), used for API authentication
    response.set_cookie(
        key="accessToken",
        value=access_token,
        httponly=True,  # Prevent JavaScript access (XSS protection)
        secure=True,    # Send only over HTTPS
        samesite="lax", # CSRF protection
        max_age=3600,   # 1 hour (3600 seconds)
    )

    # refreshToken: Long-lived (7 days), used to obtain new access tokens
    response.set_cookie(
        key="refreshToken",
        value=refresh_token,
        httponly=True,  # Prevent JavaScript access
        secure=True,    # Send only over HTTPS
        samesite="lax", # CSRF protection
        max_age=604800, # 7 days (604800 seconds)
    )

    # Convert User model to UserResponse schema (validates and serializes)
    user_response = UserResponse.model_validate(user)

    # Return ApiResponse with UserResponse data
    return ApiResponse(
        statusCode=200,
        success=True,
        message="Login successful",
        data=user_response,
    )


@router.post("/logout", response_model=ApiResponse)
@limiter.limit("1/second")
def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Logout authenticated user and revoke refresh token.

    Only accessible to authenticated users. Clears refresh token from database
    and removes HTTP-only cookies to prevent further token reuse.

    This endpoint requires valid authentication via the get_current_user dependency.
    If the user is not authenticated, a 401 error is returned automatically.

    Flow:
    1. Validate user is authenticated (via get_current_user dependency)
    2. Clear refresh token from database (invalidates future refresh attempts)
    3. Clear both accessToken and refreshToken cookies
    4. Return success response

    Args:
        request: FastAPI request object (required for rate limiting)
        response: FastAPI Response object (injected for cookie clearing)
        current_user: Authenticated user (from get_current_user dependency)
        db: Database session

    Returns:
        ApiResponse with 200 status and success message

    Raises:
        ApiError(401): If not authenticated (automatic from get_current_user dependency)
    """
    # Clear refresh token from database (invalidates all future refresh attempts)
    logout_user(db, current_user)

    # Clear both cookies
    response.delete_cookie(key="accessToken", httponly=True, secure=True, samesite="lax")
    response.delete_cookie(key="refreshToken", httponly=True, secure=True, samesite="lax")

    return ApiResponse(
        statusCode=200,
        success=True,
        message="Logged out successfully"
    )


@router.get("/verify-email/{token}", response_model=ApiResponse)
@limiter.limit("1/second")
def verify_email_route(
    request: Request,
    token: str,
    db: Session = Depends(get_db),
):
    """
    Verify user email using token sent in registration email.

    The email verification link is sent to the user's email during registration:
    /api/auth/verify-email/{token}

    User clicks the link or the frontend calls this endpoint with the verification token.
    The endpoint validates the token hash against the database, marks the user's email
    as verified if valid, and clears the temporary verification token.

    Token validation flow:
    1. Hash the provided token using SHA256
    2. Query database for user with matching hashed token and non-expired token
    3. Determine error type if token not found (expired vs invalid)
    4. Check if user email already verified
    5. Set is_email_verified = True
    6. Clear email verification token fields
    7. Return verified user

    Args:
        request: FastAPI request object (required for rate limiting)
        token: Verification token from URL path (unhashed)
        db: Database session

    Returns:
        ApiResponse with:
        - Verified user data in response body
        - Success message and 200 status code

    Raises:
        ApiError(400): TOKEN_MISSING if token is empty
        ApiError(400): TOKEN_INVALID if token hash doesn't match any user
        ApiError(400): TOKEN_EXPIRED if token exists but is expired
        ApiError(400): USER_ALREADY_VERIFIED if user's email already verified
    """
    # Verify token and get user
    user = verify_email(db, token)

    # Convert User model to UserResponse schema (validates and serializes)
    user_response = UserResponse.model_validate(user)

    # Return ApiResponse with verified user data
    return ApiResponse(
        statusCode=200,
        success=True,
        message="Email verified successfully. You can now login.",
        data=user_response,
    )


@router.post("/resend-verification-email", response_model=ApiResponse)
@limiter.limit("1/minute")
async def resend_verification_email_route(
    request: Request,
    email_data: EmailRequest,
    db: Session = Depends(get_db),
):
    """
    Resend verification email to user email address.

    Users who didn't receive the original verification email or whose token expired
    can use this endpoint to request a new verification email with a fresh token.
    The new email will contain an updated verification link with a new token.

    Rate limited to 1 request per minute per IP to prevent abuse.

    Flow:
    1. Validate user exists with provided email
    2. If email already verified: Return 200 with verification status (no email sent)
    3. If email not verified: Generate new token, send email, return 201
    4. Return success response

    Args:
        request: FastAPI request object (required for rate limiting)
        email_data: Request body with email field
        db: Database session

    Returns:
        - If already verified: ApiResponse 200 with {isEmailVerified: true}
        - If email sent: ApiResponse 201 with user data

    Raises:
        ApiError(400): USER_NOT_FOUND if email doesn't exist in system
        ApiError(429): If rate limit exceeded (max 1 per minute)
    """
    # Resend verification email and get user
    user = await resend_verification_email(db, email_data.email)

    # If email already verified, return 200 with verification status
    if user.is_email_verified:
        return ApiResponse(
            statusCode=200,
            success=True,
            message="Your email is already verified. Please log in",
            data=EmailVerificationStatus(isEmailVerified=True),
        )

    # If email not verified, verification was sent, return 201 with user data
    user_response = UserResponse.model_validate(user)

    return ApiResponse(
        statusCode=201,
        success=True,
        message="Verification email sent successfully, check your registered email inbox",
        data=user_response,
    )


@router.get("/refreshAccessToken", response_model=ApiResponse)
@limiter.limit("5/minute")
def refresh_access_token_route(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Refresh access and refresh tokens using existing refresh token.

    Endpoint for renewing access tokens when they expire. Users provide their
    refresh token via HTTP-only cookie, and this endpoint generates new
    access and refresh tokens to extend their session.

    This is a STATEFUL token refresh (stored in DB) unlike OAuth-style stateless
    refresh. Allows immediate revocation by setting user.refresh_token = None.

    Token rotation flow (mirrors Express refreshAccessToken controller):
    1. Extract refreshToken from cookies
    2. Call refresh_access_token service to validate and generate new tokens
    3. Service validates token JWT and checks against stored value in DB
    4. Service generates new access and refresh tokens
    5. Service saves new refresh token to database
    6. Set both new tokens as HTTP-only cookies (same flags as login)
    7. Return 201 with new tokens in response body

    Args:
        request: FastAPI request object (for rate limiting, extracting cookies)
        response: FastAPI Response object (for setting cookies)
        db: Database session

    Returns:
        ApiResponse 201 with:
        - data: {newAccessToken: str, newRefreshToken: str}
        - message: "Tokens refreshed"
        - Both tokens also set as HTTP-only cookies

    Raises:
        ApiError(401): REFRESH_TOKEN_MISSING if cookie missing
        ApiError(403): REFRESH_TOKEN_INVALID if JWT invalid/expired
        ApiError(404): USER_NOT_FOUND if user doesn't exist
        ApiError(401): REFRESH_TOKEN_EXPIRED if token revoked/doesn't match stored
        ApiError(429): If rate limited (5 per minute)
    """
    # Step 1: Extract refresh token from cookies
    refresh_token = request.cookies.get("refreshToken")

    # Step 2: Call service to validate and generate new tokens
    access_token, new_refresh_token, user = refresh_access_token(db, refresh_token)

    # Step 3: Set new access token as HTTP-only cookie
    response.set_cookie(
        key="accessToken",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=3600,  # 1 hour (matches login cookie)
    )

    # Step 4: Set new refresh token as HTTP-only cookie
    response.set_cookie(
        key="refreshToken",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=604800,  # 7 days (matches login cookie)
    )

    # Step 5: Return response with new tokens in body
    return ApiResponse(
        statusCode=201,
        success=True,
        message="Tokens refreshed",
        data=RefreshTokenResponse(
            newAccessToken=access_token,
            newRefreshToken=new_refresh_token,
        ),
    )


@router.post("/forgotPassword", response_model=ApiResponse)
@limiter.limit("1/minute")
async def forgot_password_route(
    request: Request,
    email_data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Request password reset by sending email with reset token.

    Users who forgot their password can use this endpoint to request a password reset.
    An email will be sent with a link containing a temporary reset token.

    The user has 20 minutes to use the reset token before it expires.

    Args:
        request: FastAPI request object (required for rate limiting)
        email_data: Request body with email field
        db: Database session

    Returns:
        ApiResponse 201 with:
        - data: UserResponse (user data)
        - message: "Reset password email sent. Please check your inbox."

    Raises:
        ApiError(401): USER_NOT_FOUND if email doesn't exist
        ApiError(429): If rate limit exceeded (max 1 per minute)
    """
    # Request password reset and get user
    user = await forgot_password_request(db, email_data.email)

    # Convert User model to UserResponse schema (validates and serializes)
    user_response = UserResponse.model_validate(user)

    return ApiResponse(
        statusCode=201,
        success=True,
        message="Reset password email sent. Please check your inbox.",
        data=user_response,
    )


@router.post("/resetPassword/{token}", response_model=ApiResponse)
@limiter.limit("5/minute")
def reset_password_route(
    request: Request,
    token: str,
    password_data: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """
    Reset user password using verification token.

    Users receive a password reset token via email. They can use this endpoint
    along with the token to set a new password. The old password is immediately
    invalidated.

    The password reset token is valid for 20 minutes.

    Flow:
    1. Validate password reset token
    2. Validate new passwords match
    3. Hash new password and update user
    4. Clear token fields from database
    5. Return success response

    Args:
        request: FastAPI request object (required for rate limiting)
        token: Password reset token from email link (URL path parameter)
        password_data: Request body with password and confPassword fields
        db: Database session

    Returns:
        ApiResponse 201 with:
        - data: UserResponse (updated user data)
        - message: "Password changed successfully"

    Raises:
        ApiError(400): TOKEN_MISSING if token is empty
        ApiError(400): TOKEN_INVALID if token hash doesn't match any user
        ApiError(400): TOKEN_EXPIRED if token exists but is expired
        ApiError(400): PASSWORDS_DO_NOT_MATCH if password != confPassword
        ApiError(429): If rate limit exceeded
    """
    # Validate passwords match
    if password_data.password != password_data.confPassword:
        raise ApiError(
            statusCode=400,
            message="Passwords do not match",
            code=ErrorCodes.PASSWORDS_DO_NOT_MATCH,
        )

    # Reset password and get updated user
    user = reset_password(db, token, password_data.password)

    # Convert User model to UserResponse schema (validates and serializes)
    user_response = UserResponse.model_validate(user)

    return ApiResponse(
        statusCode=201,
        success=True,
        message="Password changed successfully",
        data=user_response,
    )


@router.get("/github")
@limiter.limit("1/minute")
async def github_oauth_initiate(
    request: Request,
    redirect_to_provider: bool = True,
    db: Session = Depends(get_db),
):
    """
    Initiate GitHub OAuth flow.

    Checks if user is already logged in (has valid accessToken cookie).
    If logged in, they cannot initiate a new OAuth login.
    Generates state token for CSRF protection and redirects to GitHub.

    Flow:
    1. Check if user already logged in via accessToken cookie
    2. If logged in → error 401 (cannot initiate while authenticated)
    3. Generate random state using secrets.token_urlsafe
    4. Store state in HTTP-only cookie with 10 minute expiry
    5. Generate GitHub authorization URL with state
    6. Redirect to GitHub OAuth

    Args:
        request: FastAPI request object (for cookie access)
        db: Database session (for validating token if present)

    Returns:
        If redirect_to_provider=True:
            RedirectResponse to GitHub OAuth authorization endpoint
        If redirect_to_provider=False:
            ApiResponse 200 with authorizationUrl while setting oauth_state cookie

    Raises:
        ApiError(401): If user already logged in (has valid accessToken)
    """
    # Check if user already logged in
    access_token = request.cookies.get("accessToken")
    if access_token:
        raise ApiError(
            statusCode=401,
            message="Already logged in. Please logout first to use GitHub OAuth.",
            code=ErrorCodes.UNAUTHORIZED,
        )

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)

    import os

    print("FROM SETTINGS:", settings.GITHUB_CLIENT_ID)
    print("FROM OS ENV:", os.getenv("GITHUB_CLIENT_ID"))

    # Construct GitHub OAuth URL
    github_auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={settings.GITHUB_CLIENT_ID}&"
        f"redirect_uri={settings.GITHUB_REDIRECT_URI}&"
        f"scope=user:email&"
        f"state={state}"
    )

    # If frontend requests non-redirect mode, return auth URL as JSON and let frontend navigate.
    if not redirect_to_provider:
        payload = ApiResponse(
            statusCode=200,
            success=True,
            message="GitHub OAuth URL generated",
            data={"authorizationUrl": github_auth_url},
        ).model_dump(exclude_none=True)
        response = JSONResponse(content=payload, status_code=200)
        response.set_cookie(
            key="oauth_state",
            value=state,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=600,
        )
        return response

    # Create redirect response
    response = RedirectResponse(url=github_auth_url)

    # Store state in HTTP-only cookie (10 minute expiry)
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=600,  # 10 minutes
    )

    return response


@router.get("/github/callback")
# @limiter.limit("1/minute")
async def github_oauth_callback(
    request: Request,
    code: str = None,
    state: str = None,
    db: Session = Depends(get_db),
):
    """
    Handle GitHub OAuth callback.

    GitHub redirects here after user authorizes. This endpoint:
    1. Validates state matches (CSRF protection)
    2. Exchanges code for GitHub access token
    3. Fetches GitHub user data
    4. Resolves email (handles private emails)
    5. Handles 3 cases: existing GitHub user, existing local user (error), new user
    6. Generates JWT tokens and sets cookies
    7. Redirects to frontend dashboard with cookies or to login with error on failure

    Args:
        request: FastAPI request object (for cookie access)
        code: Authorization code from GitHub (query param)
        state: State token from GitHub (query param)
        db: Database session

    Returns:
        RedirectResponse to frontend dashboard with cookies on success
        RedirectResponse to /auth?mode=login&error=ERROR_CODE on failure

    Raises:
        ApiError(429): If rate limited
    """
    try:
        # Step 1: Validate code and state parameters
        if not code or not state:
            raise ApiError(
                statusCode=400,
                message="Missing code or state parameter",
                code=ErrorCodes.BAD_REQUEST,
            )

        # Step 2: Validate state matches (CSRF protection)
        oauth_state = request.cookies.get("oauth_state")
        if not oauth_state or oauth_state != state:
            raise ApiError(
                statusCode=401,
                message="State mismatch. Possible CSRF attack.",
                code=ErrorCodes.INVALID_OAUTH_STATE,
            )

        # Step 3: Execute GitHub OAuth flow (exchange code, fetch user, handle creation/login)
        user = await handle_github_oauth(db, code)

        # Step 4: Generate tokens
        access_token, refresh_token = create_github_oauth_tokens(user)
        db.commit()  # Save refresh token to database

        # Step 5: Create redirect response to frontend dashboard
        redirect_response = RedirectResponse(url=f"{settings.CLIENT_URL}/dashboard", status_code=302)

        # Step 6: Set tokens as HTTP-only cookies on the redirect response
        redirect_response.set_cookie(
            key="accessToken",
            value=access_token,
            httponly=True,
            secure=False, # In production, ensure this is True to only send over HTTPS
            samesite="Lax", # In production, set to 'None' if frontend is on different domain and ensure secure=True)
            max_age=3600,  # 1 hour
        )

        redirect_response.set_cookie(
            key="refreshToken",
            value=refresh_token,
            httponly=True,
            secure=False, # In production, ensure this is True to only send over HTTPS
            samesite="Lax", # In production, set to 'None' if frontend is on different domain and ensure secure=True)
            max_age=604800,  # 7 days
        )

        # Step 7: Delete oauth_state cookie on the redirect response
        redirect_response.delete_cookie(key="oauth_state", httponly=True, secure=True, samesite="none")

        return redirect_response

    except ApiError as e:
        # On error, redirect to login with error code
        error_code = e.code if hasattr(e, 'code') and e.code else "OAUTH_FAILED"
        redirect_url = f"{settings.CLIENT_URL}/auth?mode=login&error={error_code}"
        return RedirectResponse(url=redirect_url, status_code=302)
