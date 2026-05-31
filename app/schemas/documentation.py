"""
Pydantic schemas for the Documentation Generation feature.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────
# Request Schemas
# ─────────────────────────────────────────────────────────────────────────

ALLOWED_MODELS       = {"o1-mini", "gpt-4o-mini"}
ALLOWED_STYLES       = {"technical", "beginner-friendly", "executive"}
ALLOWED_DETAIL_LEVELS = {"minimal", "medium", "comprehensive"}


class DocGenerationConfig(BaseModel):
    model: str = Field(
        default="gpt-4o-mini",
        description="LLM model to use: 'o1-mini' (reasoning, slow) or 'gpt-4o-mini' (fast)",
    )
    style: str = Field(
        default="technical",
        description="Documentation style: 'technical' | 'beginner-friendly' | 'executive'",
    )
    detail_level: str = Field(
        default="comprehensive",
        description="Documentation depth: 'minimal' | 'medium' | 'comprehensive'",
    )
    include_apis: bool = Field(default=True, description="Include API/function reference section")
    include_examples: bool = Field(default=True, description="Include code examples section")
    include_architecture_diagram: bool = Field(
        default=True,
        description="Include architecture description section",
    )
    force_regenerate: bool = Field(
        default=False,
        description="If True, ignore cached docs and regenerate from scratch",
    )

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        if v not in ALLOWED_MODELS:
            raise ValueError(f"model must be one of: {', '.join(ALLOWED_MODELS)}")
        return v

    @field_validator("style")
    @classmethod
    def validate_style(cls, v: str) -> str:
        if v not in ALLOWED_STYLES:
            raise ValueError(f"style must be one of: {', '.join(ALLOWED_STYLES)}")
        return v

    @field_validator("detail_level")
    @classmethod
    def validate_detail_level(cls, v: str) -> str:
        if v not in ALLOWED_DETAIL_LEVELS:
            raise ValueError(f"detail_level must be one of: {', '.join(ALLOWED_DETAIL_LEVELS)}")
        return v


class StartDocGenRequest(BaseModel):
    config: DocGenerationConfig = Field(default_factory=DocGenerationConfig)
    source_id: Optional[UUID] = Field(
        default=None,
        description="Optional source ID. If provided, documentation will be generated for this specific source."
    )
    reuse_from_doc_gen_id: Optional[UUID] = Field(
        default=None,
        description=(
            "If set, copy this completed DocumentGeneration record into the current session "
            "instead of running a fresh pipeline. The doc_gen_id must match the source "
            "attached to this session."
        ),
    )




# ─────────────────────────────────────────────────────────────────────────
# Section metadata (part of sections_metadata JSON)
# ─────────────────────────────────────────────────────────────────────────

class DocSection(BaseModel):
    title: str
    level: int               # 1 = h1, 2 = h2, etc.
    char_start: int
    char_end: int


# ─────────────────────────────────────────────────────────────────────────
# Response Schemas
# ─────────────────────────────────────────────────────────────────────────

class DocGenerationResponse(BaseModel):
    id: UUID
    session_id: UUID
    source_id: UUID
    user_id: UUID
    status: str                          # Use .value from enum
    progress_percent: int
    generated_markdown: Optional[str]
    sections_metadata: Optional[dict]
    error_message: Optional[str]
    config: dict
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    # Extra fields added by route layer
    can_regenerate: Optional[bool] = None

    model_config = {"from_attributes": True}


class DocGenerationListItem(BaseModel):
    """Slim schema for list endpoint — no markdown body."""
    id: UUID
    session_id: UUID
    source_id: UUID
    status: str
    progress_percent: int
    error_message: Optional[str]
    config: dict
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}
