
"""
app/utils/pagination.py

Reusable pagination helper.

Centralises pagination argument parsing and validation so every
list endpoint uses consistent, validated page/limit values.

Usage:
    from app.utils.pagination import paginate_query, PaginationParams

    # Parse from request.args
    params = PaginationParams.from_request()

    # Apply to a SQLAlchemy query
    items, total = paginate_query(query, params)

    # Build response
    return success_list(data=[i.to_dict() for i in items],
                        total=total, page=params.page, limit=params.limit)
"""

from dataclasses import dataclass
from typing import TypeVar

from flask import current_app, request
from sqlalchemy.orm import Query

from app.core.exceptions import ValidationError

T = TypeVar("T")


@dataclass
class PaginationParams:
    """Validated pagination parameters."""
    page:  int
    limit: int

    @classmethod
    def from_request(cls) -> "PaginationParams":
        """
        Parse page and limit from the current Flask request.args.

        Applies defaults from app config and caps at MAX_PAGE_SIZE.
        Raises ValidationError on non-integer input.
        """
        default_limit = current_app.config.get("DEFAULT_PAGE_SIZE", 20)
        max_limit     = current_app.config.get("MAX_PAGE_SIZE", 100)

        try:
            page  = int(request.args.get("page", 1))
            limit = int(request.args.get("limit", default_limit))
        except (ValueError, TypeError) as exc:
            raise ValidationError(
                "Query params 'page' and 'limit' must be positive integers.",
                details={"page": request.args.get("page"), "limit": request.args.get("limit")},
            ) from exc

        if page < 1:
            raise ValidationError("Query param 'page' must be >= 1.")
        if limit < 1:
            raise ValidationError("Query param 'limit' must be >= 1.")

        # Silently cap — don't error, just enforce the ceiling
        limit = min(limit, max_limit)

        return cls(page=page, limit=limit)

    @property
    def offset(self) -> int:
        """SQL OFFSET value for this page."""
        return (self.page - 1) * self.limit


def paginate_query(query: Query, params: PaginationParams) -> tuple[list, int]:
    """
    Apply pagination to a SQLAlchemy query.

    Args:
        query:  SQLAlchemy query object (not yet executed).
        params: Validated PaginationParams.

    Returns:
        (items, total) — items is the sliced list, total is the full count.
    """
    total = query.count()
    items = query.offset(params.offset).limit(params.limit).all()
    return items, total