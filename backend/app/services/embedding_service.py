"""
app/services/embedding_service.py

Singleton wrapper around a sentence-transformers model.

Design decisions:
  - Lazy loading: model is not loaded at import time.  It loads once on first
    encode() call and stays in memory.  This keeps startup fast and avoids
    crashing on environments without the model weights cached.
  - Thread-safe: a threading.Lock protects the one-time load.
  - Graceful degradation: if the model cannot load (no torch, OOM, etc.) the
    service marks itself unavailable.  All callers check .available before use.
  - Normalised vectors: encode() always L2-normalises outputs so cosine
    similarity == dot product (faster, avoids sqrt).

Usage:
    from app.services.embedding_service import EmbeddingService
    svc = EmbeddingService(model_name="all-MiniLM-L6-v2", cache_dir=".cache")
    vec = svc.encode("Python developer 3 years experience")          # np.ndarray
    sims = svc.cosine_similarity(resume_vec, job_vecs)               # np.ndarray
"""

import logging
import threading
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Lazy-loaded sentence-transformer embedding service.

    Attributes:
        model_name:  HuggingFace model identifier.
        cache_dir:   Local cache directory for downloaded weights.
        available:   True once the model loads successfully.
    """

    _instances: dict[str, "EmbeddingService"] = {}
    _lock = threading.Lock()

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", cache_dir: str = ".cache/embeddings"):
        self.model_name = model_name
        self.cache_dir = cache_dir
        self._model: Any = None
        self._model_lock = threading.Lock()
        self.available: bool | None = None
        self._load_attempted = False

    # ── Singleton factory ─────────────────────────────────────────────────────

    @classmethod
    def get_instance(cls, model_name: str = "all-MiniLM-L6-v2", cache_dir: str = ".cache/embeddings") -> "EmbeddingService":
        """Return the shared singleton for this model_name."""
        key = f"{model_name}::{cache_dir}"
        if key not in cls._instances:
            with cls._lock:
                if key not in cls._instances:
                    instance = cls(model_name=model_name, cache_dir=cache_dir)
                    cls._instances[key] = instance
        return cls._instances[key]

    # ── Model loading ─────────────────────────────────────────────────────────

    def _ensure_loaded(self) -> bool:
        """Load the model on first call. Thread-safe. Returns True if available."""
        if self._model is not None:
            self.available = True
            return True
        with self._model_lock:
            if self._model is not None:
                self.available = True
                return True
            try:
                self._load_attempted = True
                from sentence_transformers import SentenceTransformer
                logger.info("Loading embedding model: %s", self.model_name)
                self._model = SentenceTransformer(
                    self.model_name,
                    cache_folder=self.cache_dir,
                )
                self.available = True
                logger.info("Embedding model loaded successfully: %s", self.model_name)
                return True
            except ImportError:
                logger.warning(
                    "sentence-transformers not installed. "
                    "Semantic scoring will be unavailable."
                )
                self.available = False
                return False
            except Exception as exc:
                logger.error(
                    "Failed to load embedding model %s: %s",
                    self.model_name, exc, exc_info=True
                )
                self.available = False
                return False

    # ── Encoding ─────────────────────────────────────────────────────────────

    def encode(
    self,
    text: str | list[str],
    batch_size: int = 32,
    normalize: bool = True,
    ) -> np.ndarray:
        """
        Encode text into embedding vector(s).
        """

        # 🔴 HARD FAIL only after we've already tried loading and know it failed
        if self._load_attempted and self.available is False and self._model is None:
            raise RuntimeError(
                "Embedding model is unavailable. "
                "Check logs for the root cause."
            )

        # 🟡 Lazy load if not yet loaded
        if self._model is None:
            if not self._ensure_loaded():
                raise RuntimeError(
                    "Embedding model is unavailable. "
                    "Check logs for the root cause."
                )

        is_single = isinstance(text, str)
        texts = [text] if is_single else text

        embeddings = self._model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=normalize,
            show_progress_bar=False,
        )

        return embeddings[0] if is_single else embeddings

    # ── Similarity ────────────────────────────────────────────────────────────

    def cosine_similarity(
        self,
        query_vec: np.ndarray,
        candidate_vecs: np.ndarray,
    ) -> np.ndarray:
        """
        Compute cosine similarity between a query vector and N candidate vectors.

        Assumes both inputs are L2-normalised (encode with normalize=True).
        Under that assumption: cosine_similarity == dot product.

        Args:
            query_vec:      Shape (d,)
            candidate_vecs: Shape (N, d)

        Returns:
            np.ndarray of shape (N,) with similarities in [-1, 1].
        """
        if query_vec.ndim == 1:
            query_vec = query_vec.reshape(1, -1)
        if candidate_vecs.ndim == 1:
            candidate_vecs = candidate_vecs.reshape(1, -1)
        sims = np.dot(candidate_vecs, query_vec.T).squeeze()
        return np.clip(sims, -1.0, 1.0)

    def encode_pair(self, text_a: str, text_b: str) -> float:
        """
        Encode two texts and return their cosine similarity (0.0–1.0).

        Convenience method for single-pair comparisons.
        """
        vecs = self.encode([text_a, text_b])
        sim = float(np.dot(vecs[0], vecs[1]))
        return max(0.0, min(1.0, sim))

    def __repr__(self) -> str:
        status = "available" if self.available else "unavailable"
        return f"EmbeddingService(model={self.model_name!r}, status={status})"
