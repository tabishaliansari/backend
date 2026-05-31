"""
Documentation generation routes.

All routes live under /sessions/{session_id} to maintain the session-bound API.
DocumentGeneration is session-owned: one record per (session_id, source_id) pair.

Endpoints:
  POST   /sessions/{session_id}/generate-docs            → start or return cached docs
  GET    /sessions/{session_id}/docs/by-source           → cache check + cross-session reuse info
  GET    /sessions/{session_id}/docs/{doc_gen_id}/stream → SSE progress stream (PG NOTIFY)
  GET    /sessions/{session_id}/docs/{doc_gen_id}/status → poll status/result
  GET    /sessions/{session_id}/docs                     → list all docs owned by session
  DELETE /sessions/{session_id}/docs/{doc_gen_id}        → delete / allow regeneration

Cross-session reuse:
  When session B selects a source that already has completed docs in another session,
  by-source returns the existing record info and a list of sessions that own a copy.
  If user picks "Reuse", POST with { reuse_from_doc_gen_id } → copy_doc_to_session.
  If user picks "Regenerate", POST normally → fresh pipeline run for session B.

SSE transport:
  Progress events are delivered via PostgreSQL LISTEN/NOTIFY on the
  source_status_updates channel. SourceStatusListener dispatches
  doc_gen_status_changed events keyed by doc_gen_id to the SSE route.
  The pipeline writes only to the DB — no in-process queues.
"""

import asyncio
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from app.db.database import get_db
from app.models.user import User
from app.models.documentation import DocumentGenerationStatus
from app.models.source import SourceType
from app.models.chat_session import ChatSession
from app.api.deps import get_current_user
from app.api.limiter import limiter
from app.schemas.response import ApiResponse
from app.schemas.documentation import (
    StartDocGenRequest,
)
from app.utils.api_error import ApiError
from app.repositories import source_repo, doc_repo
from app.repositories.session_repo import get_session_by_id
from app.services.documentation.pipeline import run_doc_generation_pipeline
from app.db.listeners.source_status_listener import source_status_listener
from app.utils.logger import logger

router = APIRouter(prefix="/sessions", tags=["documentation"])


# ── SSE helpers ────────────────────────────────────────────────────────────

def _sse_event(event_type: str, data: dict) -> str:
    """Format a named SSE event."""
    import json
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _sse_comment(text: str) -> str:
    """SSE heartbeat / comment line."""
    return f": {text}\n\n"


# ─────────────────────────────────────────────────────────────────────────
# POST /sessions/{session_id}/generate-docs
# ─────────────────────────────────────────────────────────────────────────

@router.post("/{session_id}/generate-docs", response_model=ApiResponse)
@limiter.limit("10/hour")
async def start_doc_generation(
    request: Request,
    session_id: UUID,
    body: StartDocGenRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start documentation generation for this session's GitHub source.

    Handles two flows:
      Normal:  Start a fresh pipeline run for this session+source pair.
      Reuse:   If body.reuse_from_doc_gen_id is set, copy that completed
               record into a new row owned by this session (no pipeline run).

    Validation:
      1. Session must exist and belong to current_user
      2. Session must have exactly 1 source attached
      3. Source must be of type 'github'
      4. Source must be fully indexed (graph_indexed=true AND vector_indexed=true)

    Cache checks (normal flow only):
      5. If this session already has docs AND force_regenerate=False → return cached
      6. If generation already in-progress → return 202 with stream URL
    """
    config = body.config.model_dump()

    # ── 1. Verify session ownership ────────────────────────────────────────
    session = get_session_by_id(db, session_id)
    if not session:
        raise ApiError(404, "Session not found")
    if str(session.user_id) != str(current_user.id):
        raise ApiError(403, "You do not have permission to access this session")

    # ── 2. Verify source ───────────────────────────────────────────────────
    sources = source_repo.get_sources_by_session(db, session_id)
    source_id = getattr(body, "source_id", None)
    source = None

    if source_id:
        for s in sources:
            if s.id == source_id:
                source = s
                break
        if not source:
            raise ApiError(
                400,
                f"Documentation generation requires source to be attached to this session. "
                f"Source with ID '{source_id}' is not attached."
            )
    else:
        if len(sources) == 0:
            raise ApiError(
                400,
                "Documentation generation requires exactly 1 GitHub source attached to this session. "
                "No sources are currently attached."
            )
        if len(sources) > 1:
            raise ApiError(
                400,
                f"Documentation generation requires exactly 1 source. "
                f"This session has {len(sources)} sources attached. "
                "Please select a single source using the checkbox or detach all but one."
            )
        source = sources[0]

    # ── 3. Verify source is a GitHub repository ────────────────────────────
    if source.type != SourceType.github:
        raise ApiError(
            400,
            f"Documentation generation only supports GitHub repositories. "
            f"The selected source '{source.title}' is of type '{source.type.value}'. "
            "Please select a GitHub repository instead."
        )

    # ── Reuse flow: copy completed doc from another session ────────────────
    reuse_from_id = getattr(body, "reuse_from_doc_gen_id", None)
    if reuse_from_id:
        existing_doc = doc_repo.get_doc_by_id(db, reuse_from_id)
        if not existing_doc:
            raise ApiError(404, "Source documentation record not found")
        if existing_doc.status != DocumentGenerationStatus.completed:
            raise ApiError(400, "Can only reuse a completed documentation record")
        if str(existing_doc.source_id) != str(source.id):
            raise ApiError(400, "Documentation record does not match the attached source")

        # Check this session doesn't already have its own copy
        existing_this_session = doc_repo.get_doc_by_session_and_source(db, session_id, source.id)
        if existing_this_session:
            return ApiResponse(
                statusCode=200,
                success=True,
                message="This session already has documentation for this source",
                data=_serialize_doc_gen(existing_this_session),
            )

        copied = doc_repo.copy_doc_to_session(
            db,
            existing_doc=existing_doc,
            new_session_id=session_id,
            user_id=current_user.id,
        )
        return ApiResponse(
            statusCode=201,
            success=True,
            message="Documentation copied from existing record",
            data=_serialize_doc_gen(copied),
        )

    # ── 4. Verify source is fully indexed ──────────────────────────────────
    source_index = source_repo.get_source_index(db, source.id)
    if not source_index:
        raise ApiError(
            400,
            f"Source '{source.title}' has not been indexed yet. "
            "Please wait for indexing to complete before generating documentation."
        )
    if not source_index.graph_indexed:
        raise ApiError(
            400,
            f"Source '{source.title}' graph indexing is not complete yet. "
            "Documentation generation requires the knowledge graph to be built. "
            "Please wait and try again."
        )
    if not source_index.vector_indexed:
        raise ApiError(
            400,
            f"Source '{source.title}' vector indexing is not complete yet. "
            "Please wait for full indexing to complete."
        )

    source_id = source.id
    force_regen = config.get("force_regenerate", False)

    # ── 5. Cache check — this session's own existing record ───────────────
    existing = doc_repo.get_doc_by_session_and_source(db, session_id, source_id)

    if existing and not force_regen:
        if existing.status == DocumentGenerationStatus.completed:
            return ApiResponse(
                statusCode=200,
                success=True,
                message="Documentation already generated for this session+source",
                data={
                    **_serialize_doc_gen(existing),
                    "can_regenerate": True,
                    "status_url": f"/sessions/{session_id}/docs/{existing.id}/status",
                },
            )

        # ── 6. Already generating ──────────────────────────────────────────
        if existing.status == DocumentGenerationStatus.generating:
            return ApiResponse(
                statusCode=202,
                success=True,
                message="Documentation generation already in progress.",
                data={
                    "id": str(existing.id),
                    "source_id": str(source_id),
                    "status": "generating",
                    "progress_percent": existing.progress_percent,
                    "sse_stream_url": f"/sessions/{session_id}/docs/{existing.id}/stream",
                    "polling_url": f"/sessions/{session_id}/docs/{existing.id}/status",
                },
            )

        if existing.status == DocumentGenerationStatus.pending:
            return ApiResponse(
                statusCode=202,
                success=True,
                message="Documentation generation is pending.",
                data={
                    "id": str(existing.id),
                    "status": "pending",
                    "sse_stream_url": f"/sessions/{session_id}/docs/{existing.id}/stream",
                },
            )

    # ── Delete stale failed/completed record before regenerating ──────────
    if existing and force_regen:
        doc_repo.delete_doc_generation(db, existing.id)
        logger.info(f"[DocRoute] Deleted stale doc record {existing.id} for force_regenerate")

    # ── Create new DocumentGeneration record ──────────────────────────────
    doc_gen = doc_repo.create_doc_generation(
        db,
        session_id=session_id,
        source_id=source_id,
        user_id=current_user.id,
        config=config,
    )
    doc_gen_id = str(doc_gen.id)

    # Schedule background task — pipeline updates DB → PG NOTIFY → SSE
    background_tasks.add_task(run_doc_generation_pipeline, doc_gen_id)

    logger.info(
        f"[DocRoute] Scheduled documentation generation {doc_gen_id} "
        f"for session {session_id} / source {source_id} / model={config.get('model')}"
    )

    return ApiResponse(
        statusCode=202,
        success=True,
        message="Documentation generation started",
        data={
            "id": doc_gen_id,
            "session_id": str(session_id),
            "source_id": str(source_id),
            "status": "pending",
            "progress_percent": 0,
            "sse_stream_url": f"/sessions/{session_id}/docs/{doc_gen_id}/stream",
            "polling_url": f"/sessions/{session_id}/docs/{doc_gen_id}/status",
            "created_at": doc_gen.created_at.isoformat(),
        },
    )


# ─────────────────────────────────────────────────────────────────────────
# GET /sessions/{session_id}/docs/by-source
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/docs/by-source", response_model=ApiResponse)
async def get_doc_by_source(
    request: Request,
    session_id: UUID,
    source_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Primary endpoint the docs panel calls on open.

    Checks in order:
      1. Does THIS session already own a doc for the attached source?
         → Return it (status may be pending/generating/completed/failed)
      2. Does ANY other session own a completed doc for the same source?
         → Return that + sessions_with_doc list so user can pick Reuse/Regenerate
      3. No docs exist anywhere for this source
         → Return { exists: false }

    The sessions_with_doc list lets the frontend show "other sessions that have
    docs for this source" in the Reuse picker.

    Note: generated_markdown is NOT returned here (payload too large).
    Use GET /docs/{doc_gen_id}/status to fetch the full markdown.
    """
    session = get_session_by_id(db, session_id)
    if not session:
        raise ApiError(404, "Session not found")
    if str(session.user_id) != str(current_user.id):
        raise ApiError(403, "You do not have permission to access this session")

    # Resolve source (must be a GitHub source)
    sources = source_repo.get_sources_by_session(db, session_id)
    source = None

    if source_id:
        for s in sources:
            if s.id == source_id:
                source = s
                break
        if not source:
            raise ApiError(
                400,
                f"Source with ID '{source_id}' is not attached to this session."
            )
        if source.type != SourceType.github:
            return ApiResponse(
                statusCode=200,
                success=True,
                data={
                    "exists": False,
                    "reason": "no_single_github_source",
                    "source_count": len(sources),
                },
            )
    else:
        if len(sources) != 1 or sources[0].type != SourceType.github:
            return ApiResponse(
                statusCode=200,
                success=True,
                data={
                    "exists": False,
                    "reason": "no_single_github_source",
                    "source_count": len(sources),
                },
            )
        source = sources[0]

    # 1. Check this session's own copy first
    own_doc = doc_repo.get_doc_by_session_and_source(db, session_id, source.id)
    if own_doc:
        return ApiResponse(
            statusCode=200,
            success=True,
            data={
                "exists": True,
                "owned_by_this_session": True,
                "doc_gen_id": str(own_doc.id),
                "source_id": str(own_doc.source_id),
                "status": own_doc.status.value,
                "progress_percent": own_doc.progress_percent,
                "error_message": own_doc.error_message,
                "sections_metadata": own_doc.sections_metadata,
                "created_at": own_doc.created_at.isoformat() if own_doc.created_at else None,
                "completed_at": own_doc.completed_at.isoformat() if own_doc.completed_at else None,
                "sse_stream_url": f"/sessions/{session_id}/docs/{own_doc.id}/stream",
                "status_url": f"/sessions/{session_id}/docs/{own_doc.id}/status",
            },
        )

    # 2. Cross-session lookup: any completed doc for this source?
    other_doc = doc_repo.get_any_completed_doc_for_source(db, source.id)
    if other_doc:
        sessions_with_doc = _get_sessions_with_doc_for_source(db, source.id, current_user.id, exclude_session_id=session_id)
        return ApiResponse(
            statusCode=200,
            success=True,
            data={
                "exists": True,
                "owned_by_this_session": False,
                "doc_gen_id": str(other_doc.id),
                "source_id": str(other_doc.source_id),
                "status": other_doc.status.value,
                "sections_metadata": other_doc.sections_metadata,
                "completed_at": other_doc.completed_at.isoformat() if other_doc.completed_at else None,
                "sessions_with_doc": sessions_with_doc,
                # Frontend uses this to call POST with reuse_from_doc_gen_id
                "reuse_endpoint": f"/sessions/{session_id}/generate-docs",
            },
        )

    # 3. No docs anywhere
    return ApiResponse(
        statusCode=200,
        success=True,
        data={"exists": False, "source_id": str(source.id)},
    )


# ─────────────────────────────────────────────────────────────────────────
# GET /sessions/{session_id}/docs/{doc_gen_id}/stream   (SSE via PG NOTIFY)
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/docs/{doc_gen_id}/stream")
async def stream_doc_generation(
    request: Request,
    session_id: UUID,
    doc_gen_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE stream delivering real-time progress events for a doc generation task.

    Transport: PostgreSQL LISTEN/NOTIFY via SourceStatusListener.
    The pipeline writes status/progress to the DB → PG trigger fires →
    NOTIFY on source_status_updates → listener dispatches to this SSE queue.

    Events:
      snapshot              → current DB state on connect (always first)
      doc_gen_status_changed → { status, progress_percent, error_message }
      complete              → terminal event (status=completed or failed)

    Heartbeat comments (: heartbeat) every 20s keep proxies alive.
    The stream closes automatically when status reaches completed or failed.

    Usage example (JavaScript):
        const es = new EventSource(`/sessions/${sessionId}/docs/${docGenId}/stream`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        es.addEventListener('snapshot', e => console.log(JSON.parse(e.data)));
        es.addEventListener('doc_gen_status_changed', e => {
            updateProgressBar(JSON.parse(e.data).progress_percent);
        });
        es.addEventListener('complete', () => es.close());
    """
    doc_gen_id_str = str(doc_gen_id)

    doc_gen = doc_repo.get_doc_by_id(db, doc_gen_id)
    if not doc_gen:
        raise ApiError(404, "Documentation generation not found")
    if str(doc_gen.user_id) != str(current_user.id):
        raise ApiError(403, "You do not have permission to stream this documentation generation")

    # Build snapshot of current DB state (emitted immediately on connect)
    initial_snapshot = {
        "doc_gen_id":       str(doc_gen.id),
        "session_id":       str(doc_gen.session_id),
        "source_id":        str(doc_gen.source_id),
        "status":           doc_gen.status.value,
        "progress_percent": doc_gen.progress_percent,
        "error_message":    doc_gen.error_message,
    }
    already_terminal = doc_gen.status in (
        DocumentGenerationStatus.completed,
        DocumentGenerationStatus.failed,
    )

    async def event_generator():
        # 1. Emit current DB state immediately (mirrors source SSE route pattern)
        yield _sse_event("snapshot", initial_snapshot)

        # 2. If already terminal, emit complete and close
        if already_terminal:
            yield _sse_event("complete", {
                "status": doc_gen.status.value,
                "message": "Documentation generation already in terminal state.",
            })
            return

        # 3. Subscribe to PG NOTIFY events for this doc_gen_id
        queue = source_status_listener.subscribe_doc(doc_gen_id_str)
        try:
            while True:
                if await request.is_disconnected():
                    logger.info(f"[DocSSE] Client disconnected: {doc_gen_id_str}")
                    break

                try:
                    data: dict = await asyncio.wait_for(queue.get(), timeout=20.0)
                except asyncio.TimeoutError:
                    yield _sse_comment("heartbeat")
                    continue

                # Emit the NOTIFY payload as an SSE event
                yield _sse_event("doc_gen_status_changed", data)

                # Check for terminal state
                status = data.get("status", "")
                if status in ("completed", "failed"):
                    yield _sse_event("complete", {
                        "status": status,
                        "progress_percent": data.get("progress_percent", 0),
                        "error_message": data.get("error_message"),
                    })
                    break

        finally:
            source_status_listener.unsubscribe_doc(doc_gen_id_str, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "Connection":        "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering for SSE
        },
    )


# ─────────────────────────────────────────────────────────────────────────
# GET /sessions/{session_id}/docs/{doc_gen_id}/status
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/docs/{doc_gen_id}/status", response_model=ApiResponse)
async def get_doc_generation_status(
    request: Request,
    session_id: UUID,
    doc_gen_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Poll the status and result of a documentation generation task.
    Returns full DocGenerationResponse including generated_markdown when completed.
    """
    doc_gen = doc_repo.get_doc_by_id(db, doc_gen_id)
    if not doc_gen:
        raise ApiError(404, "Documentation generation not found")
    if str(doc_gen.user_id) != str(current_user.id):
        raise ApiError(403, "You do not have permission to view this documentation generation")

    return ApiResponse(
        statusCode=200,
        success=True,
        data=_serialize_doc_gen(doc_gen),
    )


# ─────────────────────────────────────────────────────────────────────────
# GET /sessions/{session_id}/docs
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/docs", response_model=ApiResponse)
async def list_doc_generations(
    request: Request,
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all DocumentGeneration records owned by this session (newest first).
    Returns slim items (no markdown body — use /status for full content).
    """
    session = get_session_by_id(db, session_id)
    if not session:
        raise ApiError(404, "Session not found")
    if str(session.user_id) != str(current_user.id):
        raise ApiError(403, "You do not have permission to access this session")

    docs = doc_repo.list_docs_by_session(db, session_id)

    return ApiResponse(
        statusCode=200,
        success=True,
        data=[_serialize_doc_gen_slim(d) for d in docs],
    )


# ─────────────────────────────────────────────────────────────────────────
# DELETE /sessions/{session_id}/docs/{doc_gen_id}
# ─────────────────────────────────────────────────────────────────────────

@router.delete("/{session_id}/docs/{doc_gen_id}", response_model=ApiResponse)
async def delete_doc_generation(
    request: Request,
    session_id: UUID,
    doc_gen_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a documentation generation record (allowing fresh regeneration).

    If the generation is currently in progress the background task will
    eventually try to write to the now-deleted record and fail gracefully
    (update_doc_status returns None for missing records). The SSE stream
    will see no further NOTIFYs and time out via heartbeat.
    """
    doc_gen = doc_repo.get_doc_by_id(db, doc_gen_id)
    if not doc_gen:
        raise ApiError(404, "Documentation generation not found")
    if str(doc_gen.user_id) != str(current_user.id):
        raise ApiError(403, "You do not have permission to delete this documentation generation")

    deleted = doc_repo.delete_doc_generation(db, doc_gen_id)
    if not deleted:
        raise ApiError(500, "Failed to delete documentation generation")

    return ApiResponse(
        statusCode=200,
        success=True,
        message=(
            "Documentation deleted. "
            "You can now generate fresh documentation for this source."
        ),
    )


# ─────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────

def _get_sessions_with_doc_for_source(
    db: Session,
    source_id: UUID,
    user_id: UUID,
    exclude_session_id: UUID,
) -> list[dict]:
    """
    Return sessions (belonging to user_id) that own a completed DocumentGeneration
    for source_id, excluding the calling session.

    Used by by-source to populate the 'Reuse — choose from these sessions' list.
    """
    from app.models.documentation import DocumentGeneration
    from sqlalchemy import desc

    docs = (
        db.query(DocumentGeneration)
        .join(ChatSession, ChatSession.id == DocumentGeneration.session_id)
        .filter(
            DocumentGeneration.source_id == source_id,
            DocumentGeneration.status == DocumentGenerationStatus.completed,
            ChatSession.user_id == user_id,
            DocumentGeneration.session_id != exclude_session_id,
        )
        .order_by(desc(DocumentGeneration.completed_at))
        .all()
    )
    return [
        {
            "doc_gen_id": str(d.id),
            "session_id": str(d.session_id),
            "session_title": d.session.title if d.session else None,
            "completed_at": d.completed_at.isoformat() if d.completed_at else None,
        }
        for d in docs
    ]


def _serialize_doc_gen(doc_gen) -> dict:
    """Full serialization including markdown body."""
    return {
        "id":                 str(doc_gen.id),
        "session_id":         str(doc_gen.session_id),
        "source_id":          str(doc_gen.source_id),
        "user_id":            str(doc_gen.user_id),
        "status":             doc_gen.status.value,
        "progress_percent":   doc_gen.progress_percent,
        "generated_markdown": doc_gen.generated_markdown,
        "sections_metadata":  doc_gen.sections_metadata,
        "error_message":      doc_gen.error_message,
        "config":             doc_gen.config,
        "created_at":         doc_gen.created_at.isoformat() if doc_gen.created_at else None,
        "started_at":         doc_gen.started_at.isoformat() if doc_gen.started_at else None,
        "completed_at":       doc_gen.completed_at.isoformat() if doc_gen.completed_at else None,
    }


def _serialize_doc_gen_slim(doc_gen) -> dict:
    """Slim serialization for list endpoint — no markdown body."""
    return {
        "id":               str(doc_gen.id),
        "session_id":       str(doc_gen.session_id),
        "source_id":        str(doc_gen.source_id),
        "status":           doc_gen.status.value,
        "progress_percent": doc_gen.progress_percent,
        "error_message":    doc_gen.error_message,
        "config":           doc_gen.config,
        "created_at":       doc_gen.created_at.isoformat() if doc_gen.created_at else None,
        "completed_at":     doc_gen.completed_at.isoformat() if doc_gen.completed_at else None,
    }
