"""
app/services/resume_builder_agent_service.py

ResumeBuilderAgentService — AI Resume Builder orchestrator.

Architecture:
  This service is the single entry point for the resume builder feature.
  It follows the same design as all other high-level services
  (ResumeAnalysisService, SmartJobPostingService, etc.):
    - Accepts repositories and component services via constructor injection.
    - Stateless — no in-memory session state; all state lives in ResumeDraft rows.
    - Returns typed result dataclasses — API layer handles serialisation.
    - Never raises — all exceptions are caught and returned as error fields.

Pipeline (generate):
  1. Context assembly
       - Load candidate + job from repositories
       - Aggregate skills/experience from up to 5 previous parsed resumes
       - Compute skill gap via KeywordMatcherService.get_skill_breakdown()
  2. Generation
       - If Groq available → groq_generator.generate()
       - Else              → fallback_generator.generate()
       - Validates output schema and fills any missing sections
  3. ATS preview scoring
       - AtsScorerService.score_raw() — NO DB write to ats_scores
       - Returns predicted_score + full breakdown
  4. Optimisation loop (if score < target_score AND iteration < MAX)
       - If Groq available → groq_generator.refine()
       - Else              → rule-based re-weighting (inject missing skills)
       - Re-score after each iteration
       - Hard cap: 2 iterations maximum
  5. Persist draft
       - ResumeDraftRepository.create_draft() + write_generation_result()
       - Commits once at the end
  6. Return BuildResult

Pipeline (refine):
  Same as generate steps 2-5 but starting from an existing draft
  (identified by draft_id).

Pipeline (save_draft → finalize):
  - Candidate may have edited content in the UI
  - Creates a real Resume record (parse_status=SUCCESS, bypassing file parsing)
  - Runs full score_resume_job() → persists to ats_scores
  - Calls ResumeDraftRepository.mark_finalized()
  - Commits once

INTEGRATION RULES (non-negotiable):
  - DO NOT call AtsScorerService.score_resume_job() during preview.
    Only score_raw() is called in the generate/refine pipeline.
  - DO NOT write to ats_scores during preview.
  - DO NOT modify any existing service or repository.
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Optional

from app.services.builder.template_registry import get_template, DEFAULT_TEMPLATE_ID
from app.services.builder import fallback_generator, groq_generator
from app.models.resume_draft import MAX_AGENT_ITERATIONS, DRAFT_STATUS_DRAFT, DRAFT_STATUS_REFINED

logger = logging.getLogger(__name__)

# ATS score target — drafts below this trigger an optimisation loop
_DEFAULT_TARGET_SCORE = 0.75


# ── Result dataclasses ────────────────────────────────────────────────────────

@dataclass
class AtsPreview:
    """Score preview from AtsScorerService.score_raw() — never written to DB."""
    final_score:           float = 0.0
    label:                 str   = "weak"
    keyword_score:         float = 0.0
    semantic_score:        float = 0.0
    experience_score:      float = 0.0
    section_quality_score: float = 0.0
    matched_skills:        list  = field(default_factory=list)
    missing_skills:        list  = field(default_factory=list)


@dataclass
class BuildResult:
    """Full output of generate() or refine() — returned to the API layer."""
    draft_id:       str          = ""
    content:        dict         = field(default_factory=dict)
    ats_preview:    AtsPreview   = field(default_factory=AtsPreview)
    template:       dict         = field(default_factory=dict)
    job_id:         str          = ""
    job_title:      str          = ""
    iteration_count: int         = 0
    llm_used:       bool         = False
    error:          Optional[str] = None


@dataclass
class SaveResult:
    """Result of save_draft() — after converting draft to a real Resume."""
    resume_id:     str          = ""
    draft_id:      str          = ""
    final_score:   float        = 0.0
    score_label:   str          = "fair"
    ats_score_id:  str          = ""
    error:         Optional[str] = None


# ── Service ───────────────────────────────────────────────────────────────────

class ResumeBuilderAgentService:
    """
    Stateless AI Resume Builder orchestrator.

    All dependencies are injected via __init__ — mirrors every other
    service in this project.
    """

    def __init__(
        self,
        groq_service,
        ats_scorer,
        keyword_matcher,
        candidate_repo,
        resume_repo,
        job_repo,
        draft_repo,
        target_score: float = _DEFAULT_TARGET_SCORE,
    ):
        self._groq        = groq_service
        self._scorer      = ats_scorer
        self._kw          = keyword_matcher
        self._candidates  = candidate_repo
        self._resumes     = resume_repo
        self._jobs        = job_repo
        self._drafts      = draft_repo
        self._target      = target_score

    # ── Public API ────────────────────────────────────────────────────────────

    def generate(
        self,
        *,
        candidate_id: str,
        job_id: str,
        user_prompt: str,
        template_id: str = DEFAULT_TEMPLATE_ID,
    ) -> BuildResult:
        """
        Generate a new ATS-optimised resume draft.

        Runs the full pipeline:
          context assembly → generation → ATS preview → optimisation loop
          → persist draft → return BuildResult.

        Args:
            candidate_id: Authenticated candidate UUID.
            job_id:       Target job UUID from the jobs table.
            user_prompt:  Free-text background from the candidate.
            template_id:  Template registry key.

        Returns:
            BuildResult (never raises — errors are in .error field).
        """
        try:
            return self._run_generate_pipeline(
                candidate_id=candidate_id,
                job_id=job_id,
                user_prompt=user_prompt,
                template_id=template_id,
            )
        except Exception as exc:
            logger.exception(
                "ResumeBuilderAgentService.generate failed",
                extra={"candidate_id": candidate_id, "job_id": job_id},
            )
            return BuildResult(error=str(exc))

    def refine(
        self,
        *,
        draft_id: str,
        candidate_id: str,
    ) -> BuildResult:
        """
        Run one additional ATS optimisation iteration on an existing draft.

        Args:
            draft_id:     ResumeDraft UUID (must belong to candidate_id).
            candidate_id: Authenticated candidate UUID (ownership check).

        Returns:
            Updated BuildResult (never raises).
        """
        try:
            return self._run_refine_pipeline(
                draft_id=draft_id,
                candidate_id=candidate_id,
            )
        except Exception as exc:
            logger.exception(
                "ResumeBuilderAgentService.refine failed",
                extra={"draft_id": draft_id},
            )
            return BuildResult(error=str(exc))

    def save_draft(
        self,
        *,
        draft_id: str,
        candidate_id: str,
        edited_content: dict | None = None,
    ) -> SaveResult:
        """
        Finalize a draft: create a real Resume record + persist ATS score.

        Args:
            draft_id:       ResumeDraft UUID.
            candidate_id:   Authenticated candidate UUID (ownership check).
            edited_content: Optional candidate-edited content dict.
                            If None, uses draft.content_dict as-is.

        Returns:
            SaveResult (never raises).
        """
        try:
            return self._run_save_pipeline(
                draft_id=draft_id,
                candidate_id=candidate_id,
                edited_content=edited_content,
            )
        except Exception as exc:
            logger.exception(
                "ResumeBuilderAgentService.save_draft failed",
                extra={"draft_id": draft_id},
            )
            return SaveResult(error=str(exc))

    def predict_score(
        self,
        *,
        content: dict,
        job_id: str,
    ) -> AtsPreview:
        """
        Live ATS preview for arbitrary content vs a job — no draft row touched.

        Used by the UI to give real-time score feedback as the candidate
        manually edits the resume.

        Args:
            content: Resume content dict from the editor.
            job_id:  Target job UUID.

        Returns:
            AtsPreview (never raises — returns zeroed preview on error).
        """
        try:
            job = self._jobs.get_by_id(job_id)
            if not job:
                return AtsPreview()
            return self._score_content(content, job)
        except Exception as exc:
            logger.warning("predict_score failed: %s", exc)
            return AtsPreview()

    # ── Generate pipeline ─────────────────────────────────────────────────────

    def _run_generate_pipeline(
        self,
        *,
        candidate_id: str,
        job_id: str,
        user_prompt: str,
        template_id: str,
    ) -> BuildResult:

        # ── Step 1: Load context ───────────────────────────────────────────────
        candidate = self._candidates.get_by_id(candidate_id)
        if not candidate:
            return BuildResult(error=f"Candidate '{candidate_id}' not found.")

        job = self._jobs.get_by_id(job_id)
        if not job:
            return BuildResult(error=f"Job '{job_id}' not found.")

        template = get_template(template_id)

        # Aggregate skills/experience from parsed resumes
        ex_skills, ex_experience, ex_education, ex_certs, ex_projects, ex_summary, exp_years = \
            self._aggregate_resume_data(candidate_id)

        # Skill gap analysis
        gap = self._kw.get_skill_breakdown(
            resume_skills=ex_skills,
            job_required_skills=job.required_skills_list,
            job_nice_to_have_skills=job.nice_to_have_skills_list,
        )
        matched_skills = gap.get("matched", [])
        missing_skills = gap.get("missing", [])

        seniority = self._infer_seniority(job.title)

        common_kwargs = dict(
            candidate_name=candidate.full_name or "",
            candidate_headline=getattr(candidate, "headline", "") or "",
            existing_skills=ex_skills,
            existing_experience=ex_experience,
            existing_education=ex_education,
            existing_certifications=ex_certs,
            existing_projects=ex_projects,
            existing_summary=ex_summary,
            experience_years=exp_years,
            job_title=job.title,
            job_company=job.company,
            required_skills=job.required_skills_list,
            nice_to_have_skills=job.nice_to_have_skills_list,
            missing_skills=missing_skills,
            matched_skills=matched_skills,
            seniority_level=seniority,
            user_prompt=(user_prompt or "")[:2000],
            tone=template.get("tone", "professional"),
        )

        # ── Step 2: Generate ───────────────────────────────────────────────────
        llm_used = False
        if self._groq and self._groq.available:
            content = groq_generator.generate(
                self._groq,
                job_description=(job.description or "")[:1000],
                responsibilities=getattr(job, "responsibilities_list", []) or [],
                **common_kwargs,
            )
            if content:
                llm_used = True
            else:
                logger.warning("Groq generation failed — using fallback generator")

        if not llm_used:
            content = fallback_generator.generate(**common_kwargs)

        content = self._validate_and_fill_content(content)

        # ── Step 3 + 4: Score + optimisation loop ─────────────────────────────
        content, ats_preview, iteration_count = self._optimisation_loop(
            content=content,
            job=job,
            missing_skills=missing_skills,
            llm_used=llm_used,
            start_iteration=0,
        )

        # ── Step 5: Persist draft ──────────────────────────────────────────────
        from app.core.database import db

        draft = self._drafts.create_draft(
            candidate_id=candidate_id,
            job_id=job_id,
            template_id=template_id,
            user_prompt=user_prompt or "",
        )

        status = DRAFT_STATUS_REFINED if iteration_count > 0 else DRAFT_STATUS_DRAFT

        self._drafts.write_generation_result(
            draft,
            content=content,
            predicted_score=ats_preview.final_score,
            score_breakdown={
                "keyword_score":         ats_preview.keyword_score,
                "semantic_score":        ats_preview.semantic_score,
                "experience_score":      ats_preview.experience_score,
                "section_quality_score": ats_preview.section_quality_score,
                "label":                 ats_preview.label,
            },
            matched_skills=ats_preview.matched_skills,
            missing_skills=ats_preview.missing_skills,
            iteration_count=iteration_count,
            status=status,
        )

        db.session.commit()

        logger.info(
            "Resume draft generated",
            extra={
                "draft_id":     draft.id,
                "candidate_id": candidate_id,
                "job_id":       job_id,
                "score":        ats_preview.final_score,
                "iterations":   iteration_count,
                "llm_used":     llm_used,
            },
        )

        return BuildResult(
            draft_id=draft.id,
            content=content,
            ats_preview=ats_preview,
            template=template,
            job_id=job_id,
            job_title=job.title,
            iteration_count=iteration_count,
            llm_used=llm_used,
        )

    # ── Refine pipeline ───────────────────────────────────────────────────────

    def _run_refine_pipeline(
        self,
        *,
        draft_id: str,
        candidate_id: str,
    ) -> BuildResult:

        draft = self._drafts.get_by_id(draft_id)
        if not draft:
            return BuildResult(error=f"Draft '{draft_id}' not found.")
        if draft.candidate_id != candidate_id:
            return BuildResult(error="Access denied.")
        if draft.is_finalized:
            return BuildResult(error="Draft is already finalized and cannot be refined.")
        if draft.iteration_count >= MAX_AGENT_ITERATIONS:
            return BuildResult(
                error=(
                    f"Maximum optimisation iterations ({MAX_AGENT_ITERATIONS}) reached. "
                    "Save the draft or start a new generation."
                )
            )

        job = self._jobs.get_by_id(draft.job_id) if draft.job_id else None
        if not job:
            return BuildResult(error="Target job not found for this draft.")

        template = get_template(draft.template_id)

        content = draft.content_dict
        missing_skills = draft.missing_skills_list
        llm_used = False

        content, ats_preview, new_iteration_count = self._optimisation_loop(
            content=content,
            job=job,
            missing_skills=missing_skills,
            llm_used=(self._groq and self._groq.available),
            start_iteration=draft.iteration_count,
            score_breakdown=draft.score_breakdown_dict,
        )

        from app.core.database import db

        self._drafts.write_generation_result(
            draft,
            content=content,
            predicted_score=ats_preview.final_score,
            score_breakdown={
                "keyword_score":         ats_preview.keyword_score,
                "semantic_score":        ats_preview.semantic_score,
                "experience_score":      ats_preview.experience_score,
                "section_quality_score": ats_preview.section_quality_score,
                "label":                 ats_preview.label,
            },
            matched_skills=ats_preview.matched_skills,
            missing_skills=ats_preview.missing_skills,
            iteration_count=new_iteration_count,
            status=DRAFT_STATUS_REFINED,
        )

        db.session.commit()

        logger.info(
            "Resume draft refined",
            extra={
                "draft_id":   draft_id,
                "score":      ats_preview.final_score,
                "iterations": new_iteration_count,
            },
        )

        return BuildResult(
            draft_id=draft.id,
            content=content,
            ats_preview=ats_preview,
            template=template,
            job_id=draft.job_id or "",
            job_title=job.title,
            iteration_count=new_iteration_count,
            llm_used=llm_used,
        )

    # ── Save pipeline ─────────────────────────────────────────────────────────

    def _run_save_pipeline(
        self,
        *,
        draft_id: str,
        candidate_id: str,
        edited_content: dict | None,
    ) -> SaveResult:

        from app.core.database import db
        from app.models.resume import Resume
        from app.models.enums import ParseStatus

        draft = self._drafts.get_by_id(draft_id)
        if not draft:
            return SaveResult(error=f"Draft '{draft_id}' not found.")
        if draft.candidate_id != candidate_id:
            return SaveResult(error="Access denied.")
        if draft.is_finalized:
            return SaveResult(error="Draft is already finalized.")

        content = edited_content if edited_content else draft.content_dict
        content = self._validate_and_fill_content(content)

        # Build Resume ORM record directly (no file parsing needed)
        self._resumes.deactivate_previous(candidate_id)

        resume = Resume()
        resume.candidate_id = candidate_id
        resume.filename     = f"ai_builder_{draft.template_id}.json"
        resume.file_path    = f"generated/{candidate_id}/{draft.id}.json"
        resume.file_type    = "json"
        resume.file_size_kb = 0
        resume.is_active    = True
        resume.parse_status = ParseStatus.SUCCESS

        # Inject structured data directly — no file parse required
        resume.raw_text         = self._content_to_raw_text(content)
        resume.skills           = json.dumps(content.get("skills", []))
        resume.experience       = json.dumps(content.get("experience", []))
        resume.education        = json.dumps(content.get("education", []))
        resume.certifications   = json.dumps(content.get("certifications", []))
        resume.projects         = json.dumps(content.get("projects", []))
        resume.summary_text     = content.get("summary", "")
        resume.skill_count      = len(content.get("skills", []))
        resume.total_experience_years = self._estimate_years(content.get("experience", []))

        db.session.add(resume)
        db.session.flush()   # populate resume.id before scoring

        # Full ATS score — NOW writes to ats_scores (this is the finalize commit)
        ats_score_id = ""
        final_score  = 0.0
        score_label  = "fair"

        if draft.job_id:
            job = self._jobs.get_by_id(draft.job_id)
            if job:
                result = self._scorer.score_resume_job(
                    resume=resume,
                    job=job,
                    application_id=None,
                    use_llm=False,   # Keep save fast; LLM explain optional
                )
                ats_score_id = result.ats_score_id or ""
                final_score  = result.final_score
                score_label  = result.score_label

        # Mark draft finalized
        self._drafts.mark_finalized(draft, resume.id)

        db.session.commit()

        logger.info(
            "ResumeDraft finalized → Resume created",
            extra={
                "draft_id":  draft_id,
                "resume_id": resume.id,
                "score":     final_score,
            },
        )

        return SaveResult(
            resume_id=resume.id,
            draft_id=draft_id,
            final_score=final_score,
            score_label=score_label,
            ats_score_id=ats_score_id,
        )

    # ── Optimisation loop ─────────────────────────────────────────────────────

    def _optimisation_loop(
        self,
        *,
        content: dict,
        job,
        missing_skills: list[str],
        llm_used: bool,
        start_iteration: int,
        score_breakdown: dict | None = None,
    ) -> tuple[dict, AtsPreview, int]:
        """
        Score → check threshold → refine (up to MAX_AGENT_ITERATIONS).

        Returns (final_content, ats_preview, total_iterations_run).
        """
        preview = self._score_content(content, job)
        iterations = start_iteration

        while (
            preview.final_score < self._target
            and iterations < MAX_AGENT_ITERATIONS
        ):
            iterations += 1
            next_missing = preview.missing_skills or missing_skills

            if llm_used and self._groq and self._groq.available:
                refined = groq_generator.refine(
                    self._groq,
                    current_content=content,
                    score_breakdown={
                        "keyword_score":         preview.keyword_score,
                        "semantic_score":        preview.semantic_score,
                        "experience_score":      preview.experience_score,
                        "section_quality_score": preview.section_quality_score,
                        "label":                 preview.label,
                    },
                    missing_skills=next_missing,
                    job_title=job.title,
                    required_skills=job.required_skills_list,
                    iteration=iterations,
                )
                if refined:
                    content = self._validate_and_fill_content(refined)
                else:
                    # LLM refinement failed — inject missing skills via rule-based
                    content = self._rule_inject_skills(content, next_missing)
            else:
                # Rule-based: merge missing skills into skills list
                content = self._rule_inject_skills(content, next_missing)

            preview = self._score_content(content, job)
            logger.debug(
                "Optimisation iteration %d: score=%.3f",
                iterations, preview.final_score,
            )

        return content, preview, iterations

    # ── Scoring helpers ───────────────────────────────────────────────────────

    def _score_content(self, content: dict, job) -> AtsPreview:
        """
        Call AtsScorerService.score_raw() and return an AtsPreview.

        NEVER writes to ats_scores — score_raw() is the preview method.
        """
        experience   = content.get("experience", [])
        skills       = content.get("skills", [])
        education    = content.get("education", [])
        summary_text = content.get("summary", "")

        # Flatten experience to raw text for BM25 keyword scoring
        exp_text = " ".join(
            e.get("role", "") + " " + " ".join(e.get("impact_points", []))
            for e in experience
        )
        raw_text = f"{summary_text} {' '.join(skills)} {exp_text}".strip()

        # Normalise experience to the shape score_raw() expects
        normalised_exp = [
            {"title": e.get("role", ""), "description": " ".join(e.get("impact_points", []))}
            for e in experience
        ]

        try:
            result = self._scorer.score_raw(
                resume_text=raw_text,
                resume_skills=skills,
                resume_experience=normalised_exp,
                resume_education=education,
                resume_experience_years=self._estimate_years(experience),
                job_title=job.title,
                job_description=job.description or "",
                job_required_skills=job.required_skills_list,
                job_nice_to_have_skills=job.nice_to_have_skills_list,
                job_experience_years=float(job.experience_years or 0),
                summary_text=summary_text,
            )
        except Exception as exc:
            logger.warning("score_raw failed in builder: %s", exc)
            return AtsPreview()

        # Recompute matched/missing from keyword matcher (gap breakdown)
        gap = self._kw.get_skill_breakdown(
            resume_skills=skills,
            job_required_skills=job.required_skills_list,
            job_nice_to_have_skills=job.nice_to_have_skills_list,
        )

        score = result.get("final_score", 0.0)
        label = (
            "excellent" if score >= 0.80 else
            "good"      if score >= 0.65 else
            "fair"      if score >= 0.50 else
            "weak"
        )

        return AtsPreview(
            final_score=score,
            label=label,
            keyword_score=result.get("keyword_score", 0.0),
            semantic_score=result.get("semantic_score", 0.0),
            experience_score=result.get("experience_score", 0.0),
            section_quality_score=result.get("section_quality_score", 0.0),
            matched_skills=gap.get("matched", []),
            missing_skills=gap.get("missing", []),
        )

    # ── Context helpers ───────────────────────────────────────────────────────

    def _aggregate_resume_data(
        self, candidate_id: str
    ) -> tuple[list, list, list, list, list, str, float]:
        """
        Aggregate skills/experience from up to 5 most recent parsed resumes.

        Returns (skills, experience, education, certifications, projects,
                 summary, experience_years).
        """
        from app.models.enums import ParseStatus

        resumes_raw, _ = self._resumes.list_by_candidate(
            candidate_id=candidate_id,
            active_only=False,
            page=1,
            limit=5,
        )
        resumes = [r for r in resumes_raw if r.parse_status == ParseStatus.SUCCESS]

        if not resumes:
            return [], [], [], [], [], "", 0.0

        # Skill union (deduplicated, insertion-order preserved)
        seen: set[str] = set()
        all_skills: list[str] = []
        for r in resumes:
            for s in (r.skills_list or []):
                if s.lower() not in seen:
                    all_skills.append(s)
                    seen.add(s.lower())

        # Best resume = most skills (proxy for parse quality)
        best = max(resumes, key=lambda r: r.skill_count or 0)

        # Summary from first non-empty
        summary = ""
        for r in resumes:
            t = getattr(r, "summary_text", "") or ""
            if len(t.strip()) > 20:
                summary = t.strip()
                break

        return (
            all_skills[:50],
            best.experience_list[:6],
            best.education_list[:3],
            best.certifications_list[:8],
            best.projects_list[:5],
            summary,
            float(best.total_experience_years or 0.0),
        )

    # ── Static helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _validate_and_fill_content(content: dict | None) -> dict:
        """
        Ensure all required schema keys exist with valid types.
        Fills missing keys with empty values — never raises.
        """
        if not content or not isinstance(content, dict):
            content = {}
        return {
            "summary":        str(content.get("summary") or ""),
            "skills":         content.get("skills") if isinstance(content.get("skills"), list) else [],
            "experience":     content.get("experience") if isinstance(content.get("experience"), list) else [],
            "education":      content.get("education") if isinstance(content.get("education"), list) else [],
            "projects":       content.get("projects") if isinstance(content.get("projects"), list) else [],
            "certifications": content.get("certifications") if isinstance(content.get("certifications"), list) else [],
        }

    @staticmethod
    def _rule_inject_skills(content: dict, missing_skills: list[str]) -> dict:
        """
        Rule-based optimisation: merge missing skills into skills list.
        Used when Groq is unavailable or refinement call fails.
        """
        existing = content.get("skills", [])
        seen = {s.lower() for s in existing}
        for s in missing_skills:
            if s.lower() not in seen:
                existing.append(s)
                seen.add(s.lower())
        content["skills"] = existing[:40]
        return content

    @staticmethod
    def _estimate_years(experience: list) -> float:
        """
        Rough years estimate when no date-range parsing is done.
        Each experience entry ≈ 2 years, capped at 20.
        """
        return min(float(len(experience)) * 2.0, 20.0) if experience else 0.0

    @staticmethod
    def _content_to_raw_text(content: dict) -> str:
        """Flatten structured content to plain text for BM25/embedding scoring."""
        parts = [content.get("summary", "")]
        parts.append(" ".join(content.get("skills", [])))
        for exp in content.get("experience", []):
            parts.append(exp.get("role", ""))
            parts.extend(exp.get("impact_points", []))
        for proj in content.get("projects", []):
            parts.append(proj.get("name", ""))
            parts.append(proj.get("description", ""))
        return " ".join(p for p in parts if p).strip()

    _SENIOR_WORDS = frozenset({"senior", "sr.", "sr", "staff", "principal", "experienced"})
    _LEAD_WORDS   = frozenset({"lead", "head", "director", "vp", "chief", "architect"})
    _JUNIOR_WORDS = frozenset({"junior", "jr.", "jr", "entry", "associate", "graduate", "intern"})

    @classmethod
    def _infer_seniority(cls, title: str) -> str:
        t = (title or "").lower()
        if any(w in t for w in cls._LEAD_WORDS):   return "lead"
        if any(w in t for w in cls._SENIOR_WORDS): return "senior"
        if any(w in t for w in cls._JUNIOR_WORDS): return "junior"
        return "mid"
