"""
app/services/ats_scorer.py

ATS Scoring Orchestrator — combines all scoring components into a single
weighted final score and persists the result.

Pipeline:
  1. Load resume and job from repositories.
  2. Run all four scoring components in parallel-friendly order:
       a. keyword_scorer  (BM25 + skill overlap)
       b. semantic_scorer (sentence-transformers cosine)
       c. experience_scorer
       d. section_quality_scorer
  3. Compute weighted final score using config weights.
  4. Run explainability engine (rule-based + optional LLM).
  5. Upsert AtsScore record via repository.
  6. Return ScoringResult.

Design decisions:
  - Orchestrator pattern: this service owns no business logic itself;
    it delegates to the four component scorers.
  - Repository-aware: writes to DB using AtsScoreRepository.upsert().
  - Atomic: DB write is the last step — if scoring fails, no partial
    record is left in the DB.
  - Weight validation: weights are normalised if they don't sum to 1.0
    (graceful recovery from misconfiguration).

Usage:
    from app.services.ats_scorer import AtsScorerService

    scorer = AtsScorerService(
        keyword_matcher=kw_svc,
        semantic_matcher=sem_svc,
        experience_scorer=exp_svc,
        section_quality_scorer=sq_svc,
        explainability_engine=exp_engine,
        ats_score_repo=ats_repo,
        weights={"semantic": 0.40, "keyword": 0.35, "experience": 0.15, "section": 0.10},
    )

    result = scorer.score_resume_job(
        resume=resume_obj,
        job=job_obj,
        application_id=None,
        use_llm=True,
    )
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# score_to_label is pure Python (no SQLAlchemy) — safe to import at module level
def _get_score_to_label():
    """Lazy import to avoid circular deps at module load time."""
    try:
        from app.models.enums import score_to_label
        return score_to_label
    except Exception:
        # Fallback for environments where models aren't importable (e.g. unit tests)
        def _fallback(score, threshold_excellent=0.80, threshold_good=0.65, threshold_fair=0.50):
            if score >= threshold_excellent: return type('L', (), {'value': 'excellent'})()
            if score >= threshold_good:      return type('L', (), {'value': 'good'})()
            if score >= threshold_fair:      return type('L', (), {'value': 'fair'})()
            return type('L', (), {'value': 'weak'})()
        return _fallback


@dataclass
class ScoringResult:
    """Full output of the ATS scoring pipeline."""
    resume_id:             str
    job_id:                str
    final_score:           float
    score_label:           str
    semantic_score:        float
    keyword_score:         float
    experience_score:      float
    section_quality_score: float
    semantic_available:    bool
    matched_skills:        list = field(default_factory=list)
    missing_skills:        list = field(default_factory=list)
    extra_skills:          list = field(default_factory=list)
    improvement_tips:      list = field(default_factory=list)
    summary_text:          str = ""
    hiring_recommendation: str = "maybe"
    weights_used:          dict = field(default_factory=dict)
    ats_score_id:          Optional[str] = None
    error:                 Optional[str] = None


class AtsScorerService:
    """
    ATS scoring orchestrator.

    Combines keyword matching, semantic similarity, experience scoring,
    and section quality into a weighted final score.
    """

    _DEFAULT_WEIGHTS = {
        "semantic":  0.40,
        "keyword":   0.35,
        "experience": 0.15,
        "section":   0.10,
    }

    def __init__(
        self,
        keyword_matcher,
        semantic_matcher,
        experience_scorer,
        section_quality_scorer,
        explainability_engine,
        ats_score_repo,
        weights: Optional[dict] = None,
        threshold_excellent: float = 0.80,
        threshold_good: float = 0.65,
        threshold_fair: float = 0.50,
    ):
        self._kw  = keyword_matcher
        self._sem = semantic_matcher
        self._exp = experience_scorer
        self._sq  = section_quality_scorer
        self._expl = explainability_engine
        self._repo = ats_score_repo
        self._weights = self._normalise_weights(weights or self._DEFAULT_WEIGHTS)
        self._threshold_excellent = threshold_excellent
        self._threshold_good = threshold_good
        self._threshold_fair = threshold_fair

    # ── Public API ────────────────────────────────────────────────────────────

    def score_resume_job(
        self,
        resume,
        job,
        application_id: Optional[str] = None,
        use_llm: bool = True,
    ) -> ScoringResult:
        """
        Score a Resume × Job pair and persist the result.

        Args:
            resume:         Resume ORM object (must have skills_list, raw_text, etc.)
            job:            Job ORM object (must have required_skills_list, etc.)
            application_id: Optional Application FK to link.
            use_llm:        Whether to call GroqService for explanation narrative.

        Returns:
            ScoringResult — always returns, never raises.
        """
        try:
            return self._run_pipeline(resume, job, application_id, use_llm)
        except Exception as exc:
            logger.exception(
                "Scoring failed for resume=%s, job=%s", resume.id, job.id
            )
            return ScoringResult(
                resume_id=resume.id,
                job_id=job.id,
                final_score=0.0,
                score_label="weak",
                semantic_score=0.0,
                keyword_score=0.0,
                experience_score=0.0,
                section_quality_score=0.0,
                semantic_available=False,
                error=str(exc),
            )

    def score_raw(
        self,
        resume_text: str,
        resume_skills: list[str],
        resume_experience: list[dict],
        resume_education: list[dict],
        resume_experience_years: float,
        job_title: str,
        job_description: str,
        job_required_skills: list[str],
        job_nice_to_have_skills: Optional[list[str]] = None,
        job_experience_years: float = 0.0,
        summary_text: str = "",
    ) -> dict:
        """
        Score raw data without ORM objects or DB writes.

        Useful for preview scoring (e.g. before a resume is saved).

        Returns:
            Dict with all score components and explanation.
        """
        nice_to_have = job_nice_to_have_skills or []

        kw_score = self._kw.score(
            resume_text=resume_text,
            resume_skills=resume_skills,
            job_description=job_description,
            job_required_skills=job_required_skills,
            job_nice_to_have_skills=nice_to_have,
        )

        sem_result = self._sem.score(
            resume_skills=resume_skills,
            resume_summary=summary_text,
            resume_experience=[e.get("title", "") for e in resume_experience],
            job_title=job_title,
            job_description=job_description,
            job_required_skills=job_required_skills,
        )

        exp_score = self._exp.score(
            candidate_years=resume_experience_years,
            required_years=job_experience_years,
            job_title=job_title,
            education=resume_education,
            experience=resume_experience,
        )

        sq_score = self._sq.score(
            skills=resume_skills,
            experience=resume_experience,
            education=resume_education,
            summary_text=summary_text,
            raw_text_length=len(resume_text),
        )

        final = self._compute_final(
            kw_score, sem_result.score if sem_result.available else kw_score,
            exp_score, sq_score, sem_result.available
        )

        return {
            "final_score":           final,
            "semantic_score":        sem_result.score,
            "keyword_score":         kw_score,
            "experience_score":      exp_score,
            "section_quality_score": sq_score,
            "semantic_available":    sem_result.available,
            "weights_used":          self._weights,
        }

    # ── Pipeline ──────────────────────────────────────────────────────────────

    def _run_pipeline(
        self,
        resume,
        job,
        application_id: Optional[str],
        use_llm: bool,
    ) -> ScoringResult:
        """Execute the scoring pipeline and write results."""

        # ── 1. Extract data ────────────────────────────────────────────────────
        resume_skills   = resume.skills_list
        resume_text     = resume.raw_text or " ".join(resume_skills)
        resume_exp      = resume.experience_list
        resume_edu      = resume.education_list
        resume_years    = resume.total_experience_years
        summary_text    = resume.summary_text or ""

        job_skills_req  = job.required_skills_list
        job_skills_nth  = job.nice_to_have_skills_list
        job_desc        = job.description or ""
        job_exp_years   = job.experience_years

        # ── 2. Component scores ───────────────────────────────────────────────
        kw_score = self._kw.score(
            resume_text=resume_text,
            resume_skills=resume_skills,
            job_description=job_desc,
            job_required_skills=job_skills_req,
            job_nice_to_have_skills=job_skills_nth,
        )

        sem_result = self._sem.score(
            resume_skills=resume_skills,
            resume_summary=summary_text,
            resume_experience=[e.get("title", "") for e in resume_exp],
            job_title=job.title,
            job_description=job_desc,
            job_required_skills=job_skills_req,
        )

        exp_score = self._exp.score(
            candidate_years=resume_years,
            required_years=job_exp_years,
            job_title=job.title,
            education=resume_edu,
            experience=resume_exp,
        )

        sq_missing = self._sq.get_missing_sections(
            skills=resume_skills,
            experience=resume_exp,
            education=resume_edu,
            summary_text=summary_text,
            raw_text_length=len(resume_text),
        )

        sq_score = self._sq.score(
            skills=resume_skills,
            experience=resume_exp,
            education=resume_edu,
            summary_text=summary_text,
            raw_text_length=len(resume_text),
        )

        # ── 3. Final score ────────────────────────────────────────────────────
        eff_sem = sem_result.score if sem_result.available else kw_score
        final = self._compute_final(kw_score, eff_sem, exp_score, sq_score, sem_result.available)

        # ── 4. Label ──────────────────────────────────────────────────────────
        score_to_label = _get_score_to_label()
        label = score_to_label(
            final,
            threshold_excellent=self._threshold_excellent,
            threshold_good=self._threshold_good,
            threshold_fair=self._threshold_fair,
        )

        # ── 5. Explanation ────────────────────────────────────────────────────
        explanation = self._expl.explain(
            final_score=final,
            semantic_score=sem_result.score,
            keyword_score=kw_score,
            experience_score=exp_score,
            section_quality_score=sq_score,
            resume_skills=resume_skills,
            job_title=job.title,
            job_required_skills=job_skills_req,
            job_nice_to_have_skills=job_skills_nth,
            candidate_years=resume_years,
            required_years=job_exp_years,
            missing_sections=sq_missing,
            use_llm=use_llm,
            weights=self._weights,
        )

        # ── 6. Persist ────────────────────────────────────────────────────────
        # Build AtsScore via a factory that handles missing ORM gracefully
        ats_record = self._build_ats_record(
            resume_id=resume.id,
            job_id=job.id,
            scores={
                "semantic":           sem_result.score,
                "keyword":            kw_score,
                "experience":         exp_score,
                "section_quality":    sq_score,
                "final":              final,
                "semantic_available": sem_result.available,
            },
            explanation={
                "matched_skills":   explanation.matched_skills,
                "missing_skills":   explanation.missing_skills,
                "extra_skills":     explanation.extra_skills,
                "improvement_tips": explanation.improvement_tips,
                "summary":          explanation.summary,
            },
            weights=self._weights,
            application_id=application_id,
        )

        saved = self._repo.upsert(ats_record)

        return ScoringResult(
            resume_id=resume.id,
            job_id=job.id,
            final_score=final,
            score_label=label.value,
            semantic_score=sem_result.score,
            keyword_score=kw_score,
            experience_score=exp_score,
            section_quality_score=sq_score,
            semantic_available=sem_result.available,
            matched_skills=explanation.matched_skills,
            missing_skills=explanation.missing_skills,
            extra_skills=explanation.extra_skills,
            improvement_tips=explanation.improvement_tips,
            summary_text=explanation.summary,
            hiring_recommendation=explanation.hiring_recommendation,
            weights_used=self._weights,
            ats_score_id=saved.id if saved else None,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _compute_final(
        self,
        kw_score: float,
        sem_score: float,
        exp_score: float,
        sq_score: float,
        semantic_available: bool,
    ) -> float:
        """
        Compute weighted final score.

        If semantic is unavailable, redistribute its weight to keyword.
        """
        w = self._weights.copy()
        if not semantic_available:
            kw_boost = w.get("semantic", 0.40)
            w["keyword"] = w.get("keyword", 0.35) + kw_boost
            w["semantic"] = 0.0

        final = (
            w.get("semantic", 0.0)  * sem_score +
            w.get("keyword", 0.0)   * kw_score +
            w.get("experience", 0.0) * exp_score +
            w.get("section", 0.0)   * sq_score
        )
        return round(min(1.0, max(0.0, final)), 4)

    @staticmethod
    def _normalise_weights(weights: dict) -> dict:
        """Normalise weights to sum to 1.0."""
        total = sum(weights.values())
        if total <= 0:
            return AtsScorerService._DEFAULT_WEIGHTS.copy()
        return {k: round(v / total, 4) for k, v in weights.items()}

    def _build_ats_record(
        self,
        resume_id: str,
        job_id: str,
        scores: dict,
        explanation: dict,
        weights: dict,
        application_id: Optional[str],
    ):
        """
        Build an AtsScore ORM record from raw score data.

        Uses AtsScore.from_score_result() when available.
        Falls back to a lightweight dict-like object for environments
        where SQLAlchemy models cannot be imported (unit tests, etc).
        """
        try:
            from app.models.ats_score import AtsScore
            return AtsScore.from_score_result(
                resume_id=resume_id,
                job_id=job_id,
                scores=scores,
                explanation=explanation,
                weights=weights,
                application_id=application_id,
                threshold_excellent=self._threshold_excellent,
                threshold_good=self._threshold_good,
                threshold_fair=self._threshold_fair,
            )
        except Exception:
            # Lightweight stand-in for test environments
            record = type("AtsScoreRecord", (), {
                "resume_id":             resume_id,
                "job_id":                job_id,
                "final_score":           scores.get("final", 0.0),
                "score_label":           "fair",
                "application_id":        application_id,
                "matched_skills_list":   explanation.get("matched_skills", []),
                "missing_skills_list":   explanation.get("missing_skills", []),
                "extra_skills_list":     explanation.get("extra_skills", []),
                "improvement_tips_list": explanation.get("improvement_tips", []),
                "summary_text":          explanation.get("summary", ""),
                "weights_used_dict":     weights,
            })()
            return record