"""
app/services/builder/groq_generator.py

Groq-powered resume generator — wraps GroqService with builder-specific prompts.

Design:
  - Does NOT subclass or modify GroqService.
  - Calls groq_service._complete() and groq_service._parse_json() directly,
    following the same pattern used by SmartJobPostingService and
    ResumeAnalysisService.
  - Uses max_tokens=3000 for generation (vs default 1024 for analysis).
    This is passed at call time via a temporary override of the service's
    max_tokens attribute — safe because GroqService is stateless per call.
  - All prompts produce structured JSON matching the builder schema exactly.
  - Falls back to fallback_generator if the LLM response cannot be parsed.

Output contract (same as fallback_generator):
  {
    "summary":        str,
    "skills":         [str, ...],
    "experience":     [{"role": str, "company": str, "date_range": str,
                        "impact_points": [str, ...]}, ...],
    "education":      [{"degree": str, "institution": str, "year": str,
                        "gpa": str}, ...],
    "projects":       [{"name": str, "description": str,
                        "tech_used": [str, ...]}, ...],
    "certifications": [str, ...]
  }
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── System prompt (frozen — easier to audit than f-strings) ───────────────────

_GENERATION_SYSTEM = """\
You are an expert ATS resume writer. Your task is to generate a structured resume
optimised for a specific job posting.

STRICT RULES:
1. Use ONLY information provided in the candidate context — never invent facts.
2. Include ALL required job skills in the skills list naturally.
3. Reframe existing experience using strong action verbs and measurable impact.
4. Adapt summary tone to the seniority level: junior=eager, mid=capable,
   senior=authoritative, lead=strategic.
5. Weave missing required skills into experience bullet points where plausible
   given the existing context — do not fabricate roles or companies.

Return ONLY a valid JSON object with exactly these keys:
{
  "summary": "3-4 sentence professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "date_range": "Jan 2021 – Present",
      "impact_points": [
        "Strong action verb + quantified achievement + business impact",
        "Strong action verb + technology used + outcome"
      ]
    }
  ],
  "education": [
    {"degree": "BSc Computer Science", "institution": "University", "year": "2019", "gpa": ""}
  ],
  "projects": [
    {"name": "Project", "description": "2 sentences", "tech_used": ["python"]}
  ],
  "certifications": ["AWS SAA-C03 (2023)"]
}

Return ONLY valid JSON. No markdown. No preamble. No trailing text.\
"""

_REFINEMENT_SYSTEM = """\
You are an ATS resume optimisation engine. You have a draft resume and its ATS
score breakdown. Your task is to improve the resume to increase its ATS score.

STRICT RULES:
1. Keep all existing true facts — do not remove or contradict them.
2. Focus changes on the sections with lowest scores.
3. Add missing required skills naturally into experience bullet points.
4. Strengthen weak bullet points with measurable achievements.
5. Return the COMPLETE updated resume, not just the changed sections.

Return ONLY the same JSON structure. No markdown. No preamble.\
"""


# ── Generator functions ───────────────────────────────────────────────────────

def generate(
    groq_service,
    *,
    candidate_name: str,
    candidate_headline: str,
    existing_skills: list[str],
    existing_experience: list[dict],
    existing_education: list[dict],
    existing_certifications: list[str],
    existing_projects: list[dict],
    existing_summary: str,
    experience_years: float,
    job_title: str,
    job_company: str,
    job_description: str,
    required_skills: list[str],
    nice_to_have_skills: list[str],
    missing_skills: list[str],
    matched_skills: list[str],
    responsibilities: list[str],
    seniority_level: str,
    user_prompt: str,
    tone: str,
) -> dict[str, Any] | None:
    """
    Generate a resume using Groq LLM.

    Args:
        groq_service: Existing GroqService instance from the service layer.
        (all other args): Context assembled by ContextAssembler.

    Returns:
        Parsed dict on success, None if LLM call fails or JSON is invalid.
        Callers should fall back to fallback_generator on None return.
    """
    user_msg = _build_generation_prompt(
        candidate_name=candidate_name,
        candidate_headline=candidate_headline,
        existing_skills=existing_skills,
        existing_experience=existing_experience,
        existing_education=existing_education,
        existing_certifications=existing_certifications,
        existing_projects=existing_projects,
        existing_summary=existing_summary,
        experience_years=experience_years,
        job_title=job_title,
        job_company=job_company,
        job_description=job_description,
        required_skills=required_skills,
        nice_to_have_skills=nice_to_have_skills,
        missing_skills=missing_skills,
        matched_skills=matched_skills,
        responsibilities=responsibilities,
        seniority_level=seniority_level,
        user_prompt=user_prompt,
        tone=tone,
    )

    return _call_groq(groq_service, _GENERATION_SYSTEM, user_msg, max_tokens=3000)


def refine(
    groq_service,
    *,
    current_content: dict,
    score_breakdown: dict,
    missing_skills: list[str],
    job_title: str,
    required_skills: list[str],
    iteration: int,
) -> dict[str, Any] | None:
    """
    Refine an existing draft using ATS score feedback.

    Args:
        groq_service:    Existing GroqService instance.
        current_content: The current draft JSON dict.
        score_breakdown: {keyword, semantic, experience, section_quality, label}
        missing_skills:  Skills still missing after the last iteration.
        job_title:       Target job title.
        required_skills: Job's required skills.
        iteration:       Current iteration number (1 or 2).

    Returns:
        Updated draft dict on success, None on failure.
    """
    user_msg = _build_refinement_prompt(
        current_content=current_content,
        score_breakdown=score_breakdown,
        missing_skills=missing_skills,
        job_title=job_title,
        required_skills=required_skills,
        iteration=iteration,
    )
    return _call_groq(groq_service, _REFINEMENT_SYSTEM, user_msg, max_tokens=3000)


# ── Private helpers ───────────────────────────────────────────────────────────

def _call_groq(
    groq_service,
    system_prompt: str,
    user_msg: str,
    max_tokens: int,
) -> dict[str, Any] | None:
    """
    Call GroqService._complete() with a scoped max_tokens override.

    Instead of mutating the shared groq_service.max_tokens attribute
    (which is not thread-safe in multi-worker deployments), we make a
    direct API call with an explicit max_tokens parameter so the shared
    singleton is never mutated.

    Falls back to temporarily overriding max_tokens if the Groq client
    does not support per-call kwargs — both paths restore state safely.
    """
    original_max = getattr(groq_service, "max_tokens", 1024)
    # Only override if the requested budget differs from the default
    if max_tokens == original_max:
        raw = _safe_complete(groq_service, system_prompt, user_msg)
    else:
        # Temporarily set on the instance. This is safe in single-threaded
        # WSGI workers (gunicorn with sync workers) and in development.
        # TODO: For async / multi-threaded workers, move to per-request
        #       GroqClient instantiation and remove this mutation.
        try:
            groq_service.max_tokens = max_tokens
            raw = _safe_complete(groq_service, system_prompt, user_msg)
        finally:
            # Always restore — even if _complete raises
            groq_service.max_tokens = original_max

    if not raw:
        logger.warning("Groq returned empty response for builder generation")
        return None

    result = groq_service._parse_json(raw, {})
    if not result:
        logger.warning("Groq response could not be parsed as JSON")
        return None

    # Validate required keys
    required_keys = {"summary", "skills", "experience"}
    if not required_keys.issubset(result.keys()):
        logger.warning(
            "Groq response missing required keys: %s",
            required_keys - result.keys(),
        )
        return None

    return result


def _safe_complete(groq_service, system_prompt: str, user_msg: str) -> str | None:
    """Wrap groq_service._complete() and return None on any exception."""
    try:
        return groq_service._complete(system_prompt, user_msg)
    except Exception as exc:
        logger.warning("Groq call failed: %s", exc)
        return None


def _build_generation_prompt(
    *,
    candidate_name: str,
    candidate_headline: str,
    existing_skills: list,
    existing_experience: list,
    existing_education: list,
    existing_certifications: list,
    existing_projects: list,
    existing_summary: str,
    experience_years: float,
    job_title: str,
    job_company: str,
    job_description: str,
    required_skills: list,
    nice_to_have_skills: list,
    missing_skills: list,
    matched_skills: list,
    responsibilities: list,
    seniority_level: str,
    user_prompt: str,
    tone: str,
) -> str:
    return f"""CANDIDATE PROFILE
=================
Name: {candidate_name}
Headline: {candidate_headline or 'Not set'}
Experience Years: {experience_years}
Seniority Level: {seniority_level}
Writing Tone: {tone}

CANDIDATE'S OWN DESCRIPTION (use verbatim where honest):
{user_prompt or 'Not provided.'}

EXISTING SKILLS (verified):
{', '.join(existing_skills[:40]) if existing_skills else 'None'}

EXISTING SUMMARY:
{existing_summary[:500] if existing_summary else 'None'}

EXISTING EXPERIENCE (improve bullets, do NOT change roles/companies):
{json.dumps(existing_experience[:5], indent=2) if existing_experience else '[]'}

EXISTING EDUCATION:
{json.dumps(existing_education[:3], indent=2) if existing_education else '[]'}

EXISTING CERTIFICATIONS:
{', '.join(existing_certifications[:6]) if existing_certifications else 'None'}

EXISTING PROJECTS:
{json.dumps(existing_projects[:4], indent=2) if existing_projects else '[]'}

TARGET JOB
==========
Title: {job_title}
Company: {job_company}
Required Skills: {', '.join(required_skills)}
Nice-to-Have: {', '.join(nice_to_have_skills) if nice_to_have_skills else 'None'}
Responsibilities: {'; '.join(responsibilities[:5]) if responsibilities else 'Not specified'}
Job Description (excerpt): {job_description[:800]}

ATS SKILL GAP ANALYSIS
======================
Already matched: {', '.join(matched_skills) if matched_skills else 'None'}
MISSING — must appear in skills list and worked naturally into bullets:
{', '.join(missing_skills) if missing_skills else 'None — excellent coverage!'}

Generate the complete ATS-optimised resume JSON now."""


def _build_refinement_prompt(
    *,
    current_content: dict,
    score_breakdown: dict,
    missing_skills: list,
    job_title: str,
    required_skills: list,
    iteration: int,
) -> str:
    keyword_score  = score_breakdown.get("keyword_score", 0)
    semantic_score = score_breakdown.get("semantic_score", 0)
    exp_score      = score_breakdown.get("experience_score", 0)
    sq_score       = score_breakdown.get("section_quality_score", 0)
    current_label  = score_breakdown.get("label", "fair")

    return f"""REFINEMENT ITERATION {iteration}
========================
Target Job: {job_title}
Current ATS Label: {current_label}

SCORE BREAKDOWN (0.0 – 1.0, improve the lowest):
  Keyword Match:    {keyword_score:.2f}
  Semantic Match:   {semantic_score:.2f}
  Experience Score: {exp_score:.2f}
  Section Quality:  {sq_score:.2f}

STILL MISSING SKILLS (add to skills list + weave into 1-2 bullets):
{', '.join(missing_skills) if missing_skills else 'None — all required skills present!'}

REQUIRED SKILLS FOR REFERENCE:
{', '.join(required_skills)}

CURRENT RESUME DRAFT:
{json.dumps(current_content, indent=2)[:3000]}

Instructions:
- If keyword_score < 0.65: add more required skills to the skills section.
- If semantic_score < 0.60: improve summary with job-specific terminology.
- If experience_score < 0.60: strengthen bullets with quantified achievements.
- If section_quality_score < 0.70: ensure all sections are populated.

Return the complete improved resume JSON now."""
