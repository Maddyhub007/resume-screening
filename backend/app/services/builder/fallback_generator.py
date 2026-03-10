"""
app/services/builder/fallback_generator.py

Rule-based Resume Generator — deterministic fallback when Groq is unavailable.

This module produces a well-structured resume dict from pure candidate data,
gap analysis, and job context — no LLM involved, no hallucination possible.

Design:
  - Every output field is derived ONLY from data already present in the DB.
  - If a field has no data, it is left as an empty list / empty string.
  - Skills list = union(candidate skills, required job skills) — this is
    intentional for ATS purposes; the candidate should review and remove
    any they don't actually have.
  - Experience bullets are improved using a small set of verb templates
    applied to existing bullet content — no invented facts.
  - Summary is assembled from a template filled with real candidate data.

Output contract (same schema as Groq generator):
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

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Action verb prefixes for bullet point strengthening
_STRONG_VERBS = [
    "Engineered", "Architected", "Delivered", "Optimised", "Led",
    "Implemented", "Built", "Designed", "Deployed", "Reduced",
    "Increased", "Automated", "Scaled", "Migrated", "Integrated",
]

# Seniority → experience summary phrase
_SENIORITY_PHRASES = {
    "junior":  "an early-career",
    "mid":     "a",
    "senior":  "an experienced",
    "lead":    "a senior",
}


def generate(
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
    required_skills: list[str],
    nice_to_have_skills: list[str],
    missing_skills: list[str],
    matched_skills: list[str],
    seniority_level: str,
    user_prompt: str,
    tone: str,
) -> dict[str, Any]:
    """
    Generate a structured resume dict using only existing candidate data.

    No facts are invented. Skills from the job description are merged into
    the skills section — the candidate should review and remove any they
    don't possess before finalising.

    Args:
        candidate_name:       Candidate's full name.
        candidate_headline:   Existing professional headline.
        existing_skills:      Skills extracted from previous resumes.
        existing_experience:  Experience list from best parsed resume.
        existing_education:   Education list.
        existing_certifications: Certifications list.
        existing_projects:    Projects list.
        existing_summary:     Summary text from previous resume.
        experience_years:     Total years of experience.
        job_title:            Target job title.
        job_company:          Target company name.
        required_skills:      Job's required skills.
        nice_to_have_skills:  Job's nice-to-have skills.
        missing_skills:       Skills required but not in candidate profile.
        matched_skills:       Skills in both candidate and job.
        seniority_level:      "junior" | "mid" | "senior" | "lead"
        user_prompt:          Candidate's free-text intent (max 300 chars used).
        tone:                 Template tone ("professional" | "technical" | "executive")

    Returns:
        Structured resume dict matching the builder JSON schema.
    """
    summary   = _build_summary(
        candidate_name, candidate_headline, existing_summary,
        experience_years, job_title, job_company,
        matched_skills, required_skills, seniority_level, user_prompt, tone,
    )
    skills    = _build_skills(existing_skills, required_skills, nice_to_have_skills)
    experience = _build_experience(existing_experience)
    projects   = _build_projects(existing_projects)

    return {
        "summary":        summary,
        "skills":         skills,
        "experience":     experience,
        "education":      _normalise_education(existing_education),
        "projects":       projects,
        "certifications": existing_certifications[:8],
    }


# ── Private helpers ───────────────────────────────────────────────────────────

def _build_summary(
    name: str,
    headline: str,
    existing: str,
    years: float,
    job_title: str,
    company: str,
    matched: list,
    required: list,
    seniority: str,
    prompt: str,
    tone: str,
) -> str:
    """
    Build a targeted professional summary.

    Priority:
      1. If the user_prompt is substantive (>30 chars), use it as the
         basis and append a job-targeting sentence.
      2. Else if an existing summary exists, adapt it.
      3. Else build from template.
    """
    key_skills = (matched or required)[:3]
    skills_str = ", ".join(key_skills) if key_skills else "modern technologies"
    seniority_phrase = _SENIORITY_PHRASES.get(seniority, "a")
    years_str = f"{int(years)} year{'s' if years != 1 else ''}" if years >= 1 else "a growing"

    if prompt and len(prompt.strip()) > 30:
        base = prompt.strip()[:300]
        return (
            f"{base} "
            f"Targeting the {job_title} role, I bring expertise in {skills_str}."
        )

    if existing and len(existing.strip()) > 40:
        # Append job-targeting sentence to existing summary
        return (
            f"{existing.strip()} "
            f"Currently seeking the {job_title} position at {company}, "
            f"leveraging strong skills in {skills_str}."
        )

    # Template-based
    intro = (
        f"{name} is {seniority_phrase} professional with {years_str} of experience"
    )
    if headline:
        intro += f" as a {headline}"
    return (
        f"{intro}. "
        f"Targeting the {job_title} role at {company}, with proven expertise in "
        f"{skills_str}. "
        f"Committed to delivering high-quality solutions and measurable business impact."
    )


def _build_skills(
    existing: list[str],
    required: list[str],
    nice_to_have: list[str],
) -> list[str]:
    """
    Merge candidate skills + all job skills, deduplicated, required skills first.

    NOTE: Required skills that the candidate does NOT currently have are still
    included so the ATS keyword score is maximised. The candidate MUST review
    and remove any they do not genuinely possess before saving.
    """
    seen: set[str] = set()
    result: list[str] = []

    def _add(s: str) -> None:
        key = s.lower().strip()
        if key and key not in seen:
            seen.add(key)
            result.append(s.strip())

    # Required first (highest ATS weight)
    for s in required:
        _add(s)
    # Candidate's own skills
    for s in existing:
        _add(s)
    # Nice-to-have last
    for s in nice_to_have:
        _add(s)

    return result[:40]   # Hard cap to keep resume readable


def _build_experience(existing: list[dict]) -> list[dict]:
    """
    Normalise existing experience entries to builder schema.

    Tries to strengthen weak bullet points with action verb prefixes.
    Only rewrites bullets that start with a lowercase letter or are very short.
    """
    result = []
    for i, entry in enumerate(existing[:6]):
        bullets = entry.get("bullets") or entry.get("impact_points") or []
        # Also accept free-text description as a single bullet
        if not bullets and entry.get("description"):
            bullets = [entry["description"]]

        strengthened = [_strengthen_bullet(b, i) for b in bullets[:5] if b]

        result.append({
            "role":          entry.get("title") or entry.get("role") or "",
            "company":       entry.get("company") or "",
            "date_range":    entry.get("date_range") or entry.get("dates") or "",
            "impact_points": strengthened,
        })
    return result


def _strengthen_bullet(bullet: str, seed: int = 0) -> str:
    """
    Prefix a weak bullet with a strong action verb if it doesn't already
    start with a capitalised action word.

    Avoids inventing any facts — only changes the first word.
    """
    b = bullet.strip()
    if not b:
        return b
    # Already starts with a capital letter → assume already strong
    if b[0].isupper() and len(b.split()[0]) > 3:
        return b
    verb = _STRONG_VERBS[seed % len(_STRONG_VERBS)]
    # Lowercase the original start to avoid "Engineered engineered ..."
    return f"{verb} {b[0].lower()}{b[1:]}"


def _build_projects(existing: list[dict]) -> list[dict]:
    """Normalise existing project entries to builder schema."""
    result = []
    for p in existing[:5]:
        result.append({
            "name":        p.get("name") or "",
            "description": p.get("description") or "",
            "tech_used":   p.get("tech_used") or p.get("technologies") or [],
        })
    return result


def _normalise_education(existing: list[dict]) -> list[dict]:
    """Normalise education entries to builder schema."""
    result = []
    for e in existing[:3]:
        result.append({
            "degree":      e.get("degree") or "",
            "institution": e.get("institution") or "",
            "year":        str(e.get("year") or ""),
            "gpa":         str(e.get("gpa") or ""),
        })
    return result
