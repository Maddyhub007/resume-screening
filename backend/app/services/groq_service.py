"""
app/services/groq_service.py

Groq LLM client with structured JSON prompts, retry logic, and
graceful degradation when the API key is absent or unavailable.

Design decisions:
  - All prompts request JSON output.  The response parser strips any
    markdown fences before parsing to handle imperfect model output.
  - Retry: up to 3 attempts with exponential backoff (1s, 2s, 4s).
  - available flag: callers can check before calling to decide whether
    to show LLM-powered features in the UI.
  - Prompt templates are class-level constants — easy to audit and tune.
  - Token budgets are conservative (default 1024) since all responses
    are structured JSON, not prose.

Usage:
    from app.services.groq_service import GroqService
    svc = GroqService(api_key="gsk_...", model="llama-3.1-8b-instant")
    result = svc.analyse_resume(raw_text, skills, experience)
    result = svc.generate_job_posting(title, requirements)
    result = svc.explain_score(resume_data, job_data, score_breakdown)
"""

import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

_RETRY_DELAYS = (1.0, 2.0, 4.0)  # seconds between retries


class GroqService:
    """
    Thin Groq client for structured LLM calls used by the ATS platform.

    All public methods return plain Python dicts parsed from model JSON.
    They never raise on API failure — they return a structured error dict
    and log the failure, so callers can degrade gracefully.
    """

    def __init__(
        self,
        api_key: str = "",
        model: str = "llama-3.1-8b-instant",
        max_tokens: int = 1024,
        temperature: float = 0.3,
        timeout: int = 30,
    ):
        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.timeout = timeout
        self._client: Any = None
        self.available = False
        self._init_client()

    # ── Initialisation ────────────────────────────────────────────────────────

    def _init_client(self) -> None:
        if not self.api_key:
            logger.info("GROQ_API_KEY not set — LLM features disabled.")
            return
        try:
            from groq import Groq
            self._client = Groq(api_key=self.api_key, timeout=self.timeout)
            self.available = True
            logger.info("Groq client initialised (model=%s).", self.model)
        except ImportError:
            logger.warning("groq package not installed — LLM features disabled.")
        except Exception as exc:
            logger.error("Failed to initialise Groq client: %s", exc)

    # ── Core completion ───────────────────────────────────────────────────────

    def _complete(self, system: str, user: str) -> str | None:
        """
        Send a chat completion request with retry.

        Returns:
            Raw model string (may include markdown fences) or None on failure.
        """
        if not self.available or self._client is None:
            return None

        for attempt, delay in enumerate((*_RETRY_DELAYS, None), start=1):
            try:
                response = self._client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user",   "content": user},
                    ],
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                )
                return response.choices[0].message.content
            except Exception as exc:
                logger.warning(
                    "Groq attempt %d/%d failed: %s",
                    attempt, len(_RETRY_DELAYS) + 1, exc
                )
                if delay is not None:
                    time.sleep(delay)

        logger.error("All Groq retries exhausted.")
        return None

    @staticmethod
    def _parse_json(raw: str | None, fallback: dict) -> dict:
        """
        Parse JSON from a model response, stripping markdown fences.

        Returns fallback dict on any parse failure.
        """
        if not raw:
            return fallback
        clean = raw.strip()
        # Strip ```json ... ``` or ``` ... ``` fences
        if clean.startswith("```"):
            lines = clean.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            clean = "\n".join(lines).strip()
        try:
            result = json.loads(clean)
            return result if isinstance(result, dict) else fallback
        except (json.JSONDecodeError, TypeError) as exc:
            logger.debug("JSON parse failed (%s) for: %s...", exc, raw[:200])
            return fallback

    # ── Resume analysis ───────────────────────────────────────────────────────

    _RESUME_ANALYSIS_SYSTEM = """You are a professional resume analyst and career advisor.
Analyse the provided resume data and return a JSON object with exactly these keys:
{
  "summary": "2-3 sentence professional summary of the candidate",
  "strengths": ["list", "of", "3-5", "key", "strengths"],
  "issues": [
    {"type": "missing_section|weak_content|formatting|gap", "description": "issue detail", "severity": "high|medium|low"}
  ],
  "role_suggestions": [
    {"title": "Job Title", "reason": "why this fits", "confidence": 0.85}
  ],
  "improvement_tips": [
    {"category": "skills|experience|education|formatting", "tip": "actionable improvement"}
  ]
}
Return ONLY valid JSON. No markdown, no preamble."""

    def analyse_resume(
        self,
        raw_text: str,
        skills: list[str],
        experience_years: float,
        education: list[dict],
    ) -> dict:
        """
        Analyse a resume and return structured insights.

        Args:
            raw_text:         Full resume text.
            skills:           Extracted skills list.
            experience_years: Computed total experience.
            education:        Parsed education entries.

        Returns:
            Dict with keys: summary, strengths, issues, role_suggestions,
            improvement_tips.
        """
        user_prompt = f"""Analyse this resume:

SKILLS: {', '.join(skills[:30]) if skills else 'none extracted'}
EXPERIENCE YEARS: {experience_years}
EDUCATION: {json.dumps(education[:3]) if education else '[]'}

RESUME TEXT (first 3000 chars):
{raw_text[:3000] if raw_text else 'No text extracted'}

Return the analysis JSON."""

        fallback = {
            "summary": "Resume analysis unavailable.",
            "strengths": [],
            "issues": [],
            "role_suggestions": [],
            "improvement_tips": [],
        }

        raw = self._complete(self._RESUME_ANALYSIS_SYSTEM, user_prompt)
        return self._parse_json(raw, fallback)

    # ── Smart job posting ─────────────────────────────────────────────────────

    _JOB_ENHANCEMENT_SYSTEM = """You are a recruitment expert who writes compelling, inclusive job postings.
Enhance the provided job data and return a JSON object with exactly these keys:
{
  "enhanced_description": "Improved 3-paragraph job description",
  "required_skills": ["clean", "normalized", "skill", "list"],
  "nice_to_have_skills": ["bonus", "skills"],
  "responsibilities": ["clear", "action-oriented", "responsibility"],
  "quality_score": 0.85,
  "completeness_score": 0.90,
  "suggestions": ["list", "of", "improvements", "made"]
}
Return ONLY valid JSON. No markdown, no preamble."""

    def enhance_job_posting(
        self,
        title: str,
        description: str,
        required_skills: list[str],
        experience_years: float,
        location: str,
    ) -> dict:
        """
        Enhance a job posting with improved description and structured data.

        Returns:
            Dict with enhanced_description, required_skills, nice_to_have_skills,
            responsibilities, quality_score, completeness_score, suggestions.
        """
        user_prompt = f"""Enhance this job posting:

TITLE: {title}
LOCATION: {location}
EXPERIENCE REQUIRED: {experience_years} years
CURRENT REQUIRED SKILLS: {', '.join(required_skills[:20]) if required_skills else 'not specified'}

CURRENT DESCRIPTION:
{description[:2000]}

Improve this posting, normalise skills, add missing sections, and score quality."""

        fallback = {
            "enhanced_description": description,
            "required_skills": required_skills,
            "nice_to_have_skills": [],
            "responsibilities": [],
            "quality_score": 0.5,
            "completeness_score": 0.5,
            "suggestions": ["LLM enhancement unavailable."],
        }

        raw = self._complete(self._JOB_ENHANCEMENT_SYSTEM, user_prompt)
        return self._parse_json(raw, fallback)

    # ── Score explanation ─────────────────────────────────────────────────────

    _EXPLANATION_SYSTEM = """You are an ATS (Applicant Tracking System) explainability engine.
Given a resume-job match score breakdown, write a clear explanation and targeted tips.
Return a JSON object with exactly these keys:
{
  "summary": "2-3 sentence plain-English explanation of the overall match quality",
  "improvement_tips": [
    {"priority": "high|medium|low", "category": "skills|experience|education|formatting", "tip": "specific actionable advice"}
  ],
  "hiring_recommendation": "strong_yes|yes|maybe|no",
  "recommendation_reason": "1 sentence reason for the hiring recommendation"
}
Return ONLY valid JSON. No markdown, no preamble."""

    def explain_score(
        self,
        job_title: str,
        job_required_skills: list[str],
        candidate_skills: list[str],
        matched_skills: list[str],
        missing_skills: list[str],
        final_score: float,
        experience_score: float,
        semantic_score: float,
    ) -> dict:
        """
        Generate a natural-language explanation for an ATS score.

        Returns:
            Dict with summary, improvement_tips, hiring_recommendation,
            recommendation_reason.
        """
        user_prompt = f"""Explain this ATS match score:

JOB TITLE: {job_title}
REQUIRED SKILLS: {', '.join(job_required_skills[:15])}
CANDIDATE SKILLS: {', '.join(candidate_skills[:20])}
MATCHED SKILLS: {', '.join(matched_skills[:15])}
MISSING SKILLS: {', '.join(missing_skills[:15])}
FINAL SCORE: {final_score:.2f} (0=no match, 1=perfect)
EXPERIENCE SCORE: {experience_score:.2f}
SEMANTIC SCORE: {semantic_score:.2f}

Provide explanation and actionable tips."""

        fallback = {
            "summary": f"Match score: {final_score:.0%}. Score explanation unavailable.",
            "improvement_tips": [],
            "hiring_recommendation": "maybe" if final_score >= 0.5 else "no",
            "recommendation_reason": "Based on score alone without LLM analysis.",
        }

        raw = self._complete(self._EXPLANATION_SYSTEM, user_prompt)
        return self._parse_json(raw, fallback)

    # ── Role suggestions ──────────────────────────────────────────────────────

    _ROLE_SUGGESTION_SYSTEM = """You are a career counsellor with expertise in tech and professional roles.
Based on the candidate's skills and experience, suggest relevant job titles.
Return a JSON object with exactly this key:
{
  "suggestions": [
    {"title": "Job Title", "match_score": 0.85, "reason": "why this fits in 1 sentence", "seniority": "junior|mid|senior|lead"}
  ]
}
Return up to 5 suggestions. Return ONLY valid JSON. No markdown, no preamble."""

    def suggest_roles(
        self,
        skills: list[str],
        experience_years: float,
        education: list[dict],
        summary: str = "",
    ) -> dict:
        """
        Suggest job titles that match a candidate's profile.

        Returns:
            Dict with key 'suggestions' — list of role dicts.
        """
        user_prompt = f"""Suggest job titles for this candidate:

SKILLS: {', '.join(skills[:30]) if skills else 'not provided'}
EXPERIENCE: {experience_years} years
EDUCATION: {json.dumps(education[:2]) if education else '[]'}
SUMMARY: {summary[:500] if summary else 'not provided'}

Return 4-5 relevant job title suggestions with match scores."""

        fallback = {"suggestions": []}
        raw = self._complete(self._ROLE_SUGGESTION_SYSTEM, user_prompt)
        return self._parse_json(raw, fallback)

    def __repr__(self) -> str:
        status = "available" if self.available else "unavailable"
        return f"GroqService(model={self.model!r}, status={status})"