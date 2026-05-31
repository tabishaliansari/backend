"""
Many-to-many association between ChatSession and Source.

Uses a mapped association class (not a plain Table) so that ORM-level
events can be attached if needed in future.

A mapped class and a plain Table produce the *exact same* database table
(same name, columns, constraints). No migration is needed for this change.
"""

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ChatSessionSource(Base):
    __tablename__ = "chat_session_sources"

    session_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    source_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sources.id", ondelete="CASCADE"),
        primary_key=True,
    )


# Backward-compatible alias — secondary= in relationships accepts a Table object.
# Always prefer ChatSessionSource.__table__ in new code.
chat_session_sources = ChatSessionSource.__table__