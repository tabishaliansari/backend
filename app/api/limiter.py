from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

from app.utils.api_error import ApiError
from app.core.error_codes import ErrorCodes
from app.utils import should_include_stack_trace
from app.schemas.response import ApiResponse

limiter = Limiter(key_func=get_remote_address)


async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Handle rate limit exceeded errors.

    Converts RateLimitExceeded exceptions to standardized ApiError responses
    with appropriate HTTP status code and error code.
    """
    error = ApiError(
        statusCode=429,
        message="Too many requests. Please try again later.",
        code=ErrorCodes.TOO_MANY_REQUESTS,
    )

    response = ApiResponse(
        statusCode=error.statusCode,
        success=error.success,
        message=error.message,
        code=error.code,
    )

    return JSONResponse(
        status_code=error.statusCode,
        content=response.model_dump(exclude_none=True),
    )
