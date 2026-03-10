"""
app/models/resume_draft.py

ResumeDraft — staging table for AI-generated resume drafts.

Lifecycle:
  draft     → just generated; candidate has not yet reviewed.
  refined   → at least one ATS optimisation loop completed.
  finalized → candidate saved; converted to a real Resume record.

Design decisions:
  - NEVER a Resume until explicitly finalized.  All preview scoring
    operates on ResumeDraft so the ats_scores table stays clean.
  - generated_content stores the complete structured JSON produced by
    the builder agent:
        { summary, skills[], experience[], education[],
          projects[], certifications[] }
  - predicted_score is from AtsScorerService.score_raw() — preview only;
    it is NEVER written to ats_scores until save-draft is called.
  - iteration_count is capped at MAX_AGENT_ITERATIONS=2 in the service.
  - feedback_json is a future learning hook — populated after recruiter
    outcome is known (shortlisted / hired).  Never read by scoring engine.
  - SoftDeleteMixin applied — drafts must never be hard-deleted; they
    are needed for future adaptive weighting analytics.

Matches existing patterns:
  - BaseModel     → id (UUID), created_at, updated_at
  - SoftDeleteMixin → is_deleted, deleted_at, soft_delete(), restore()
  - JSON list/dict columns use the same _jlist/_jdict helpers as Resume
  - to_dict() / to_dict_list() mirrors Resume serialisation pattern
"""

import json
import logging
from typing import Any

from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseModel
from app.models.mixins import SoftDeleteMixin

logger = logging.getLogger(__name__)

# ── Status constants (plain strings — no SQLAlchemy Enum; no migration cost) ──
DRAFT_STATUS_DRAFT     = "draft"
DRAFT_STATUS_REFINED   = "refined"
DRAFT_STATUS_FINALIZED = "finalized"

# Enforced at service layer — not a DB constraint
MAX_AGENT_ITERATIONS = 2


class ResumeDraft(BaseModel, SoftDeleteMixin):
    """
    AI-generated resume draft — pre-save staging area.

    One candidate may have many drafts (for different jobs, iterations).
    Only finalized drafts are converted to Resume records.
    """

    __tablename__ = "resume_drafts"

    # ── Foreign keys ──────────────────────────────────────────────────────────
    candidate_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Nullable — draft may exist without a target job (free-form mode)
    job_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── Template ──────────────────────────────────────────────────────────────
    template_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="modern",
        comment="Registry key: modern | classic | minimal | technical",
    )

    # ── Agent inputs (stored for audit / reproducibility) ─────────────────────
    user_prompt: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Free-text intent prompt supplied by the candidate",
    )

    # ── Generated content (full structured JSON blob) ─────────────────────────
    generated_content: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment=(
            "JSON: {summary, skills[], experience[], "
            "education[], projects[], certifications[]}"
        ),
    )

    # ── ATS preview scores (score_raw — no ats_scores row written) ────────────
    predicted_score: Mapped[float | None] = mapped_column(
        Float, nullable=True,
        comment="score_raw() result — preview, not in ats_scores table",
    )
    score_breakdown: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="JSON: {keyword, semantic, experience, section_quality, label}",
    )
    matched_skills: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="JSON list of skills present in both draft and job",
    )
    missing_skills: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="JSON list of job-required skills absent from draft",
    )

    # ── Agent metadata ────────────────────────────────────────────────────────
    iteration_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="Number of optimisation loops run (service enforces ≤ 2)",
    )
    status: Mapped[str] = mapped_column(
        String(20), default=DRAFT_STATUS_DRAFT, nullable=False, index=True,
        comment="draft | refined | finalized",
    )
    is_finalized: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="True once converted to a real Resume record",
    )
    finalized_resume_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True,
        comment="Set on finalize(); FK to resumes.id (no FK constraint — avoid cascade)",
    )

    # ── Future learning hook ──────────────────────────────────────────────────
    # Written AFTER recruiter outcome is known. Never read by scoring engine.
    feedback_json: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment=(
            "JSON: {shortlisted: bool, interview_stage: str, hired: bool} "
            "— future adaptive-weighting training signal only"
        ),
    )

    # ── Composite indexes ─────────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_resume_drafts_candidate_status", "candidate_id", "status"),
        Index("ix_resume_drafts_candidate_job",    "candidate_id", "job_id"),
    )

    # ── Relationships (read-only navigation; no write-cascade into other models)
    candidate: Mapped["Candidate"] = relationship(   # noqa: F821
        "Candidate", foreign_keys=[candidate_id], lazy="select", viewonly=True
    )
    job: Mapped["Job"] = relationship(               # noqa: F821
        "Job", foreign_keys=[job_id], lazy="select", viewonly=True
    )

    # ── JSON property accessors (mirrors Resume model pattern) ────────────────

    @property
    def content_dict(self) -> dict:
        """Deserialise generated_content JSON → dict."""
        return _jdict(self.generated_content)

    @content_dict.setter
    def content_dict(self, value: dict) -> None:
        self.generated_content = json.dumps(value)

    @property
    def score_breakdown_dict(self) -> dict:
        return _jdict(self.score_breakdown)

    @score_breakdown_dict.setter
    def score_breakdown_dict(self, value: dict) -> None:
        self.score_breakdown = json.dumps(value)

    @property
    def matched_skills_list(self) -> list[str]:
        return _jlist(self.matched_skills)

    @matched_skills_list.setter
    def matched_skills_list(self, value: list) -> None:
        self.matched_skills = json.dumps(value)

    @property
    def missing_skills_list(self) -> list[str]:
        return _jlist(self.missing_skills)

    @missing_skills_list.setter
    def missing_skills_list(self, value: list) -> None:
        self.missing_skills = json.dumps(value)

    # ── Serialisation (mirrors Resume.to_dict pattern) ────────────────────────

    def to_dict(self, exclude: set[str] | None = None) -> dict[str, Any]:
        """Full record serialisation — expands all JSON columns."""
        d = super().to_dict(exclude=exclude)
        d["content"]         = self.content_dict
        d["score_breakdown"] = self.score_breakdown_dict
        d["matched_skills"]  = self.matched_skills_list
        d["missing_skills"]  = self.missing_skills_list
        return d

    def to_dict_list(self) -> dict[str, Any]:
        """Compact view for list endpoints — omits large content blob."""
        return {
            "id":              self.id,
            "candidate_id":    self.candidate_id,
            "job_id":          self.job_id,
            "template_id":     self.template_id,
            "status":          self.status,
            "predicted_score": self.predicted_score,
            "iteration_count": self.iteration_count,
            "is_finalized":    self.is_finalized,
            "created_at":      self.created_at.isoformat() if self.created_at else None,
            "updated_at":      self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<ResumeDraft id={self.id!r} candidate={self.candidate_id!r} "
            f"status={self.status!r} score={self.predicted_score}>"
        )


# ── Private JSON helpers (same pattern as resume.py) ─────────────────────────

def _jlist(value: str | None) -> list:
    if not value:
        return []
    try:
        result = json.loads(value)
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _jdict(value: str | None) -> dict:
    if not value:
        return {}
    try:
        result = json.loads(value)
        return result if isinstance(result, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}
