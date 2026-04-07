from uuid import uuid4
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Boolean, DateTime
from sqlalchemy.sql import func
from datetime import datetime
from sqlalchemy import JSON
from app.db.database import Base
from sqlalchemy import Enum
import enum

class UserRole(enum.Enum):
    admin = "admin"
    user = "user"


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)

    google_id: Mapped[str | None] = mapped_column(unique=True, nullable=True)
    github_id: Mapped[str | None] = mapped_column(unique=True, nullable=True)
    auth_provider: Mapped[str] = mapped_column(default="local")

    fullname: Mapped[str | None] = mapped_column(nullable=True)

    username: Mapped[str | None] = mapped_column(unique=True, index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)

    hashed_password: Mapped[str | None] = mapped_column(nullable=True)

    avatar: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "url": "https://placehold.co/600x400",
            "public_id": ""
        }
    )
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user)
    is_email_verified: Mapped[bool] = mapped_column(default=False)

    forgot_password_token: Mapped[str | None] = mapped_column(nullable=True)
    forgot_password_token_expiry: Mapped[datetime | None] = mapped_column(nullable=True)

    refresh_token: Mapped[str | None] = mapped_column(nullable=True)

    email_verification_token: Mapped[str | None] = mapped_column(nullable=True)
    email_verification_token_expiry: Mapped[datetime | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())