"""Utility functions for error handling and formatting."""

import os
from typing import Any, Dict


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
            formatted.append(
                {
                    "field": ".".join(map(str, error.get("loc", []))),
                    "detail": error.get("msg", "Invalid value"),
                }
            )
    return formatted

