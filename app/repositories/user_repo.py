"""
User repository for database access operations.

Provides reusable query functions for User model using SQLAlchemy ORM.
Handles all user-related CRUD operations while keeping business logic
separated in the service layer.

Functions in this repository:
- Query operations return None if user not found (no exceptions)
- Create/update/delete operations perform db.commit()
- Services are responsible for validation and error handling
"""

from typing import Optional, Union

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserRegister


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """
    Get a user by ID.

    Args:
        db: SQLAlchemy database session
        user_id: The user's ID

    Returns:
        User object if found, None otherwise
    """
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    Get a user by email address.

    Args:
        db: SQLAlchemy database session
        email: The user's email address

    Returns:
        User object if found, None otherwise
    """
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """
    Get a user by username.

    Args:
        db: SQLAlchemy database session
        username: The user's username

    Returns:
        User object if found, None otherwise
    """
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, user_data: Union[UserRegister, dict], hashed_password: str) -> User:
    """
    Create a new user in the database.

    Args:
        db: SQLAlchemy database session
        user_data: User registration data (UserRegister schema or dict)
        hashed_password: Pre-hashed password string

    Returns:
        The created User object with all fields populated

    Note:
        - Password should be hashed BEFORE calling this function
        - This function calls db.commit() and db.refresh()
        - Services should handle duplicate key errors
    """
    if isinstance(user_data, UserRegister):
        new_user = User(
            fullname=user_data.fullname,
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
        )
    else:
        # Handle dict input
        new_user = User(
            fullname=user_data.get("fullname"),
            username=user_data.get("username"),
            email=user_data.get("email"),
            hashed_password=hashed_password,
        )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def update_user(db: Session, user: User, update_data: dict) -> User:
    """
    Update an existing user with new data.

    Args:
        db: SQLAlchemy database session
        user: The User object to update (must be attached to session)
        update_data: Dictionary of fields to update (e.g., {"fullname": "...", "username": "..."})

    Returns:
        The updated User object

    Note:
        - Only updates fields present in update_data
        - This function calls db.commit() and db.refresh()
        - Services should validate update_data before calling
    """
    for field, value in update_data.items():
        if hasattr(user, field) and value is not None:
            setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


def delete_user(db: Session, user: User) -> None:
    """
    Delete a user from the database.

    Args:
        db: SQLAlchemy database session
        user: The User object to delete (must be attached to session)

    Returns:
        None

    Note:
        - This function calls db.commit()
        - User object becomes detached after deletion
    """
    db.delete(user)
    db.commit()
