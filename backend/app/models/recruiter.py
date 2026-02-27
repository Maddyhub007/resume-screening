
"""
app/models/recruiter.py

Recruiter profile model.

Changes from Phase 1:
  - CompanySize enum replaces raw string column.
  - Composite index on (company_name, is_active).
  - to_dict_list() for dashboard list views.

Relationships:
  - jobs: one-to-many Job (cascade: all, delete-orphan)
"""

import json
from typing import Any

from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseModel
from app.models.enums import CompanySize, SA_COMPANY_SIZE


class Recruiter(BaseModel):
    """
    Recruiter account — posts jobs, manages applicants, tracks hiring metrics.

    Platform rank and hire counts are updated asynchronously by the
    AnalyticsService (Phase 4).
    """

    __tablename__ = "recruiters"

    # ── Identity ─────────────────────────────────────────────────────────────
    full_name:    Mapped[str]        = mapped_column(String(200), nullable=False)
    email:        Mapped[str]        = mapped_column(String(254), unique=True, nullable=False, index=True)
    company_name: Mapped[str]        = mapped_column(String(300), nullable=False, index=True)
    industry:     Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone:        Mapped[str | None] = mapped_column(String(30),  nullable=True)

    # ── Company metadata ──────────────────────────────────────────────────────
    company_size: Mapped[str | None] = mapped_column(
        SA_COMPANY_SIZE,
        nullable=True,
        comment="Headcount band: 1-10 | 11-50 | 51-200 | 201-500 | 500+"
    )
    website_url:  Mapped[str | None] = mapped_column(String(500), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Platform metrics (updated by AnalyticsService) ────────────────────────
    total_jobs_posted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_hires:       Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    platform_rank:     Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, index=True,
        comment="Lower value = higher rank on platform"
    )

    # ── Status ────────────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Composite indexes ─────────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_recruiters_company_active", "company_name", "is_active"),
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    jobs: Mapped[list] = relationship(
        "Job",
        back_populates="recruiter",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="Job.created_at.desc()",
    )

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self, exclude: set[str] | None = None) -> dict[str, Any]:
        return super().to_dict(exclude=exclude)

    def to_dict_list(self) -> dict[str, Any]:
        """Compact view for recruiter list endpoints."""
        return {
            "id":                self.id,
            "full_name":         self.full_name,
            "email":             self.email,
            "company_name":      self.company_name,
            "company_size":      self.company_size,
            "total_jobs_posted": self.total_jobs_posted,
            "platform_rank":     self.platform_rank,
        }

    def to_dict_public(self) -> dict[str, Any]:
        """External-safe view — omits internal metrics."""
        return self.to_dict(exclude={"is_active", "platform_rank"})

    def to_dict_dashboard(self) -> dict[str, Any]:
        """Full recruiter dashboard payload."""
        d = self.to_dict()
        d["active_jobs"] = sum(1 for j in self.jobs if j.status == "active")
        return d