"""
Chat Session repository for database access operations.

Provides reusable query functions for ChatSession model using SQLAlchemy ORM.
Handles all session-related CRUD operations while keeping business logic
separated in the service layer.

Functions in this repository:
- Query operations return None if session not found (no exceptions)
- Create/update/delete operations perform db.commit()
- Services/routes are responsible for validation and error handling
"""

from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage


def get_session_by_id(db: Session, session_id: UUID) -> Optional[ChatSession]:
    """
    Get a chat session by ID.

    Args:
        db: SQLAlchemy database session
        session_id: The session's UUID

    Returns:
        ChatSession object if found, None otherwise
    """
    return db.query(ChatSession).filter(ChatSession.id == session_id).first()


def get_sessions_by_user(db: Session, user_id: UUID, skip: int = 0, limit: int = 10) -> tuple[List[ChatSession], int]:
    """
    Get all sessions for a user with pagination.

    Args:
        db: SQLAlchemy database session
        user_id: The user's UUID
        skip: Number of records to skip
        limit: Maximum records to return

    Returns:
        Tuple of (sessions list, total count)
    """
    query = db.query(ChatSession).filter(ChatSession.user_id == user_id)
    total = query.count()
    sessions = query.order_by(desc(ChatSession.created_at)).offset(skip).limit(limit).all()
    return sessions, total


def create_session(db: Session, user_id: UUID, title: str = "Untitled") -> ChatSession:
    """
    Create a new chat session.

    Args:
        db: SQLAlchemy database session
        user_id: The user's UUID
        title: Session title (defaults to "Untitled")

    Returns:
        The created ChatSession object

    Note:
        This function calls db.commit() and db.refresh()
    """
    session = ChatSession(user_id=user_id, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def update_session_title(db: Session, session_id: UUID, title: str) -> Optional[ChatSession]:
    """
    Update a session's title.

    Args:
        db: SQLAlchemy database session
        session_id: The session's UUID
        title: New title

    Returns:
        Updated ChatSession object if found, None otherwise
    """
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        return None
    
    session.title = title
    db.commit()
    db.refresh(session)
    return session


def delete_session(db: Session, session_id: UUID) -> bool:
    """
    Delete a session (cascade deletes all messages).

    Args:
        db: SQLAlchemy database session
        session_id: The session's UUID

    Returns:
        True if session was deleted, False if not found
    """
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        return False
    
    db.delete(session)
    db.commit()
    return True


def get_message_count(db: Session, session_id: UUID) -> int:
    """
    Get the number of messages in a session.

    Args:
        session_id: Session UUID
        db: SQLAlchemy database session

    Returns:
        Total message count for the session
    """
    return db.query(func.count(ChatMessage.id)).filter(
        ChatMessage.chat_id == session_id
    ).scalar() or 0
