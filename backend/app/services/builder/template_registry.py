"""
app/services/builder/template_registry.py

Template registry for the AI Resume Builder.

Design:
  - Templates are defined entirely in code — no DB table, no migration cost.
  - Backend returns STRUCTURE only (section order, tone, metadata).
  - Frontend owns all visual rendering (colours, fonts, layout CSS).
  - New template = add one dict entry; zero other changes required.

Each template dict:
  id            — Registry key (used in ResumeDraft.template_id)
  name          — Human-readable label shown in picker UI
  description   — Short UI description
  layout        — "single-column" | "two-column" | "skills-first"
  section_order — Ordered list fed to the frontend renderer
  tone          — "professional" | "technical" | "executive"
                  Passed into the Groq generation prompt as a tone hint.
  keyword_density — "high" | "medium"
                    Passed into Groq prompt: high → more skill repetition.
  accent_color  — Hex hint for frontend (non-binding; frontend may override)
  font_family   — Font stack hint for frontend
  best_for      — List of role-type tags (informational only)
"""

from __future__ import annotations

DEFAULT_TEMPLATE_ID = "modern"

TEMPLATES: dict[str, dict] = {
    "modern": {
        "id":              "modern",
        "name":            "Modern",
        "description":     "Two-column layout with skills sidebar. Clean and contemporary.",
        "layout":          "two-column",
        "section_order":   ["summary", "skills", "experience", "projects", "education", "certifications"],
        "tone":            "professional",
        "keyword_density": "high",
        "accent_color":    "#2563EB",
        "font_family":     "Inter, system-ui, sans-serif",
        "best_for":        ["software_engineering", "product", "design", "data_science"],
    },
    "classic": {
        "id":              "classic",
        "name":            "Classic",
        "description":     "Traditional single-column format. Formal and widely accepted.",
        "layout":          "single-column",
        "section_order":   ["summary", "experience", "education", "skills", "certifications", "projects"],
        "tone":            "executive",
        "keyword_density": "medium",
        "accent_color":    "#1F2937",
        "font_family":     "Georgia, 'Times New Roman', serif",
        "best_for":        ["finance", "law", "consulting", "management", "government"],
    },
    "minimal": {
        "id":              "minimal",
        "name":            "Minimal",
        "description":     "Whitespace-heavy and ultra-clean. Preferred by tech startups.",
        "layout":          "single-column",
        "section_order":   ["summary", "skills", "experience", "education", "projects"],
        "tone":            "professional",
        "keyword_density": "high",
        "accent_color":    "#374151",
        "font_family":     "'DM Sans', 'Helvetica Neue', sans-serif",
        "best_for":        ["startup", "saas", "devops", "backend", "frontend"],
    },
    "technical": {
        "id":              "technical",
        "name":            "Technical",
        "description":     "Skills-first layout with dense tech stack tables. Best for engineering roles.",
        "layout":          "skills-first",
        "section_order":   ["skills", "summary", "experience", "projects", "education", "certifications"],
        "tone":            "technical",
        "keyword_density": "high",
        "accent_color":    "#0F766E",
        "font_family":     "'JetBrains Mono', 'Fira Code', monospace",
        "best_for":        ["backend_engineering", "devops", "ml_engineering", "platform"],
    },
}


def get_template(template_id: str) -> dict:
    """
    Return template metadata for a given registry key.

    Returns a copy — safe for callers to mutate.
    Falls back to DEFAULT_TEMPLATE_ID if key is unknown.
    """
    return dict(TEMPLATES.get(template_id) or TEMPLATES[DEFAULT_TEMPLATE_ID])


def list_templates() -> list[dict]:
    """All templates as a sorted list of dicts."""
    return [dict(v) for v in sorted(TEMPLATES.values(), key=lambda t: t["id"])]


def valid_template_ids() -> list[str]:
    """Sorted list of valid template ID strings (for schema validation)."""
    return sorted(TEMPLATES.keys())
