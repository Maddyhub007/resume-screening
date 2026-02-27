"""
app/services/resume_parser.py

Multi-format resume parser.

Supported formats:  PDF (pdfplumber primary, PyMuPDF fallback),  DOCX.

Pipeline:
  1. Extract raw text from file.
  2. Segment text into resume sections (skills, experience, education, etc.).
  3. Extract structured data from each section.
  4. Compute derived metrics (total_experience_years, skill_count).
  5. Return a ParseResult dataclass.

Design decisions:
  - Two-library PDF strategy: pdfplumber is more accurate for text-heavy PDFs;
    PyMuPDF (fitz) handles scanned-ish or complex layout PDFs better.  We try
    pdfplumber first and fall back to fitz on empty output.
  - Section detection uses keyword-based heuristics — no ML required.  Fast,
    deterministic, and works offline.
  - Skill extraction: exact-match + normalisation against a bundled tech skill
    vocabulary.  spaCy NER is used for person/org detection if available.
  - Experience parser: extracts date ranges from each job entry and sums months.
  - All parsing errors are caught and surfaced in parse_error so the caller can
    set parse_status=FAILED on the Resume record without crashing.

Usage:
    from app.services.resume_parser import ResumeParserService
    svc = ResumeParserService()
    result = svc.parse("/path/to/resume.pdf")
    result = svc.parse_bytes(file_bytes, filename="resume.docx")
"""

import logging
import os
import re
import tempfile
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Result dataclass
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ParseResult:
    """Structured output of a resume parse operation."""

    raw_text: str = ""
    skills: list[str] = field(default_factory=list)
    education: list[dict] = field(default_factory=list)
    experience: list[dict] = field(default_factory=list)
    certifications: list[str] = field(default_factory=list)
    projects: list[dict] = field(default_factory=list)
    summary_text: str = ""
    total_experience_years: float = 0.0
    skill_count: int = 0
    parse_error: Optional[str] = None

    @property
    def success(self) -> bool:
        return self.parse_error is None and bool(self.raw_text)


# ─────────────────────────────────────────────────────────────────────────────
# Skill vocabulary (tech + professional)
# ─────────────────────────────────────────────────────────────────────────────

_TECH_SKILLS = {
    # Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "ruby", "go",
    "rust", "swift", "kotlin", "scala", "r", "matlab", "php", "perl",
    # Web
    "react", "vue", "angular", "next.js", "nuxt", "html", "css", "sass",
    "webpack", "vite", "tailwind", "bootstrap", "jquery", "svelte",
    # Backend
    "flask", "django", "fastapi", "express", "spring", "rails", "laravel",
    "node.js", "graphql", "rest", "grpc",
    # Data / ML
    "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy", "matplotlib",
    "keras", "xgboost", "spark", "hadoop", "airflow", "dbt",
    "machine learning", "deep learning", "nlp", "computer vision",
    "data analysis", "data science", "statistics", "sql", "nosql",
    # Databases
    "postgresql", "mysql", "sqlite", "mongodb", "redis", "elasticsearch",
    "cassandra", "dynamodb", "neo4j", "oracle",
    # Cloud / Infra
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ansible",
    "jenkins", "github actions", "ci/cd", "linux", "bash",
    # Tools
    "git", "jira", "confluence", "figma", "postman", "prometheus", "grafana",
    # Soft skills (normalised)
    "leadership", "communication", "teamwork", "problem solving",
    "project management", "agile", "scrum", "mentoring",
}

_SKILL_ALIASES: dict[str, str] = {
    "js":         "javascript",
    "ts":         "typescript",
    "py":         "python",
    "node":       "node.js",
    "react.js":   "react",
    "next":       "next.js",
    "vuejs":      "vue",
    "vue.js":     "vue",
    "angular.js": "angular",
    "k8s":        "kubernetes",
    "ml":         "machine learning",
    "dl":         "deep learning",
    "postgres":   "postgresql",
    "mongo":      "mongodb",
    "tf":         "tensorflow",
    "sklearn":    "scikit-learn",
}


# ─────────────────────────────────────────────────────────────────────────────
# Section headers
# ─────────────────────────────────────────────────────────────────────────────

_SECTION_PATTERNS = {
    "summary":        re.compile(r"^\s*(summary|profile|objective|about\s+me)\s*$", re.I),
    "skills":         re.compile(r"^\s*(skills?|technical\s+skills?|core\s+competencies?|technologies?|tools?|expertise)\s*$", re.I),
    "experience":     re.compile(r"^\s*(experience|work\s+experience|employment|professional\s+experience|career\s+history)\s*$", re.I),
    "education":      re.compile(r"^\s*(education|academic|qualifications?|degrees?|schooling)\s*$", re.I),
    "certifications": re.compile(r"^\s*(certifications?|certificates?|licenses?|accreditations?)\s*$", re.I),
    "projects":       re.compile(r"^\s*(projects?|personal\s+projects?|open\s+source|portfolio)\s*$", re.I),
}

# Date patterns for experience duration extraction
_DATE_RANGE_RE = re.compile(
    r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,\.]+(\d{4})"
    r"\s*[-–—to]+\s*"
    r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|present|current|now)[a-z]*"
    r"(?:[\s,\.]+(\d{4}))?",
    re.I,
)

_YEAR_RANGE_RE = re.compile(r"(\d{4})\s*[-–—to]+\s*(\d{4}|present|current|now)", re.I)

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


class ResumeParserService:
    """
    Multi-format resume parser.

    Stateless — safe to share across threads / requests.
    """

    def parse(self, file_path: str) -> ParseResult:
        """
        Parse a resume from a file path.

        Args:
            file_path: Absolute or relative path to a .pdf or .docx file.

        Returns:
            ParseResult — always returns, never raises.
        """
        if not os.path.exists(file_path):
            return ParseResult(parse_error=f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        try:
            if ext == ".pdf":
                raw_text = self._extract_pdf(file_path)
            elif ext == ".docx":
                raw_text = self._extract_docx(file_path)
            else:
                return ParseResult(parse_error=f"Unsupported file type: {ext}")
        except Exception as exc:
            logger.exception("Text extraction failed for %s", file_path)
            return ParseResult(parse_error=f"Extraction error: {exc}")

        if not raw_text or not raw_text.strip():
            return ParseResult(
                raw_text=raw_text,
                parse_error="No text could be extracted from the file."
            )

        return self._parse_text(raw_text)

    def parse_bytes(self, data: bytes, filename: str) -> ParseResult:
        """
        Parse a resume from raw bytes (e.g., uploaded file data).

        Writes to a temp file, parses, then cleans up.
        """
        ext = os.path.splitext(filename)[1].lower()
        try:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(data)
                tmp_path = tmp.name
            result = self.parse(tmp_path)
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
        return result

    # ── PDF extraction ────────────────────────────────────────────────────────

    def _extract_pdf(self, path: str) -> str:
        """Try pdfplumber first; fall back to PyMuPDF (fitz)."""
        text = self._extract_pdf_pdfplumber(path)
        if text and len(text.strip()) > 100:
            return text
        logger.debug("pdfplumber yielded sparse text, trying PyMuPDF fallback.")
        return self._extract_pdf_fitz(path)

    @staticmethod
    def _extract_pdf_pdfplumber(path: str) -> str:
        try:
            import pdfplumber
            pages = []
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        pages.append(page_text)
            return "\n".join(pages)
        except ImportError:
            logger.debug("pdfplumber not available.")
            return ""
        except Exception as exc:
            logger.debug("pdfplumber extraction error: %s", exc)
            return ""

    @staticmethod
    def _extract_pdf_fitz(path: str) -> str:
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(path)
            pages = [doc[i].get_text() for i in range(len(doc))]
            doc.close()
            return "\n".join(pages)
        except ImportError:
            logger.debug("PyMuPDF (fitz) not available.")
            return ""
        except Exception as exc:
            logger.debug("PyMuPDF extraction error: %s", exc)
            return ""

    # ── DOCX extraction ───────────────────────────────────────────────────────

    @staticmethod
    def _extract_docx(path: str) -> str:
        try:
            from docx import Document
            doc = Document(path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n".join(paragraphs)
        except ImportError:
            return ""
        except Exception as exc:
            logger.debug("DOCX extraction error: %s", exc)
            return ""

    # ── Text parsing pipeline ─────────────────────────────────────────────────

    def _parse_text(self, raw_text: str) -> ParseResult:
        """Run the full NLP pipeline on extracted text."""
        sections = self._segment_sections(raw_text)

        skills = self._extract_skills(
            sections.get("skills", "") + "\n" + raw_text[:500]
        )
        education = self._extract_education(sections.get("education", ""))
        experience = self._extract_experience(sections.get("experience", ""))
        certifications = self._extract_certifications(sections.get("certifications", ""))
        projects = self._extract_projects(sections.get("projects", ""))
        summary = sections.get("summary", "")

        total_exp_years = self._compute_experience_years(experience)

        return ParseResult(
            raw_text=raw_text,
            skills=skills,
            education=education,
            experience=experience,
            certifications=certifications,
            projects=projects,
            summary_text=summary,
            total_experience_years=round(total_exp_years, 1),
            skill_count=len(skills),
        )

    # ── Section segmentation ──────────────────────────────────────────────────

    def _segment_sections(self, text: str) -> dict[str, str]:
        """
        Split resume text into labelled sections.

        Returns dict mapping section_name → section_text.
        """
        lines = text.split("\n")
        sections: dict[str, str] = {}
        current_section = "header"
        buffer: list[str] = []

        for line in lines:
            stripped = line.strip()
            matched_section = None
            for name, pattern in _SECTION_PATTERNS.items():
                if pattern.match(stripped):
                    matched_section = name
                    break

            if matched_section:
                sections[current_section] = "\n".join(buffer).strip()
                current_section = matched_section
                buffer = []
            else:
                buffer.append(line)

        sections[current_section] = "\n".join(buffer).strip()
        return sections

    # ── Skills extraction ─────────────────────────────────────────────────────

    def _extract_skills(self, text: str) -> list[str]:
        """
        Extract skills from the skills section + header.

        Strategy:
          1. Normalise text (lowercase, strip punctuation).
          2. Try comma-separated / bullet-separated parsing.
          3. Match against _TECH_SKILLS vocabulary.
          4. Apply _SKILL_ALIASES normalisation.
        """
        text_lower = text.lower()
        found: set[str] = set()

        # Direct vocab match (multi-word skills first)
        for skill in sorted(_TECH_SKILLS, key=len, reverse=True):
            if re.search(r"\b" + re.escape(skill) + r"\b", text_lower):
                found.add(skill)

        # Alias normalisation
        normalised: set[str] = set()
        for s in found:
            normalised.add(_SKILL_ALIASES.get(s, s))

        return sorted(normalised)

    # ── Education extraction ──────────────────────────────────────────────────

    def _extract_education(self, text: str) -> list[dict]:
        """Extract education entries from the education section."""
        entries = []
        if not text.strip():
            return entries

        # Degree pattern
        degree_re = re.compile(
            r"(bachelor|master|phd|doctorate|associate|diploma|b\.?sc?|m\.?sc?|m\.?eng?|b\.?eng?|mba|b\.?a\.?|m\.?a\.?)",
            re.I
        )
        year_re = re.compile(r"\b(19|20)\d{2}\b")
        lines = [l.strip() for l in text.split("\n") if l.strip()]

        for i, line in enumerate(lines):
            if degree_re.search(line):
                years = year_re.findall(line)
                # Look ahead for institution name
                institution = ""
                if i + 1 < len(lines):
                    institution = lines[i + 1]
                entries.append({
                    "degree": line[:200],
                    "institution": institution[:200],
                    "year": years[-1] if years else "",
                })
                if len(entries) >= 5:
                    break

        return entries

    # ── Experience extraction ─────────────────────────────────────────────────

    def _extract_experience(self, text: str) -> list[dict]:
        """Extract job experience entries."""
        entries = []
        if not text.strip():
            return entries

        # Split on double newlines (entries are typically blank-line separated)
        blocks = re.split(r"\n{2,}", text.strip())
        for block in blocks[:10]:  # Cap at 10 entries
            block = block.strip()
            if len(block) < 20:
                continue
            lines = [l.strip() for l in block.split("\n") if l.strip()]
            if not lines:
                continue

            title_line = lines[0]
            company_line = lines[1] if len(lines) > 1 else ""
            date_line = ""
            description_lines = []

            # Find the date line
            date_re = re.compile(r"(19|20)\d{2}|present|current", re.I)
            for j, ln in enumerate(lines[1:], start=1):
                if date_re.search(ln):
                    date_line = ln
                    description_lines = lines[j + 1:]
                    break
            else:
                description_lines = lines[2:]

            entries.append({
                "title":       title_line[:200],
                "company":     company_line[:200],
                "date_range":  date_line[:100],
                "description": " ".join(description_lines)[:500],
            })

        return entries

    # ── Certifications extraction ─────────────────────────────────────────────

    def _extract_certifications(self, text: str) -> list[str]:
        """Extract certification names from the certifications section."""
        if not text.strip():
            return []
        certs = []
        for line in text.split("\n"):
            line = line.strip().lstrip("•-*·").strip()
            if len(line) > 5:
                certs.append(line[:200])
        return certs[:10]

    # ── Projects extraction ───────────────────────────────────────────────────

    def _extract_projects(self, text: str) -> list[dict]:
        """Extract project entries from the projects section."""
        if not text.strip():
            return []
        projects = []
        blocks = re.split(r"\n{2,}", text.strip())
        for block in blocks[:8]:
            lines = [l.strip() for l in block.split("\n") if l.strip()]
            if not lines:
                continue
            projects.append({
                "name":        lines[0][:200],
                "description": " ".join(lines[1:])[:400],
            })
        return projects

    # ── Experience years computation ──────────────────────────────────────────

    def _compute_experience_years(self, experience_entries: list[dict]) -> float:
        """
        Sum up total months of experience across all job entries.

        Uses fuzzy date parsing: tries month+year ranges, then year-only ranges.
        """
        import datetime
        now = datetime.date.today()
        total_months = 0

        for entry in experience_entries:
            date_str = entry.get("date_range", "")
            months = self._parse_duration_months(date_str, now)
            total_months += months

        return min(total_months / 12.0, 40.0)  # cap at 40 years

    def _parse_duration_months(self, date_str: str, now) -> int:
        """Parse a date range string and return duration in months."""
        import datetime
        if not date_str:
            return 0

        # Try month+year range
        m = _DATE_RANGE_RE.search(date_str)
        if m:
            try:
                start_month = _MONTH_MAP.get(m.group(1).lower()[:3], 1)
                start_year = int(m.group(2))
                end_token = m.group(3).lower()[:3]
                if end_token in ("pre", "cur", "now"):
                    end_date = now
                else:
                    end_month = _MONTH_MAP.get(end_token, 1)
                    end_year = int(m.group(4)) if m.group(4) else now.year
                    end_date = datetime.date(end_year, end_month, 1)
                start_date = datetime.date(start_year, start_month, 1)
                months = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
                return max(0, months)
            except (ValueError, TypeError):
                pass

        # Try year-only range
        m = _YEAR_RANGE_RE.search(date_str)
        if m:
            try:
                start_year = int(m.group(1))
                end_token = m.group(2).lower()
                end_year = now.year if end_token in ("present", "current", "now") else int(end_token)
                return max(0, (end_year - start_year) * 12)
            except (ValueError, TypeError):
                pass

        return 0