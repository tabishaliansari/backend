from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Optional, List


class ApiResponse(BaseModel):
    """
    Standard API response wrapper for FastAPI endpoints.

    Provides a consistent response structure with status code, success flag,
    message, optional data payload, and error-specific fields.

    For successful responses, includes statusCode, success, message, and optional data.
    For error responses, includes statusCode, success, message, code, optional errors list,
    and optional stack trace (development only).

    Example (Success):
        ApiResponse(statusCode=200, success=True, message="Success", data={"id": 1})

    Example (Error):
        ApiResponse(
            statusCode=400,
            success=False,
            message="Username already exists",
            code="USER_ALREADY_EXISTS",
            errors=[{"field": "username", "detail": "already taken"}]
        )
    """
    statusCode: int = Field(description="HTTP status code")
    success: bool = Field(default=True, description="Whether the request was successful")
    message: str = Field(default="Success", description="Human-readable response message")
    data: Optional[Any] = Field(default=None, description="Response payload for successful requests")
    code: Optional[str] = Field(default=None, description="Machine-readable error code (error responses only)")
    errors: Optional[List[Any]] = Field(default=None, description="Detailed error list for validation errors")
    stack: Optional[str] = Field(default=None, description="Stack trace for debugging (development only)")

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "name": "Success Response",
                    "value": {
                        "statusCode": 200,
                        "success": True,
                        "message": "Operation completed successfully",
                        "data": {"id": 1, "name": "example"}
                    }
                },
                {
                    "name": "Error Response",
                    "value": {
                        "statusCode": 400,
                        "success": False,
                        "message": "Username already exists",
                        "code": "USER_ALREADY_EXISTS"
                    }
                }
            ]
        },
        exclude_none=True  # Omit None fields from JSON output
    )

