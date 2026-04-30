from uuid import uuid4
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, String, Integer
from sqlalchemy.sql import func
from datetime import datetime
from app.db.database import Base

class SourceIndex(Base):
    __tablename__ = "source_indexes"

    id:              Mapped[UUID]     = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    source_id:       Mapped[UUID]     = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), unique=True, nullable=False)
    collection_name: Mapped[str]      = mapped_column(String, nullable=False)
    provider:        Mapped[str]      = mapped_column(String, default="qdrant")
    embedding_model: Mapped[str]      = mapped_column(String, default="text-embedding-3-small")
    chunk_size:      Mapped[int]      = mapped_column(Integer, default=1000)
    chunk_overlap:   Mapped[int]      = mapped_column(Integer, default=200)
    indexed_at:      Mapped[datetime] = mapped_column(default=func.now())

    # Bidirectional — indexing service starts from source, retrieval starts from index
    source: Mapped["Source"] = relationship("Source", back_populates="source_index")