"""Utility functions for error handling and formatting."""

import os
from typing import Any, Dict, Optional


def should_include_stack_trace() -> bool:
    """
    Check if stack traces should be included in error responses.

    Stack traces are included only in development/testing environments,
    not in production to avoid exposing sensitive implementation details.

    Returns:
        bool: True if stack traces should be included, False otherwise
    """
    environment = os.getenv("ENVIRONMENT", "development").lower()
    debug = os.getenv("DEBUG", "false").lower()

    return environment != "production" or debug == "true"


def extract_error_message(error: Exception) -> str:
    """
    Extract a meaningful error message from any exception type.

    Args:
        error: The exception to extract message from

    Returns:
        str: The error message or a generic message if extraction fails
    """
    from app.utils.api_error import ApiError

    if isinstance(error, ApiError):
        return error.message

    if hasattr(error, "detail"):
        return str(error.detail)

    if hasattr(error, "message"):
        return str(error.message)

    # Fallback to string representation
    error_str = str(error)
    return error_str if error_str else "An error occurred"


def serialize_error_response(
    error, include_stack: bool = False
) -> Dict[str, Any]:
    """
    Format an ApiError as a dictionary for JSON response serialization.

    Args:
        error: The ApiError to serialize
        include_stack: Whether to include stack trace in the response

    Returns:
        dict: Formatted error response dictionary
    """
    response = {
        "statusCode": error.statusCode,
        "success": error.success,
        "message": error.message,
    }

    # Add error code if present
    if error.code:
        response["code"] = error.code

    # Add detailed error list if present
    if error.errors:
        response["errors"] = error.errors

    # Add stack trace if requested and available
    if include_stack and error.stack:
        response["stack"] = error.stack

    return response


def format_validation_errors(
    errors: list[Dict[str, Any]],
) -> list[Dict[str, Any]]:
    """
    Format validation errors into a standardized list structure.

    Args:
        errors: List of validation error dictionaries

    Returns:
        list: Formatted error list with field and detail information
    """
    formatted = []
    for error in errors:
        if isinstance(error, dict):
            formatted.append({"field": error.get("loc", ["unknown"])[0], "detail": error.get("msg", "Invalid value")})
    return formatted

