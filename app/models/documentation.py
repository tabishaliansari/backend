"""
DocumentGeneration model — session-owned, source-bound, independently copyable.

Design:
  - A DocumentGeneration record is always owned by exactly one ChatSession (session_id FK)
  - It is always bound to exactly one Source (source_id FK)
  - UniqueConstraint(session_id, source_id): one record per session+source pair
  - Multiple sessions can each have their own independent copy for the same source
  - Regenerating in session A only affects session A's record; session B is untouched

Cross-session reuse:
  When session B selects a source that already has a completed doc in another session,
  the backend offers the user:
    - Reuse  → copy the existing record into a NEW row with session_id = session B
    - Fresh  → run the full pipeline again from scratch for session B

  Either way, session B ends up with its own independent DocumentGeneration row.
"""

import enum
from uuid import uuid4
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    ForeignKey, String, Text, Integer, Enum, JSON, UniqueConstraint, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.database import Base


class DocumentGenerationStatus(enum.Enum):
    pending    = "pending"     # Waiting to start
    generating = "generating"  # In progress
    completed  = "completed"   # Successfully generated
    failed     = "failed"      # Generation failed
    cancelled  = "cancelled"   # User cancelled


class DocumentGeneration(Base):
    __tablename__ = "document_generations"

    # ── Primary Key ─────────────────────────────────────────────────────────
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # ── Ownership — which session owns this copy ─────────────────────────────
    session_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Session that owns this documentation copy",
    )

    # ── Source Binding — which repo this was generated from ──────────────────
    source_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="GitHub source this documentation was generated from",
    )

    # ── User Ownership ───────────────────────────────────────────────────────
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User who owns this record",
    )

    # ── Status Tracking ──────────────────────────────────────────────────────
    status: Mapped[DocumentGenerationStatus] = mapped_column(
        Enum(DocumentGenerationStatus),
        default=DocumentGenerationStatus.pending,
        nullable=False,
    )
    progress_percent: Mapped[int] = mapped_column(
        Integer,
        default=0,
        comment="0–100 progress for SSE updates",
    )

    # ── Generated Content ────────────────────────────────────────────────────
    generated_markdown: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Complete generated markdown documentation (max ~200KB)",
    )
    sections_metadata: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
        default=None,
        comment=(
            "Section outline + usage metadata: "
            "{sections: [{title, level, char_start, char_end}], "
            "generated_model, input_tokens, output_tokens, estimated_cost_usd, generation_time_seconds}"
        ),
    )

    # ── Error Handling ───────────────────────────────────────────────────────
    error_message: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Error message if generation failed",
    )

    # ── Configuration (Audit & Reproducibility) ──────────────────────────────
    config: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        comment=(
            "Generation config: {model, style, detail_level, "
            "include_apis, include_examples, include_architecture_diagram, force_regenerate}"
        ),
    )

    # ── Timestamps ───────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(default=func.now(), index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # ── Relationships ────────────────────────────────────────────────────────
    session: Mapped["ChatSession"] = relationship(
        "ChatSession",
        back_populates="documents",
        foreign_keys="[DocumentGeneration.session_id]",
    )
    source: Mapped["Source"] = relationship(
        "Source",
        back_populates="documentations",
        foreign_keys="[DocumentGeneration.source_id]",
    )
    user: Mapped["User"] = relationship(
        "User",
        foreign_keys="[DocumentGeneration.user_id]",
    )

    # ── Constraints ──────────────────────────────────────────────────────────
    __table_args__ = (
        # One doc per session+source pair — multiple sessions can each have their own copy
        UniqueConstraint("session_id", "source_id", name="uq_doc_gen_session_source"),
        # Progress must be in valid range
        CheckConstraint("progress_percent >= 0 AND progress_percent <= 100", name="ck_progress_range"),
    )
