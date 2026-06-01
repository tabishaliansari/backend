"""
Repository for DocumentGeneration database operations.

Design: DocumentGeneration is session-owned and source-bound.
  - create_doc_generation:              create new pending record for a session+source pair
  - get_doc_by_session_and_source:      look up this session's own copy (for cache check)
  - get_any_completed_doc_for_source:   cross-session lookup (to offer reuse to another session)
  - copy_doc_to_session:                copy an existing completed record into a new session
  - list_docs_by_session:               all docs owned by a session (ordered newest-first)
  - update_doc_status:                  partial update for pipeline progress reporting
  - delete_doc_generation:              delete a record (allowing fresh regeneration)

No business logic here — that lives in the service / route layer.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.documentation import DocumentGeneration, DocumentGenerationStatus
from app.utils.logger import logger


# ─────────────────────────────────────────────────────────────────────────
# Read operations
# ─────────────────────────────────────────────────────────────────────────

def get_doc_by_id(
    db: Session,
    doc_gen_id: UUID,
) -> Optional[DocumentGeneration]:
    """Get a DocumentGeneration record by its primary key."""
    return (
        db.query(DocumentGeneration)
        .filter(DocumentGeneration.id == doc_gen_id)
        .first()
    )


def get_doc_by_session_and_source(
    db: Session,
    session_id: UUID,
    source_id: UUID,
) -> Optional[DocumentGeneration]:
    """
    Get this session's own copy of docs for a specific source.

    Used for:
      - Cache hit check: has this session already generated docs for this source?
      - In-progress check: is there already a running pipeline for this session+source?
    """
    return (
        db.query(DocumentGeneration)
        .filter(
            DocumentGeneration.session_id == session_id,
            DocumentGeneration.source_id == source_id,
        )
        .first()
    )


def get_any_completed_doc_for_source(
    db: Session,
    source_id: UUID,
) -> Optional[DocumentGeneration]:
    """
    Cross-session lookup: find any completed DocumentGeneration for a source
    across ALL sessions (ordered by completion time, newest first).

    Used to offer the 'reuse existing documentation' option when a user in
    a new session selects a source that has already been documented elsewhere.

    Returns None if no completed doc exists for this source anywhere.
    """
    return (
        db.query(DocumentGeneration)
        .filter(
            DocumentGeneration.source_id == source_id,
            DocumentGeneration.status == DocumentGenerationStatus.completed,
        )
        .order_by(desc(DocumentGeneration.completed_at))
        .first()
    )


def list_docs_by_session(
    db: Session,
    session_id: UUID,
) -> list[DocumentGeneration]:
    """
    List all DocumentGeneration records owned by a session.
    Ordered by creation date descending (newest first).
    """
    return (
        db.query(DocumentGeneration)
        .filter(DocumentGeneration.session_id == session_id)
        .order_by(desc(DocumentGeneration.created_at))
        .all()
    )


# ─────────────────────────────────────────────────────────────────────────
# Write operations
# ─────────────────────────────────────────────────────────────────────────

def create_doc_generation(
    db: Session,
    *,
    session_id: UUID,
    source_id: UUID,
    user_id: UUID,
    config: dict,
) -> DocumentGeneration:
    """
    Create a new DocumentGeneration record with status=pending.

    Args:
        db:         Active DB session
        session_id: The owning chat session
        source_id:  The GitHub source being documented
        user_id:    The initiating user
        config:     Generation config dict (model, style, detail_level, etc.)

    Returns:
        Newly created DocumentGeneration with id populated.
    """
    doc_gen = DocumentGeneration(
        session_id=session_id,
        source_id=source_id,
        user_id=user_id,
        config=config,
        status=DocumentGenerationStatus.pending,
        progress_percent=0,
    )
    db.add(doc_gen)
    db.commit()
    db.refresh(doc_gen)
    logger.info(
        f"[DocRepo] Created DocumentGeneration {doc_gen.id} "
        f"for session {session_id} / source {source_id}"
    )
    return doc_gen


def copy_doc_to_session(
    db: Session,
    *,
    existing_doc: DocumentGeneration,
    new_session_id: UUID,
    user_id: UUID,
) -> DocumentGeneration:
    """
    Copy a completed DocumentGeneration into a new session.

    Creates a brand-new row with the same markdown, sections_metadata, and config
    but with new_session_id as the owner. The copy is immediately status=completed
    and independently owned — future changes to the original do not affect the copy.

    Args:
        db:             Active DB session
        existing_doc:   The completed DocumentGeneration to copy from
        new_session_id: The session that will own the new copy
        user_id:        The user who triggered the reuse

    Returns:
        Newly created (status=completed) DocumentGeneration for new_session_id.
    """
    new_doc = DocumentGeneration(
        session_id=new_session_id,
        source_id=existing_doc.source_id,
        user_id=user_id,
        generated_markdown=existing_doc.generated_markdown,
        sections_metadata=existing_doc.sections_metadata,
        config=existing_doc.config,
        status=DocumentGenerationStatus.completed,
        progress_percent=100,
        started_at=existing_doc.started_at,
        completed_at=existing_doc.completed_at,
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    logger.info(
        f"[DocRepo] Copied DocumentGeneration {existing_doc.id} → {new_doc.id} "
        f"for session {new_session_id}"
    )
    return new_doc


def update_doc_status(
    db: Session,
    doc_gen_id: UUID,
    *,
    status: Optional[DocumentGenerationStatus] = None,
    progress: Optional[int] = None,
    started_at: Optional[datetime] = None,
    completed_at: Optional[datetime] = None,
    generated_markdown: Optional[str] = None,
    sections_metadata: Optional[dict] = None,
    error_message: Optional[str] = None,
) -> Optional[DocumentGeneration]:
    """
    Partial update for a DocumentGeneration record.
    Only updates fields that are explicitly passed (not None).
    Uses a single UPDATE statement without a prior SELECT.

    Returns:
        Updated DocumentGeneration, or None if not found.
    """
    updates = {}
    if status is not None:
        updates["status"] = status
    if progress is not None:
        updates["progress_percent"] = progress
    if started_at is not None:
        updates["started_at"] = started_at
    if completed_at is not None:
        updates["completed_at"] = completed_at
    if generated_markdown is not None:
        updates["generated_markdown"] = generated_markdown
    if sections_metadata is not None:
        updates["sections_metadata"] = sections_metadata
    if error_message is not None:
        updates["error_message"] = str(error_message)[:500]

    if not updates:
        return get_doc_by_id(db, doc_gen_id)

    rows_updated = (
        db.query(DocumentGeneration)
        .filter(DocumentGeneration.id == doc_gen_id)
        .update(updates, synchronize_session="fetch")
    )
    db.commit()

    if rows_updated == 0:
        logger.warning(f"[DocRepo] update_doc_status: record {doc_gen_id} not found")
        return None

    return get_doc_by_id(db, doc_gen_id)


def delete_doc_generation(db: Session, doc_gen_id: UUID) -> bool:
    """
    Delete a DocumentGeneration record.
    Uses a single DELETE statement without a prior SELECT.

    Returns:
        True if deleted, False if not found.
    """
    rows_deleted = (
        db.query(DocumentGeneration)
        .filter(DocumentGeneration.id == doc_gen_id)
        .delete(synchronize_session="fetch")
    )
    db.commit()

    if rows_deleted == 0:
        return False

    logger.info(f"[DocRepo] Deleted DocumentGeneration {doc_gen_id}")
    return True
