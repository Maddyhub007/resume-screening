
"""
app/models/mixins.py

Reusable SQLAlchemy ORM mixins.

Design:
  - Mixins are __abstract__ classes that add columns/methods to any model
    that inherits from them.
  - They do NOT introduce new tables. They inject columns directly into the
    inheriting model's table.
  - Keep each mixin focused on a single cross-cutting concern.

Available mixins:
  - SoftDeleteMixin:  Adds is_deleted + deleted_at. Prevents hard-deletes
                      from losing analytics history. Use on Job, Resume.
  - SearchableMixin:  Adds a helper to build ILIKE search clauses for
                      full-text search on string columns (PostgreSQL / SQLite).

Usage:
    from app.models.mixins import SoftDeleteMixin

    class Job(BaseModel, SoftDeleteMixin):
        __tablename__ = "jobs"
        ...
        # Now has: is_deleted, deleted_at, soft_delete(), restore()
"""

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import db

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Soft Delete Mixin
# ─────────────────────────────────────────────────────────────────────────────

class SoftDeleteMixin:
    """
    Adds soft-delete capability to a model.

    Columns added:
      - is_deleted (Boolean, default False, indexed)
      - deleted_at (DateTime, nullable)

    Methods:
      - soft_delete():  Mark as deleted (does NOT call db.session.delete).
      - restore():      Undelete a record.
      - is_alive (property): True when not soft-deleted.

    Important:
      Soft-deleted records are NOT filtered out automatically.
      Repository methods must apply .filter(Model.is_deleted == False)
      unless explicitly querying deleted records.
      This is intentional — the mixin stays dumb, the query logic stays
      in the repository where it belongs.
    """

    __abstract__ = True

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,     # Indexed — nearly every query filters on this
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    def soft_delete(self) -> None:
        """
        Mark this record as deleted.

        Does NOT flush or commit — caller controls the transaction.
        """
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        logger.info(
            "Record soft-deleted",
            extra={"model": self.__class__.__name__, "id": getattr(self, "id", "?")},
        )

    def restore(self) -> None:
        """
        Restore a soft-deleted record.

        Does NOT flush or commit — caller controls the transaction.
        """
        self.is_deleted = False
        self.deleted_at = None
        logger.info(
            "Record restored",
            extra={"model": self.__class__.__name__, "id": getattr(self, "id", "?")},
        )

    @property
    def is_alive(self) -> bool:
        """True when the record is NOT soft-deleted."""
        return not self.is_deleted

    def to_dict(self, exclude: set[str] | None = None) -> dict[str, Any]:
        """
        Override to_dict to include soft-delete fields.

        Calls super().to_dict() — works correctly in MRO for multi-inheritance.
        """
        d = super().to_dict(exclude=exclude)  # type: ignore[misc]
        if exclude and "deleted_at" not in exclude:
            val = self.deleted_at
            d["deleted_at"] = val.isoformat() if val else None
        return d


# ─────────────────────────────────────────────────────────────────────────────
# Searchable Mixin
# ─────────────────────────────────────────────────────────────────────────────

class SearchableMixin:
    """
    Adds a class-method helper for building ILIKE search filters.

    Usage:
        query = Job.search_filter(query, search_term, [Job.title, Job.company])
    """

    __abstract__ = True

    @classmethod
    def search_filter(cls, query, term: str, columns: list):
        """
        Apply ILIKE filter across multiple text columns (OR logic).

        Works on both PostgreSQL (uses native ILIKE) and SQLite
        (SQLAlchemy translates ILIKE to LIKE, case-insensitive by default).

        Args:
            query:   Active SQLAlchemy query object.
            term:    Search string (stripped, lowercased internally).
            columns: List of mapped column attributes to search across.

        Returns:
            Filtered query.
        """
        if not term or not term.strip():
            return query

        pattern = f"%{term.strip()}%"
        from sqlalchemy import or_
        return query.filter(
            or_(*[col.ilike(pattern) for col in columns])
        )