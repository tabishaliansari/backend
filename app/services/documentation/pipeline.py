"""
Background pipeline orchestrator for documentation generation.

Mirrors services/indexing/pipeline.py in structure and error-handling conventions.

Key responsibilities:
  1. Update DocumentGeneration status/progress in DB at each phase
  2. Each _update_db() call fires a PostgreSQL trigger (doc_gen_status_trigger)
     which publishes a NOTIFY on source_status_updates channel
  3. SourceStatusListener dispatches the NOTIFY to SSE queues keyed by doc_gen_id
  4. Store generated markdown + sections_metadata in DB on success
  5. Handle errors gracefully and mark the record as 'failed'

SSE transport:
  Progress is communicated entirely through DB → PG trigger → LISTEN/NOTIFY →
  SourceStatusListener → SSE route. There is NO in-process asyncio.Queue in this
  pipeline — the DB is the single source of truth.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

from app.db.session import get_db_session
from app.repositories import doc_repo
from app.repositories import source_repo
from app.models.documentation import DocumentGenerationStatus
from app.services.documentation.doc_agent import generate_docs_with_agent
from app.utils.logger import logger


DOC_GEN_AGENT_TIMEOUT = 180  # seconds — overall agent timeout


# ─────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────

def _update_db(
    doc_gen_id: str,
    *,
    status: Optional[DocumentGenerationStatus] = None,
    progress: Optional[int] = None,
    started_at: Optional[datetime] = None,
    completed_at: Optional[datetime] = None,
    generated_markdown: Optional[str] = None,
    sections_metadata: Optional[dict] = None,
    error_message: Optional[str] = None,
) -> None:
    """
    Synchronous DB update wrapped in get_db_session context manager.

    Every call that changes status, progress_percent, or error_message
    fires the doc_gen_status_trigger PostgreSQL trigger, which publishes a
    NOTIFY on the source_status_updates channel. SourceStatusListener picks
    this up and delivers it to any SSE handlers subscribed to this doc_gen_id.
    """
    with get_db_session() as db:
        doc_repo.update_doc_status(
            db,
            doc_gen_id,
            status=status,
            progress=progress,
            started_at=started_at,
            completed_at=completed_at,
            generated_markdown=generated_markdown,
            sections_metadata=sections_metadata,
            error_message=error_message,
        )


# ─────────────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────────────

async def run_doc_generation_pipeline(doc_gen_id: str) -> None:
    """
    Main async orchestrator for documentation generation.

    Progress phases and DB writes (each triggers a PG NOTIFY → SSE):
      5%   → status=generating, phase: loading source record
      15%  → phase: resolving vector collection + graph index
      20%  → phase: starting documentation agent
      60%  → phase: agent is analyzing repository (long phase — LLM call)
      85%  → phase: validating and formatting output
      95%  → status=completed, storing markdown to DB
      100% → final progress update + completed_at timestamp

    On error: status=failed, error_message stored in DB (triggers one final NOTIFY).
    The SSE route detects the 'failed' status in the notification and closes.

    Args:
        doc_gen_id: DocumentGeneration UUID string
    """
    doc_gen_id = str(doc_gen_id)
    logger.info(f"[DocPipeline {doc_gen_id}] Pipeline started")

    try:
        # ──────────────────────────────────────────────────────────────────
        # Phase 1: Mark generating + load record (5%)
        # Uses a single DB session for both the status write and record read,
        # reducing the session count from 2 to 1 for this phase.
        # ──────────────────────────────────────────────────────────────────
        with get_db_session() as db:
            doc_repo.update_doc_status(
                db,
                doc_gen_id,
                status=DocumentGenerationStatus.generating,
                progress=5,
                started_at=datetime.now(timezone.utc),
            )
            doc_gen = doc_repo.get_doc_by_id(db, doc_gen_id)
            if not doc_gen:
                logger.error(f"[DocPipeline {doc_gen_id}] Record not found in DB")
                return

            source_id  = str(doc_gen.source_id)
            user_id    = str(doc_gen.user_id)
            config     = dict(doc_gen.config or {})

        # ──────────────────────────────────────────────────────────────────
        # Phase 2: Resolve collection_name + advance progress (20%)
        # Combines the source_index read and progress update into one session.
        # ──────────────────────────────────────────────────────────────────
        with get_db_session() as db:
            source_index = source_repo.get_source_index(db, source_id)
            if not source_index:
                raise RuntimeError(f"SourceIndex not found for source {source_id}")
            collection_name = source_index.collection_name

            doc_repo.update_doc_status(db, doc_gen_id, progress=20)

        # ──────────────────────────────────────────────────────────────────
        # Phase 3: Run agent with timeout (60%)
        # ──────────────────────────────────────────────────────────────────
        _update_db(doc_gen_id, progress=60)

        try:
            markdown, sections_metadata = await asyncio.wait_for(
                generate_docs_with_agent(
                    source_id=source_id,
                    collection_name=collection_name,
                    config=config,
                    user_id=user_id,
                    doc_gen_id=doc_gen_id,
                ),
                timeout=DOC_GEN_AGENT_TIMEOUT,
            )
        except asyncio.TimeoutError:
            raise RuntimeError(
                f"Documentation generation timed out after {DOC_GEN_AGENT_TIMEOUT}s. "
                "Please try again or use a simpler configuration."
            )

        # ──────────────────────────────────────────────────────────────────
        # Phase 4: Validate output (85%)
        # ──────────────────────────────────────────────────────────────────
        _update_db(doc_gen_id, progress=85)

        if not markdown or not markdown.strip():
            raise RuntimeError("Agent returned empty markdown. Please try again.")

        # Cap at ~200KB to prevent storage issues
        if len(markdown) > 200_000:
            logger.warning(
                f"[DocPipeline {doc_gen_id}] Markdown too large "
                f"({len(markdown)} chars), truncating to 200K"
            )
            markdown = markdown[:200_000] + "\n\n---\n*Documentation truncated due to length.*"

        # ──────────────────────────────────────────────────────────────────
        # Phase 5: Store result + finalize (100%)
        # Combines the previous Phase 6 (95%) and Phase 7 (100%) into a
        # single DB write to avoid an unnecessary extra session.
        # ──────────────────────────────────────────────────────────────────
        _update_db(
            doc_gen_id,
            status=DocumentGenerationStatus.completed,
            progress=100,
            generated_markdown=markdown,
            sections_metadata=sections_metadata,
            completed_at=datetime.now(timezone.utc),
        )

        cost    = sections_metadata.get("estimated_cost_usd", 0)
        elapsed = sections_metadata.get("generation_time_seconds", 0)
        logger.info(
            f"[DocPipeline {doc_gen_id}] Completed. "
            f"{len(markdown)} chars, {elapsed}s, ${cost:.4f}"
        )

    except Exception as e:
        logger.error(f"[DocPipeline {doc_gen_id}] Failed: {e}", exc_info=True)

        try:
            _update_db(
                doc_gen_id,
                status=DocumentGenerationStatus.failed,
                error_message=str(e)[:500],
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as db_err:
            logger.error(
                f"[DocPipeline {doc_gen_id}] Failed to update DB after error: {db_err}"
            )
        # NOTE: No SSE sentinel push needed — the SSE route detects 'failed'
        # status in the NOTIFY payload and closes the stream itself.
