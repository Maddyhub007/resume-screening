"""
app/services/semantic_matcher.py

Semantic similarity scorer using sentence-transformers MiniLM.

Computes cosine similarity between a resume text embedding and a job
description embedding.  This captures semantic relationships that keyword
matching misses (e.g. "built ML pipelines" matching "machine learning
infrastructure engineer").

Score strategy:
  - Encode a condensed resume representation: skills + summary + experience titles.
  - Encode a condensed job representation: title + required skills + description (truncated).
  - Compute cosine similarity of L2-normalised vectors.
  - Apply a sigmoid-like rescaling so mid-range similarity scores spread
    more evenly across [0, 1] (raw cosine often clusters in [0.3, 0.9]).

Graceful degradation:
  - If EmbeddingService is unavailable, returns score=0.0 and
    available=False so the ATS scorer can zero-weight semantic.

Usage:
    from app.services.semantic_matcher import SemanticMatcherService
    from app.services.embedding_service import EmbeddingService

    emb = EmbeddingService.get_instance()
    svc = SemanticMatcherService(embedding_service=emb)

    result = svc.score(
        resume_skills=["python", "flask", "postgresql"],
        resume_summary="Backend Python developer with 5 years...",
        resume_experience=["Backend Engineer at Acme Corp"],
        job_title="Senior Backend Engineer",
        job_description="We build high-throughput APIs...",
        job_required_skills=["python", "sql", "api"],
    )
    # result.score: float in [0.0, 1.0]
    # result.available: bool
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Rescaling constants: map raw cosine in [0.3, 0.95] → [0, 1]
_SIM_LOW  = 0.20
_SIM_HIGH = 0.95


def _rescale(sim: float) -> float:
    """
    Linear rescale from [_SIM_LOW, _SIM_HIGH] to [0.0, 1.0].

    Scores outside the range are clamped.
    This spreads the typical cosine similarity range more evenly.
    """
    if sim <= _SIM_LOW:
        return 0.0
    if sim >= _SIM_HIGH:
        return 1.0
    return (sim - _SIM_LOW) / (_SIM_HIGH - _SIM_LOW)


@dataclass
class SemanticScoreResult:
    """Result of a semantic scoring operation."""
    score: float       # Rescaled cosine similarity in [0.0, 1.0]
    raw_cosine: float  # Raw cosine similarity before rescaling
    available: bool    # False when embedding model was unavailable


class SemanticMatcherService:
    """
    Semantic similarity scorer backed by sentence-transformers.

    Args:
        embedding_service: An EmbeddingService instance (shared singleton).
    """

    def __init__(self, embedding_service):
        self._emb = embedding_service

    @property
    def available(self) -> bool:
        return self._emb.available

    def score(
        self,
        resume_skills: list[str],
        resume_summary: str,
        resume_experience: list[str],
        job_title: str,
        job_description: str,
        job_required_skills: list[str],
        max_text_chars: int = 512,
    ) -> SemanticScoreResult:
        """
        Compute semantic similarity between a resume and a job.

        Args:
            resume_skills:       Extracted resume skills list.
            resume_summary:      Summary/objective text from resume.
            resume_experience:   List of job title strings from experience.
            job_title:           Job posting title.
            job_description:     Full job description.
            job_required_skills: Required skills for the job.
            max_text_chars:      Truncation limit for encoding (keep latency low).

        Returns:
            SemanticScoreResult with score, raw_cosine, available.
        """
        if not self._emb.available:
            return SemanticScoreResult(score=0.0, raw_cosine=0.0, available=False)

        try:
            resume_text = self._build_resume_text(
                resume_skills, resume_summary, resume_experience, max_text_chars
            )
            job_text = self._build_job_text(
                job_title, job_required_skills, job_description, max_text_chars
            )

            resume_vec = self._emb.encode(resume_text)
            job_vec    = self._emb.encode(job_text)

            import numpy as np
            raw_cosine = float(np.dot(resume_vec, job_vec))
            raw_cosine = max(-1.0, min(1.0, raw_cosine))
            rescaled   = _rescale(raw_cosine)

            return SemanticScoreResult(
                score=round(rescaled, 4),
                raw_cosine=round(raw_cosine, 4),
                available=True,
            )

        except Exception as exc:
            logger.error("Semantic scoring error: %s", exc, exc_info=True)
            return SemanticScoreResult(score=0.0, raw_cosine=0.0, available=False)

    def encode_for_cache(self, text: str):
        """
        Encode text for storage / later reuse.

        Returns:
            numpy.ndarray or None if unavailable.
        """
        if not self._emb.available:
            return None
        try:
            return self._emb.encode(text)
        except Exception:
            return None

    # ── Text builders ─────────────────────────────────────────────────────────

    @staticmethod
    def _build_resume_text(
        skills: list[str],
        summary: str,
        experience_titles: list[str],
        max_chars: int,
    ) -> str:
        """
        Concatenate the most semantically rich resume fields into one string.

        Skills are the highest signal; summary and experience titles add context.
        """
        parts = []
        if skills:
            parts.append("Skills: " + ", ".join(skills[:30]))
        if summary:
            parts.append(summary[:200])
        if experience_titles:
            parts.append("Experience: " + " | ".join(experience_titles[:5]))
        text = ". ".join(parts)
        return text[:max_chars]

    @staticmethod
    def _build_job_text(
        title: str,
        required_skills: list[str],
        description: str,
        max_chars: int,
    ) -> str:
        """
        Condense job data into one string for encoding.

        Title + required skills carry most of the semantic signal.
        """
        parts = []
        if title:
            parts.append(title)
        if required_skills:
            parts.append("Required: " + ", ".join(required_skills[:20]))
        if description:
            parts.append(description[:300])
        text = ". ".join(parts)
        return text[:max_chars]