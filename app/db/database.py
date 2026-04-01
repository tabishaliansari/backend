"""
Database configuration and session management for SQLAlchemy ORM.

Sets up PostgreSQL connection, ORM base class, and FastAPI dependency
for managing database sessions throughout request lifecycle.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session

from app.core.config import settings

# Database URL and engine setup
DATABASE_URL = settings.DATABASE_URL

# SQLAlchemy engine for PostgreSQL
# echo=True logs all SQL statements (set to False in production)
engine = create_engine(
    DATABASE_URL,
    echo=settings.DEBUG,  # Only echo SQL in debug mode
    pool_pre_ping=True,   # Verify connections before using them
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy ORM models.

    All model classes should inherit from this to ensure proper
    table mapping and ORM functionality.
    """

    pass


def get_db() -> Session:
    """
    FastAPI dependency for database session management.

    Yields a database session for the duration of a request.
    Ensures proper cleanup (close) after request completion,
    regardless of success or failure.

    This dependency should be injected into route handlers:
        @router.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()

    Yields:
        Session: SQLAlchemy ORM session for database operations

    Note:
        - Session is automatically closed after yield (in finally block)
        - Exceptions during request are NOT caught here (handled by error handlers)
        - Database transaction is NOT committed by this function
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()