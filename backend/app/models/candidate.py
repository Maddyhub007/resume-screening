
"""
app/models/candidate.py

Candidate profile model.

Changes from Phase 1:
  - Composite index on (email, is_active) for active-candidate lookups.
  - Index on (location, open_to_work) for filtered dashboard queries.
  - Explicit column ordering for readability.
  - to_dict_list() — compact view for paginated list endpoints.

Relationships:
  - resumes:      one-to-many Resume     (cascade: all, delete-orphan)
  - applications: one-to-many Application (cascade: all, delete-orphan)
"""

import json
from typing import Any

from sqlalchemy import Boolean, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseModel, db

from app.models.mixins import SoftDeleteMixin


class Candidate(BaseModel , SoftDeleteMixin):
    """
    Job-seeker profile.

    Candidates upload resumes, receive role suggestions and job recommendations,
    and track their application lifecycle.
    """

    __tablename__ = "candidates"

    # ── Identity ─────────────────────────────────────────────────────────────
    full_name: Mapped[str] = mapped_column(
        String(200), nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(254), unique=True, nullable=False, index=True
    )
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    headline: Mapped[str | None] = mapped_column(
        String(300), nullable=True,
        comment="e.g. 'Senior Python Developer | 5yrs exp | Open to remote'"
    )

    # ── Social profiles ───────────────────────────────────────────────────────
    linkedin_url:  Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_url:    Mapped[str | None] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Preferences (JSON-serialised lists) ───────────────────────────────────
    preferred_roles:     Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment='JSON list e.g. ["Backend Engineer","ML Engineer"]'
    )
    preferred_locations: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment='JSON list e.g. ["Remote","Chennai"]'
    )

    # ── Status flags ──────────────────────────────────────────────────────────
    open_to_work: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active:    Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Composite indexes ─────────────────────────────────────────────────────
    __table_args__ = (
        # Active candidates open to work — used by recruiter search
        Index("ix_candidates_open_active", "open_to_work", "is_active"),
        # Location filter for recruiter candidate search
        Index("ix_candidates_location",    "location"),
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    resumes: Mapped[list] = relationship(
        "Resume",
        back_populates="candidate",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="Resume.created_at.desc()",
    )
    applications: Mapped[list] = relationship(
        "Application",
        back_populates="candidate",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # ── JSON property accessors ───────────────────────────────────────────────

    @property
    def preferred_roles_list(self) -> list[str]:
        """Deserialised preferred job roles."""
        return _safe_json_list(self.preferred_roles)

    @preferred_roles_list.setter
    def preferred_roles_list(self, value: list[str]) -> None:
        self.preferred_roles = json.dumps(value)

    @property
    def preferred_locations_list(self) -> list[str]:
        """Deserialised preferred work locations."""
        return _safe_json_list(self.preferred_locations)

    @preferred_locations_list.setter
    def preferred_locations_list(self, value: list[str]) -> None:
        self.preferred_locations = json.dumps(value)

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self, exclude: set[str] | None = None) -> dict[str, Any]:
        """Full record — expands JSON list columns."""
        d = super().to_dict(exclude=exclude)
        d["preferred_roles"]     = self.preferred_roles_list
        d["preferred_locations"] = self.preferred_locations_list
        return d

    def to_dict_list(self) -> dict[str, Any]:
        """Compact representation for paginated list endpoints."""
        return {
            "id":           self.id,
            "full_name":    self.full_name,
            "email":        self.email,
            "location":     self.location,
            "headline":     self.headline,
            "open_to_work": self.open_to_work,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }

    def to_dict_public(self) -> dict[str, Any]:
        """External-safe view — omits internal flags."""
        return self.to_dict(exclude={"is_active"})


def _safe_json_list(value: str | None) -> list:
    if not value:
        return []
    try:
        result = json.loads(value)
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
        return []