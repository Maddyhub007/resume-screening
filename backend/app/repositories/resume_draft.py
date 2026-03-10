"""
app/repositories/resume_draft.py

ResumeDraft repository — data access for AI builder drafts.

Follows the exact same BaseRepository[T] pattern as every other repository
in this project.  Zero business logic here — pure data access only.
"""

import logging

from app.core.database import db
from app.models.resume_draft import (
    ResumeDraft,
    DRAFT_STATUS_DRAFT,
    DRAFT_STATUS_REFINED,
    DRAFT_STATUS_FINALIZED,
)
from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class ResumeDraftRepository(BaseRepository[ResumeDraft]):
    """Repository for ResumeDraft model."""

    model = ResumeDraft

    # ── Read ──────────────────────────────────────────────────────────────────

    def list_by_candidate(
        self,
        candidate_id: str,
        status: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[ResumeDraft], int]:
        """
        List drafts for a candidate, newest first.

        Args:
            candidate_id: Candidate UUID.
            status:       Optional filter: draft | refined | finalized.
            page, limit:  Pagination (mirrors all other list methods).

        Returns:
            (items, total_count) tuple.
        """
        query = (
            self.base_query()
            .filter(ResumeDraft.candidate_id == candidate_id)
        )
        if status:
            query = query.filter(ResumeDraft.status == status)

        total = query.count()
        items = (
            query
            .order_by(ResumeDraft.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return items, total

    def get_latest_for_job(
        self,
        candidate_id: str,
        job_id: str,
    ) -> ResumeDraft | None:
        """
        Most recent non-finalized draft for a candidate × job pair.

        Used by /refine to find the current working draft without
        requiring the client to track draft IDs explicitly.
        """
        return (
            self.base_query()
            .filter(
                ResumeDraft.candidate_id == candidate_id,
                ResumeDraft.job_id == job_id,
                ResumeDraft.is_finalized == False,   # noqa: E712
            )
            .order_by(ResumeDraft.created_at.desc())
            .first()
        )

    # ── Write ─────────────────────────────────────────────────────────────────

    def create_draft(
        self,
        candidate_id: str,
        job_id: str | None,
        template_id: str,
        user_prompt: str,
    ) -> ResumeDraft:
        """
        Insert a new blank draft row.

        Content and scores are populated by the service after generation.
        Does NOT commit — caller controls the transaction.
        """
        draft = ResumeDraft()
        draft.candidate_id = candidate_id
        draft.job_id       = job_id or None
        draft.template_id  = template_id
        draft.user_prompt  = (user_prompt or "")[:2000]
        db.session.add(draft)
        db.session.flush()   # populate .id
        logger.debug(
            "ResumeDraft created",
            extra={"draft_id": draft.id, "candidate_id": candidate_id},
        )
        return draft

    def write_generation_result(
        self,
        draft: ResumeDraft,
        *,
        content: dict,
        predicted_score: float,
        score_breakdown: dict,
        matched_skills: list,
        missing_skills: list,
        iteration_count: int,
        status: str,
    ) -> ResumeDraft:
        """
        Write generated/refined content and ATS preview scores back to a draft.

        Called after each agent generation or optimisation pass.
        Does NOT commit — caller controls the transaction.
        """
        draft.content_dict         = content
        draft.predicted_score      = round(predicted_score, 4)
        draft.score_breakdown_dict = score_breakdown
        draft.matched_skills_list  = matched_skills
        draft.missing_skills_list  = missing_skills
        draft.iteration_count      = iteration_count
        draft.status               = status
        db.session.add(draft)
        return draft

    def mark_finalized(
        self,
        draft: ResumeDraft,
        resume_id: str,
    ) -> ResumeDraft:
        """
        Mark draft as finalized and record the created Resume.id.

        Called by /save-draft after the Resume row is committed.
        Does NOT commit — caller controls the transaction.
        """
        draft.is_finalized        = True
        draft.status              = DRAFT_STATUS_FINALIZED
        draft.finalized_resume_id = resume_id
        db.session.add(draft)
        logger.info(
            "ResumeDraft finalized",
            extra={"draft_id": draft.id, "resume_id": resume_id},
        )
        return draft

    def record_feedback(
        self,
        draft_id: str,
        feedback: dict,
    ) -> ResumeDraft | None:
        """
        Store recruiter outcome feedback on a finalized draft.

        LEARNING HOOK — this data is written but never read by the current
        scoring engine.  It exists so future adaptive weighting can treat
        it as a training signal without requiring a schema change.

        Args:
            draft_id: ResumeDraft UUID.
            feedback: {shortlisted: bool, interview_stage: str, hired: bool}

        Returns:
            Updated draft, or None if draft_id not found.
        """
        import json as _json
        draft = self.get_by_id(draft_id)
        if not draft:
            return None
        draft.feedback_json = _json.dumps(feedback)
        db.session.add(draft)
        logger.info(
            "ResumeDraft feedback recorded",
            extra={"draft_id": draft_id},
        )
        return draft
