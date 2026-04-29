from uuid import uuid4
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, String
from sqlalchemy.sql import func
from datetime import datetime
from typing import List
from app.db.database import Base

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="chat_sessions"
    )

    # Bidirectional relationships
    messages: Mapped[List["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    sources: Mapped[List["Source"]] = relationship(
        "Source",
        cascade="all, delete-orphan"
    )
