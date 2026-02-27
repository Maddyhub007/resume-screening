"""
app/services/resume_analysis_service.py

High-level resume analysis service.

Orchestrates:
  1. Parse resume file (if not already parsed).
  2. Run SectionQualityScorerService to identify structural gaps.
  3. Call GroqService for LLM analysis (summary, issues, role suggestions).
  4. Persist updated analysis fields on the Resume record.
  5. Return AnalysisResult.

This service is called:
  - At upload time (async / background worker).
  - On-demand via GET /resumes/{id}/analysis.
  - When regenerating analysis after a resume update.

Design decisions:
  - Idempotent: calling analyse() twice on the same resume overwrites
    the analysis fields with fresh results — safe to retry.
  - Fallback: if Groq is unavailable, rule-based role suggestions and
    issues are returned instead of an error.
  - Never parses file again if parse_status=SUCCESS — respects the
    existing parsed data.

Usage:
    from app.services.resume_analysis_service import ResumeAnalysisService

    svc = ResumeAnalysisService(
        parser=parser_svc,
        section_quality_scorer=sq_svc,
        groq_service=groq_svc,
        resume_repo=resume_repo,
    )

    result = svc.analyse(resume=resume_obj)
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """Output of a resume analysis operation."""
    resume_id:        str = ""
    summary:          str = ""
    strengths:        list = field(default_factory=list)
    issues:           list = field(default_factory=list)
    role_suggestions: list = field(default_factory=list)
    improvement_tips: list = field(default_factory=list)
    section_quality:  float = 0.0
    llm_enhanced:     bool = False
    parse_error:      Optional[str] = None


# Rule-based fallback role mapping (skill → roles)
_SKILL_TO_ROLES = {
    "python":     [("Python Developer", 0.85), ("Data Engineer", 0.75), ("Backend Engineer", 0.80)],
    "react":      [("Frontend Developer", 0.85), ("Full Stack Developer", 0.80)],
    "java":       [("Java Developer", 0.85), ("Backend Engineer", 0.78)],
    "sql":        [("Data Analyst", 0.80), ("Database Administrator", 0.75)],
    "tensorflow": [("Machine Learning Engineer", 0.88), ("Data Scientist", 0.85)],
    "aws":        [("Cloud Engineer", 0.85), ("DevOps Engineer", 0.80)],
    "docker":     [("DevOps Engineer", 0.82), ("Platform Engineer", 0.78)],
    "kubernetes": [("Platform Engineer", 0.85), ("Site Reliability Engineer", 0.82)],
}


class ResumeAnalysisService:
    """
    Orchestrates resume parsing and AI-powered analysis.
    """

    def __init__(
        self,
        parser,
        section_quality_scorer,
        groq_service,
        resume_repo,
    ):
        self._parser = parser
        self._sq     = section_quality_scorer
        self._groq   = groq_service
        self._repo   = resume_repo

    def analyse(
        self,
        resume,
        force_reparse: bool = False,
        use_llm: bool = True,
    ) -> AnalysisResult:
        """
        Run full analysis on a Resume ORM object.

        Args:
            resume:        Resume ORM instance.
            force_reparse: Re-parse file even if parse_status=SUCCESS.
            use_llm:       Whether to call GroqService.

        Returns:
            AnalysisResult — always returns, never raises.
        """
        from app.models.enums import ParseStatus

        try:
            # ── 1. Parse if needed ─────────────────────────────────────────────
            if force_reparse or resume.parse_status != ParseStatus.SUCCESS:
                parse_result = self._parser.parse(resume.file_path)
                if parse_result.success:
                    self._apply_parse_result(resume, parse_result)
                    resume.parse_status = ParseStatus.SUCCESS
                    resume.parse_error_msg = None
                else:
                    resume.parse_status = ParseStatus.FAILED
                    resume.parse_error_msg = parse_result.parse_error
                    self._repo.save(resume)
                    return AnalysisResult(
                        resume_id=resume.id,
                        parse_error=parse_result.parse_error,
                    )
                self._repo.save(resume)

            # ── 2. Section quality ─────────────────────────────────────────────
            sq_score = self._sq.score(
                skills=resume.skills_list,
                experience=resume.experience_list,
                education=resume.education_list,
                summary_text=resume.summary_text or "",
                certifications=resume.certifications_list,
                projects=resume.projects_list,
                raw_text_length=len(resume.raw_text or ""),
            )

            # ── 3. LLM analysis ───────────────────────────────────────────────
            llm_enhanced = False
            if use_llm and self._groq and self._groq.available:
                llm_data = self._groq.analyse_resume(
                    raw_text=resume.raw_text or "",
                    skills=resume.skills_list,
                    experience_years=resume.total_experience_years,
                    education=resume.education_list,
                )
                summary          = llm_data.get("summary", "")
                strengths        = llm_data.get("strengths", [])
                issues           = llm_data.get("issues", [])
                role_suggestions = llm_data.get("role_suggestions", [])
                improvement_tips = llm_data.get("improvement_tips", [])
                llm_enhanced = True
            else:
                # Rule-based fallback
                summary, strengths, issues, role_suggestions, improvement_tips = (
                    self._rule_based_analysis(resume, sq_score)
                )

            # ── 4. Persist analysis fields ────────────────────────────────────
            resume.resume_summary       = summary
            resume.issues_list          = issues
            resume.role_suggestions_list = role_suggestions
            resume.improvement_tips_list = improvement_tips
            self._repo.save(resume)

            return AnalysisResult(
                resume_id=resume.id,
                summary=summary,
                strengths=strengths,
                issues=issues,
                role_suggestions=role_suggestions,
                improvement_tips=improvement_tips,
                section_quality=sq_score,
                llm_enhanced=llm_enhanced,
            )

        except Exception as exc:
            logger.exception("Resume analysis failed for %s", resume.id)
            return AnalysisResult(resume_id=resume.id, parse_error=str(exc))

    def _apply_parse_result(self, resume, parse_result) -> None:
        """Write ParseResult fields back onto the Resume ORM object."""
        resume.raw_text              = parse_result.raw_text
        resume.skills_list           = parse_result.skills
        resume.education_list        = parse_result.education
        resume.experience_list       = parse_result.experience
        resume.certifications_list   = parse_result.certifications
        resume.projects_list         = parse_result.projects
        resume.summary_text          = parse_result.summary_text
        resume.total_experience_years = parse_result.total_experience_years
        resume.skill_count           = parse_result.skill_count

    def _rule_based_analysis(
        self,
        resume,
        sq_score: float,
    ) -> tuple[str, list, list, list, list]:
        """Fallback analysis without LLM."""
        skills = resume.skills_list
        experience_years = resume.total_experience_years

        # Summary
        summary = (
            f"Candidate has {experience_years:.1f} years of experience "
            f"with expertise in {', '.join(skills[:5]) if skills else 'unknown areas'}."
        )

        # Strengths
        strengths = []
        if experience_years >= 5:
            strengths.append(f"Strong {experience_years:.0f} years of professional experience")
        if len(skills) >= 10:
            strengths.append(f"Broad technical skill set ({len(skills)} skills detected)")

        # Issues from missing sections
        issues = []
        if sq_score < 0.7:
            issues.append({
                "type": "missing_section",
                "description": "Resume is missing important sections.",
                "severity": "medium",
            })

        # Role suggestions from skill mapping
        role_scores: dict[str, float] = {}
        for skill in skills:
            for role, score in _SKILL_TO_ROLES.get(skill.lower(), []):
                if role not in role_scores or role_scores[role] < score:
                    role_scores[role] = score

        role_suggestions = [
            {"title": role, "match_score": score, "reason": f"Strong match based on {skill} skills"}
            for skill, roles in _SKILL_TO_ROLES.items()
            if skill in {s.lower() for s in skills}
            for role, score in roles
        ]
        # Deduplicate by title
        seen: set[str] = set()
        deduped = []
        for r in sorted(role_suggestions, key=lambda x: -x["match_score"]):
            if r["title"] not in seen:
                seen.add(r["title"])
                deduped.append(r)
        role_suggestions = deduped[:5]

        # Basic improvement tips
        improvement_tips = []
        if len(skills) < 5:
            improvement_tips.append({
                "category": "skills",
                "tip": "Add more technical skills to improve job match visibility.",
            })

        return summary, strengths, issues, role_suggestions, improvement_tips