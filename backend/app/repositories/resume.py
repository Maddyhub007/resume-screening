
"""
app/repositories/resume.py — Resume-specific data access methods.
"""

import logging

from app.core.database import db
from app.models.enums import ParseStatus
from app.models.resume import Resume
from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class ResumeRepository(BaseRepository[Resume]):
    """Repository for Resume model."""

    model = Resume

    def list_by_candidate(
        self,
        candidate_id: str,
        active_only: bool = False,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[Resume], int]:
        """All resumes for a candidate, newest first."""
        query = (
            db.session.query(Resume)
            .filter(Resume.candidate_id == candidate_id, Resume.is_deleted == False)  # noqa: E712
        )
        if active_only:
            query = query.filter(Resume.is_active == True)  # noqa: E712

        total = query.count()
        items = (
            query
            .order_by(Resume.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return items, total

    def get_active_resume(self, candidate_id: str) -> Resume | None:
        """Get the most recent active parsed resume for a candidate."""
        return (
            db.session.query(Resume)
            .filter(
                Resume.candidate_id == candidate_id,
                Resume.is_active == True,            # noqa: E712
                Resume.is_deleted == False,          # noqa: E712
                Resume.parse_status == ParseStatus.SUCCESS,
            )
            .order_by(Resume.created_at.desc())
            .first()
        )

    def list_pending_parse(self, limit: int = 10) -> list[Resume]:
        """Fetch resumes awaiting parsing — used by background worker."""
        return (
            db.session.query(Resume)
            .filter(
                Resume.parse_status == ParseStatus.PENDING,
                Resume.is_deleted == False,  # noqa: E712
            )
            .order_by(Resume.created_at.asc())  # FIFO
            .limit(limit)
            .all()
        )

    def mark_parse_success(self, resume: Resume) -> Resume:
        """Update status to SUCCESS after successful parse."""
        resume.parse_status    = ParseStatus.SUCCESS
        resume.parse_error_msg = None
        db.session.add(resume)
        return resume

    def mark_parse_failed(self, resume: Resume, reason: str) -> Resume:
        """Update status to FAILED with error message."""
        resume.parse_status    = ParseStatus.FAILED
        resume.parse_error_msg = reason[:2000]  # Truncate if very long
        db.session.add(resume)
        return resume

    def deactivate_previous(self, candidate_id: str, exclude_id: str | None = None) -> None:
        query = db.session.query(Resume).filter(
            Resume.candidate_id == candidate_id,
            Resume.is_deleted == False,   # noqa: E712
        )
        if exclude_id:
            query = query.filter(Resume.id != exclude_id)  # ← exclude current resume
        
        query.update(
            {Resume.is_active: False},
            synchronize_session=False,
        )
