"""
config/settings.py

Multi-environment configuration module.

Design:
  - BaseConfig holds ALL shared settings.
  - Environment-specific subclasses override only what changes.
  - Every setting is read from environment with an explicit default.
  - get_config() is the single entry point for the app factory.

Usage:
    from config import get_config
    cfg = get_config("production")
"""

import os
from typing import List

from dotenv import load_dotenv

# Load .env file if present (no-op if file doesn't exist)
load_dotenv()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _list_env(key: str, default: str) -> List[str]:
    """Read a comma-separated env var as a list of stripped strings."""
    return [v.strip() for v in os.getenv(key, default).split(",") if v.strip()]


def _float_env(key: str, default: float) -> float:
    """Read an env var as float with a numeric default."""
    try:
        return float(os.getenv(key, str(default)))
    except ValueError:
        return default


def _int_env(key: str, default: int) -> int:
    """Read an env var as int with a numeric default."""
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


def _bool_env(key: str, default: bool) -> bool:
    """Read an env var as bool (true/1/yes → True)."""
    val = os.getenv(key, str(default)).lower()
    return val in ("true", "1", "yes")


# ─────────────────────────────────────────────────────────────────────────────
# Base Configuration
# ─────────────────────────────────────────────────────────────────────────────

class BaseConfig:
    """
    Shared configuration for all environments.

    All secrets MUST come from environment variables — no hardcoded values.
    Settings that differ per environment are overridden in subclasses.
    """

    # ── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "AI Resume Intelligence Platform"
    API_VERSION: str = "v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-change-in-production")

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = _int_env("PORT", 5000)
    WORKERS: int = _int_env("WORKERS", 2)

    # ── Database ──────────────────────────────────────────────────────────────
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    SQLALCHEMY_ECHO: bool = False  # Set True for query debug logging
    # Connection pool settings (ignored by SQLite)
    SQLALCHEMY_ENGINE_OPTIONS: dict = {
        "pool_pre_ping": True,        # Reconnect on stale connections
        "pool_recycle": 300,          # Recycle connections every 5 minutes
        "pool_size": 5,
        "max_overflow": 10,
    }

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = _list_env("ALLOWED_ORIGINS", "http://localhost:3000")

    # ── File Uploads ─────────────────────────────────────────────────────────
    UPLOAD_FOLDER: str = os.getenv("UPLOAD_FOLDER", "uploads/")
    MAX_CONTENT_LENGTH: int = _int_env("MAX_UPLOAD_MB", 10) * 1024 * 1024
    ALLOWED_EXTENSIONS: set = set(_list_env("ALLOWED_EXTENSIONS", "pdf,docx"))

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = os.getenv("LOG_FORMAT", "json")

    # ── Embeddings ───────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    EMBEDDING_CACHE_DIR: str = os.getenv("EMBEDDING_CACHE_DIR", ".cache/embeddings")

    # ── Matching Weights (must sum to 1.0) ───────────────────────────────────
    WEIGHT_SEMANTIC: float = _float_env("WEIGHT_SEMANTIC", 0.40)
    WEIGHT_KEYWORD: float = _float_env("WEIGHT_KEYWORD", 0.35)
    WEIGHT_EXPERIENCE: float = _float_env("WEIGHT_EXPERIENCE", 0.15)
    WEIGHT_SECTION_QUALITY: float = _float_env("WEIGHT_SECTION_QUALITY", 0.10)

    # ── ATS Score Thresholds ──────────────────────────────────────────────────
    ATS_SCORE_THRESHOLD_EXCELLENT: float = _float_env("ATS_SCORE_THRESHOLD_EXCELLENT", 0.80)
    ATS_SCORE_THRESHOLD_GOOD: float = _float_env("ATS_SCORE_THRESHOLD_GOOD", 0.65)
    ATS_SCORE_THRESHOLD_FAIR: float = _float_env("ATS_SCORE_THRESHOLD_FAIR", 0.50)

    # ── Recommendations ──────────────────────────────────────────────────────
    TOP_N_JOB_RECOMMENDATIONS: int = _int_env("TOP_N_JOB_RECOMMENDATIONS", 10)
    TOP_N_ROLE_SUGGESTIONS: int = _int_env("TOP_N_ROLE_SUGGESTIONS", 4)
    TOP_N_CANDIDATES_PER_JOB: int = _int_env("TOP_N_CANDIDATES_PER_JOB", 3)

    # ── Groq LLM ─────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    GROQ_MAX_TOKENS: int = _int_env("GROQ_MAX_TOKENS", 1024)
    GROQ_TEMPERATURE: float = _float_env("GROQ_TEMPERATURE", 0.3)
    GROQ_TIMEOUT_SECONDS: int = _int_env("GROQ_TIMEOUT_SECONDS", 30)

    # ── Pagination ────────────────────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = _int_env("DEFAULT_PAGE_SIZE", 20)
    MAX_PAGE_SIZE: int = _int_env("MAX_PAGE_SIZE", 100)


# ─────────────────────────────────────────────────────────────────────────────
# Environment-Specific Subclasses
# ─────────────────────────────────────────────────────────────────────────────

class DevelopmentConfig(BaseConfig):
    """
    Development — verbose, hot-reload friendly, SQLite by default.
    Never use this in production.
    """
    DEBUG: bool = True
    TESTING: bool = False
    SQLALCHEMY_DATABASE_URI: str = os.getenv("DATABASE_URL", "sqlite:///dev.db")
    SQLALCHEMY_ECHO: bool = False  # Flip to True to see SQL queries


class ProductionConfig(BaseConfig):
    """
    Production — PostgreSQL required, debug off, tighter limits.
    DATABASE_URL must be set in environment (Render injects it automatically).
    """
    DEBUG: bool = False
    TESTING: bool = False
    LOG_LEVEL: str = "WARNING"
    LOG_FORMAT: str = "json"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:  # type: ignore[override]
        uri = os.getenv("DATABASE_URL")
        if not uri:
            raise EnvironmentError(
                "DATABASE_URL must be set in production. "
                "Set it in Render → Environment Variables."
            )
        # Render injects postgres:// — SQLAlchemy 2.x requires postgresql://
        if uri.startswith("postgres://"):
            uri = uri.replace("postgres://", "postgresql://", 1)
        return uri


class TestingConfig(BaseConfig):
    """
    Testing — in-memory SQLite, CSRF off, small limits.
    """
    DEBUG: bool = True
    TESTING: bool = True
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///:memory:"
    WTF_CSRF_ENABLED: bool = False
    LOG_LEVEL: str = "ERROR"  # Suppress noise during tests


# ─────────────────────────────────────────────────────────────────────────────
# Config Registry
# ─────────────────────────────────────────────────────────────────────────────

_CONFIG_REGISTRY: dict = {
    "development": DevelopmentConfig,
    "production":  ProductionConfig,
    "testing":     TestingConfig,
}


def get_config(env: str | None = None) -> type:
    """
    Return the configuration class for the given environment name.

    Args:
        env: One of 'development', 'production', 'testing'.
             Falls back to APP_ENV env var, then 'development'.

    Returns:
        A configuration class (not an instance — Flask's from_object handles instantiation).

    Raises:
        ValueError: If an unrecognised environment name is provided.
    """
    resolved = env or os.getenv("APP_ENV", "development")
    config_class = _CONFIG_REGISTRY.get(resolved)
    if config_class is None:
        valid = ", ".join(_CONFIG_REGISTRY.keys())
        raise ValueError(
            f"Unknown environment '{resolved}'. Valid options: {valid}"
        )
    return config_class