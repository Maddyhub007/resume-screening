
"""
app/repositories/ats_score.py — AtsScore-specific data access methods.
"""

import logging

from sqlalchemy import and_

from app.core.database import db
from app.models.ats_score import AtsScore
from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class AtsScoreRepository(BaseRepository[AtsScore]):
    """Repository for AtsScore model."""

    model = AtsScore

    def get_by_resume_and_job(
        self, resume_id: str, job_id: str
    ) -> AtsScore | None:
        """Fetch existing score for a resume × job pair (unique per pair)."""
        return (
            db.session.query(AtsScore)
            .filter(
                AtsScore.resume_id == resume_id,
                AtsScore.job_id    == job_id,
            )
            .first()
        )

    def upsert(self, score: AtsScore) -> AtsScore:
        """
        Insert a new score or update an existing one for the same resume×job pair.

        If a score already exists for this pair, update it in-place.
        Otherwise insert. Returns the persisted instance.
        """
        existing = self.get_by_resume_and_job(score.resume_id, score.job_id)
        if existing:
            # Update all score fields in place
            existing.semantic_score        = score.semantic_score
            existing.keyword_score         = score.keyword_score
            existing.experience_score      = score.experience_score
            existing.section_quality_score = score.section_quality_score
            existing.final_score           = score.final_score
            existing.score_label           = score.score_label
            existing.semantic_available    = score.semantic_available
            existing.matched_skills        = score.matched_skills
            existing.missing_skills        = score.missing_skills
            existing.extra_skills          = score.extra_skills
            existing.improvement_tips      = score.improvement_tips
            existing.summary_text          = score.summary_text
            existing.weights_used          = score.weights_used
            db.session.add(existing)
            return existing
        else:
            db.session.add(score)
            db.session.flush()
            return score

    def get_top_for_job(
        self,
        job_id: str,
        top_n: int = 10,
        min_score: float = 0.0,
    ) -> list[AtsScore]:
        """
        Return top N scores for a job, ordered by final_score DESC.

        Used by recruiter dashboard — top candidates per job.
        """
        return (
            db.session.query(AtsScore)
            .filter(
                AtsScore.job_id     == job_id,
                AtsScore.final_score >= min_score,
            )
            .order_by(AtsScore.final_score.desc())
            .limit(top_n)
            .all()
        )

    def get_top_for_resume(
        self,
        resume_id: str,
        top_n: int = 10,
    ) -> list[AtsScore]:
        """
        Return top N scores for a resume (job recommendations), highest first.

        Used by the job recommendation dashboard.
        """
        return (
            db.session.query(AtsScore)
            .filter(AtsScore.resume_id == resume_id)
            .order_by(AtsScore.final_score.desc())
            .limit(top_n)
            .all()
        )

    def list_by_job(
        self,
        job_id: str,
        min_score: float | None = None,
        score_label: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[AtsScore], int]:
        """Paginated scores for a job with optional score filters."""
        query = db.session.query(AtsScore).filter(AtsScore.job_id == job_id)

        if min_score is not None:
            query = query.filter(AtsScore.final_score >= min_score)
        if score_label:
            query = query.filter(AtsScore.score_label == score_label)

        total = query.count()
        items = (
            query
            .order_by(AtsScore.final_score.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return items, total