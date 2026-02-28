"""
app/services/explainability_engine.py

Explainability engine — converts score components into human-readable
improvement tips, skill gap analysis, and hiring recommendations.

Two tiers:
  1. Rule-based (always available):
       Generates tips from score components + skill breakdown.
       Deterministic — same input → same output.
  2. LLM-enhanced (optional):
       Wraps rule-based output with a Groq-generated narrative summary.
       If GroqService is unavailable, falls back to tier 1.

Output structure (ExplanationResult):
  - summary:                    str  — Plain English match explanation
  - matched_skills:             list — Skills in both resume and job
  - missing_skills:             list — Job requirements not on resume
  - extra_skills:               list — Resume skills beyond job requirements
  - improvement_tips:           list — [{priority, category, tip}]
  - hiring_recommendation:      str  — strong_yes | yes | maybe | no
  - recommendation_reason:      str
  - score_breakdown:            dict — The raw score components

Usage:
    from app.services.explainability_engine import ExplainabilityEngine
    from app.services.keyword_matcher import KeywordMatcherService
    from app.services.groq_service import GroqService

    engine = ExplainabilityEngine(groq_service=groq_svc)
    result = engine.explain(
        final_score=0.72,
        semantic_score=0.68,
        keyword_score=0.75,
        experience_score=0.80,
        section_quality_score=0.65,
        resume_skills=["python", "flask"],
        job_title="Backend Developer",
        job_required_skills=["python", "flask", "react"],
        job_nice_to_have_skills=["docker"],
        candidate_years=4.0,
        required_years=3.0,
        missing_sections=["has_certifications"],
        use_llm=True,
    )
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Result dataclass
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ExplanationResult:
    """Full explainability output for an ATS score."""
    summary:              str = ""
    matched_skills:       list = field(default_factory=list)
    missing_skills:       list = field(default_factory=list)
    extra_skills:         list = field(default_factory=list)
    improvement_tips:     list = field(default_factory=list)
    hiring_recommendation: str = "maybe"
    recommendation_reason: str = ""
    score_breakdown:      dict = field(default_factory=dict)
    llm_enhanced:         bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Tip templates
# ─────────────────────────────────────────────────────────────────────────────

_SECTION_TIPS = {
    "has_skills":         ("high",   "formatting",   "Add a dedicated Technical Skills section listing your programming languages, frameworks, and tools."),
    "has_experience":     ("high",   "experience",   "Add your work experience with company names, job titles, and date ranges."),
    "has_education":      ("medium", "education",    "Include your educational background (degrees, institutions, graduation years)."),
    "has_summary":        ("medium", "formatting",   "Add a 2-3 sentence professional summary at the top of your resume."),
    "has_certifications": ("low",    "skills",       "Consider adding relevant certifications (AWS, Google Cloud, etc.) to strengthen your profile."),
    "has_projects":       ("low",    "experience",   "Add a Projects section showcasing personal or open-source work."),
    "sufficient_length":  ("high",   "formatting",   "Your resume appears sparse. Add more detail to your experience and skills sections."),
}

_SCORE_TIPS = {
    "low_semantic": ("high",   "skills",     "Tailor your resume language to match the job description more closely."),
    "low_keyword":  ("high",   "skills",     "Incorporate more keywords from the job posting into your resume."),
    "low_exp":      ("medium", "experience", "Your experience level may be below the job requirement. Highlight any relevant project experience."),
    "low_quality":  ("medium", "formatting", "Improve your resume structure by adding missing sections."),
}


class ExplainabilityEngine:
    """
    Produces human-readable explanations for ATS scores.

    Args:
        groq_service: Optional GroqService for LLM-enhanced narratives.
        keyword_matcher: Optional KeywordMatcherService for skill breakdown.
    """

    def __init__(self, groq_service=None, keyword_matcher=None):
        self._groq = groq_service
        self._kwm  = keyword_matcher

    def explain(
        self,
        final_score: float,
        semantic_score: float,
        keyword_score: float,
        experience_score: float,
        section_quality_score: float,
        resume_skills: list[str],
        job_title: str,
        job_required_skills: list[str],
        job_nice_to_have_skills: Optional[list[str]] = None,
        candidate_years: float = 0.0,
        required_years: float = 0.0,
        missing_sections: Optional[list[str]] = None,
        use_llm: bool = True,
        weights: Optional[dict] = None,
    ) -> ExplanationResult:
        """
        Generate full explanation for a score.

        Args:
            final_score:            Weighted ATS final score (0–1).
            semantic_score:         Semantic similarity score (0–1).
            keyword_score:          BM25 keyword match score (0–1).
            experience_score:       Experience fit score (0–1).
            section_quality_score:  Resume completeness score (0–1).
            resume_skills:          Extracted resume skills.
            job_title:              Job title.
            job_required_skills:    Required skills.
            job_nice_to_have_skills: Nice-to-have skills.
            candidate_years:        Candidate experience years.
            required_years:         Required experience years.
            missing_sections:       Sections below threshold from quality scorer.
            use_llm:                Whether to call GroqService if available.
            weights:                Weights dict used for this score.

        Returns:
            ExplanationResult
        """
        nice_to_have = job_nice_to_have_skills or []
        missing_secs  = missing_sections or []

        # ── Skill breakdown ───────────────────────────────────────────────────
        if self._kwm:
            breakdown = self._kwm.get_skill_breakdown(
                resume_skills, job_required_skills, nice_to_have
            )
        else:
            resume_set  = {s.lower() for s in resume_skills}
            job_set     = {s.lower() for s in job_required_skills + nice_to_have}
            req_set     = {s.lower() for s in job_required_skills}
            breakdown = {
                "matched": sorted(resume_set & job_set),
                "missing": sorted(req_set - resume_set),
                "extra":   sorted((resume_set - job_set))[:10],
            }

        # ── Rule-based tips ───────────────────────────────────────────────────
        tips = self._build_tips(
            semantic_score, keyword_score, experience_score,
            section_quality_score, missing_secs, breakdown["missing"]
        )

        # ── Hiring recommendation ─────────────────────────────────────────────
        recommendation, reason = self._hiring_recommendation(
            final_score, experience_score, len(breakdown["missing"]),
            len(job_required_skills), candidate_years, required_years
        )

        # ── Score breakdown dict ──────────────────────────────────────────────
        score_breakdown = {
            "final":           round(final_score, 4),
            "semantic":        round(semantic_score, 4),
            "keyword":         round(keyword_score, 4),
            "experience":      round(experience_score, 4),
            "section_quality": round(section_quality_score, 4),
            "weights":         weights or {},
        }

        result = ExplanationResult(
            summary="",
            matched_skills=breakdown["matched"],
            missing_skills=breakdown["missing"],
            extra_skills=breakdown["extra"],
            improvement_tips=tips,
            hiring_recommendation=recommendation,
            recommendation_reason=reason,
            score_breakdown=score_breakdown,
            llm_enhanced=False,
        )

        # ── LLM-enhanced summary ──────────────────────────────────────────────
        if use_llm and self._groq and self._groq.available:
            try:
                llm_result = self._groq.explain_score(
                    job_title=job_title,
                    job_required_skills=job_required_skills,
                    candidate_skills=resume_skills,
                    matched_skills=breakdown["matched"],
                    missing_skills=breakdown["missing"],
                    final_score=final_score,
                    experience_score=experience_score,
                    semantic_score=semantic_score,
                )
                result.summary = llm_result.get("summary", "")
                # Merge LLM tips with rule-based tips (LLM first)
                llm_tips = llm_result.get("improvement_tips", [])
                result.improvement_tips = (llm_tips + tips)[:8]
                result.hiring_recommendation = llm_result.get(
                    "hiring_recommendation", recommendation
                )
                result.recommendation_reason = llm_result.get(
                    "recommendation_reason", reason
                )
                result.llm_enhanced = True
            except Exception as exc:
                logger.warning("LLM explanation failed, using rule-based: %s", exc)

        # Fallback summary if LLM didn't run
        if not result.summary:
            result.summary = self._rule_based_summary(
                final_score, len(breakdown["matched"]),
                len(breakdown["missing"]), candidate_years, required_years
            )

        return result

    # ── Rule-based helpers ────────────────────────────────────────────────────

    def _build_tips(
        self,
        semantic_score: float,
        keyword_score: float,
        experience_score: float,
        section_quality_score: float,
        missing_sections: list[str],
        missing_skills: list[str],
    ) -> list[dict]:
        """Build rule-based improvement tips."""
        tips: list[dict] = []

        # Low-score tips
        if keyword_score < 0.40:
            p, c, t = _SCORE_TIPS["low_keyword"]
            tips.append({"priority": p, "category": c, "tip": t})
        if semantic_score < 0.40:
            p, c, t = _SCORE_TIPS["low_semantic"]
            tips.append({"priority": p, "category": c, "tip": t})
        if experience_score < 0.50:
            p, c, t = _SCORE_TIPS["low_exp"]
            tips.append({"priority": p, "category": c, "tip": t})

        # Missing section tips (ordered by weight)
        section_order = [
            "has_skills", "has_experience", "has_education",
            "has_summary", "has_certifications", "has_projects", "sufficient_length"
        ]
        for section in section_order:
            if section in missing_sections:
                p, c, t = _SECTION_TIPS[section]
                tips.append({"priority": p, "category": c, "tip": t})

        # Missing skills tip
        if missing_skills:
            top_missing = ", ".join(missing_skills[:5])
            tips.append({
                "priority": "high",
                "category": "skills",
                "tip": f"Add these required skills to your resume if you have them: {top_missing}.",
            })

        return tips[:8]  # Cap at 8 tips

    @staticmethod
    def _hiring_recommendation(
        final_score: float,
        experience_score: float,
        missing_skill_count: int,
        required_skill_count: int,
        candidate_years: float,
        required_years: float,
    ) -> tuple[str, str]:
        """Derive hiring recommendation from score components."""
        if final_score >= 0.75 and experience_score >= 0.70:
            return "strong_yes", "Strong match across skills, experience, and semantic alignment."
        if final_score >= 0.60:
            return "yes", "Good overall match with minor gaps."
        if final_score >= 0.45:
            return "maybe", "Partial match — candidate may need to demonstrate key skills in interview."
        return "no", "Significant skill or experience gap for this role."

    @staticmethod
    def _rule_based_summary(
        final_score: float,
        matched_skill_count: int,
        missing_skill_count: int,
        candidate_years: float,
        required_years: float,
    ) -> str:
        """Generate a concise rule-based summary string."""
        pct = f"{final_score:.0%}"
        skill_note = (
            f"matches {matched_skill_count} required skills"
            if matched_skill_count > 0
            else "has limited skill overlap"
        )
        missing_note = (
            f" and is missing {missing_skill_count} required skills"
            if missing_skill_count > 0
            else ""
        )
        exp_note = ""
        if required_years > 0:
            if candidate_years >= required_years:
                exp_note = f" Experience level meets the {required_years:.0f}-year requirement."
            else:
                exp_note = (
                    f" Candidate has {candidate_years:.1f} years vs "
                    f"{required_years:.0f} years required."
                )
        return (
            f"Overall match score: {pct}. Candidate {skill_note}{missing_note}.{exp_note}"
        )