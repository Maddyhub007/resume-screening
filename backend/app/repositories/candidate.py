"""
app/repositories/candidate.py — Candidate-specific data access methods.
"""

import logging
from typing import Any

from sqlalchemy import or_

from app.core.database import db
from app.models.candidate import Candidate
from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class CandidateRepository(BaseRepository[Candidate]):
    """Repository for Candidate model — extends BaseRepository with domain queries."""

    model = Candidate

    def get_by_email(self, email: str) -> Candidate | None:
        """Fetch a candidate by email address (case-insensitive)."""
        return (
            db.session.query(Candidate)
            .filter(Candidate.email.ilike(email.strip()))
            .first()
        )

    def email_exists(self, email: str) -> bool:
        """Return True if a candidate with this email already exists."""
        return self.get_by_email(email) is not None

    def list_active(
        self,
        page: int = 1,
        limit: int = 20,
        search: str | None = None,
        open_to_work: bool | None = None,
        location: str | None = None,
    ) -> tuple[list[Candidate], int]:
        """
        Paginated list of active candidates with optional filters.

        Args:
            page, limit:   Pagination.
            search:        Full-text search on full_name and email.
            open_to_work:  Filter by job-seeking status.
            location:      Filter by location (ILIKE).

        Returns:
            (items, total) tuple.
        """
        query = (
            db.session.query(Candidate)
            .filter(Candidate.is_active == True)  # noqa: E712
        )

        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Candidate.full_name.ilike(pattern),
                    Candidate.email.ilike(pattern),
                    Candidate.headline.ilike(pattern),
                )
            )

        if open_to_work is not None:
            query = query.filter(Candidate.open_to_work == open_to_work)

        if location:
            query = query.filter(Candidate.location.ilike(f"%{location.strip()}%"))

        total = query.count()
        items = (
            query
            .order_by(Candidate.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return items, total

    def get_with_resumes(self, candidate_id: str) -> Candidate | None:
        """Fetch candidate with resumes eagerly loaded."""
        from sqlalchemy.orm import joinedload
        return (
            db.session.query(Candidate)
            .options(joinedload(Candidate.resumes))
            .filter(Candidate.id == candidate_id)
            .first()
        )
