from sqlalchemy.orm import Session
from sqlalchemy import text

from app.utils.api_error import ApiError
from app.core.error_codes import ErrorCodes


def get_health():
    """Get basic application health status."""
    return {"status": "Up and Running"}


def check_db_connection(db: Session) -> dict:
    """
    Check database connection status.

    Attempts a simple query to verify database connectivity and returns
    the connection status along with timestamp information.

    Args:
        db: Database session

    Returns:
        dict: Database connection status information

    Raises:
        ApiError: If database connection fails
    """
    try:
        # Execute a simple query to test connection
        result = db.execute(text("SELECT 1"))
        db.commit()

        return {
            "status": "Connected",
            "database": "PostgreSQL",
        }
    except Exception as e:
        raise ApiError(
            statusCode=503,
            message="Database connection failed",
            code=ErrorCodes.DATABASE_CONNECTION_ERROR,
        )