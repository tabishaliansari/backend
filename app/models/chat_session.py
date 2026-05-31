from uuid import uuid4
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, String, Text, Boolean, Float, Integer
from sqlalchemy.sql import func
from datetime import datetime
from typing import List, Optional
from app.db.database import Base
from app.models.associations import chat_session_sources

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

    # ── Context control plane fields ────────────────────────────────────
    # Rolling summary of compacted older messages (infrastructure memory)
    rolling_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)

    # Compact boundary: messages with id <= this have been summarized
    last_compacted_message_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_messages.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
        default=None,
        info={"context_bookmark": True}  # signals: not a traversable relationship
    )

    # Compaction lifecycle
    needs_compaction: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    last_compacted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, default=None)

    # Context window configuration
    recent_window_size: Mapped[int] = mapped_column(Integer, default=20, server_default="20")
    estimated_token_usage: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    compaction_threshold: Mapped[float] = mapped_column(Float, default=0.85, server_default="0.85")

    # ── Relationships ───────────────────────────────────────────────────
    messages: Mapped[List["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        foreign_keys="[ChatMessage.chat_id]",
    )

    sources: Mapped[List["Source"]] = relationship(
        "Source",
        secondary=chat_session_sources,
        back_populates="sessions",
    )

    documents: Mapped[List["DocumentGeneration"]] = relationship(
        "DocumentGeneration",
        back_populates="session",
        cascade="all, delete-orphan",
        foreign_keys="[DocumentGeneration.session_id]",
    )

