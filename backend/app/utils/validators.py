
"""
app/utils/validators.py

Low-level input validation helpers.

These are stateless functions used by schemas and services.
For Marshmallow schema validators see app/schemas/.

Usage:
    from app.utils.validators import validate_top_n, validate_enum
"""

from typing import Any


def validate_top_n(value: Any, default: int = 10, minimum: int = 1, maximum: int = 50) -> int:
    """
    Parse and clamp a top_n parameter to safe bounds.

    Args:
        value:   Raw input (could be str, int, None).
        default: Returned on parse failure.
        minimum: Floor value (inclusive).
        maximum: Ceiling value (inclusive).

    Returns:
        Clamped integer in [minimum, maximum].
    """
    try:
        return max(minimum, min(maximum, int(value)))
    except (TypeError, ValueError):
        return default


def validate_enum(value: str, allowed: tuple | list, field: str = "value") -> str:
    """
    Validate that value is one of the allowed options.

    Args:
        value:   The string to validate.
        allowed: Sequence of allowed strings.
        field:   Field name for the error message.

    Returns:
        The original value (unchanged).

    Raises:
        ValueError: If value is not in allowed.
    """
    if value not in allowed:
        options = ", ".join(f"'{v}'" for v in allowed)
        raise ValueError(f"Invalid {field} '{value}'. Must be one of: {options}.")
    return value


def validate_score_weights(weights: dict[str, float]) -> None:
    """
    Validate that a set of scoring weights sum approximately to 1.0.

    Args:
        weights: Dict of weight_name → float value.

    Raises:
        ValueError: If weights don't sum to ~1.0.
    """
    total = sum(weights.values())
    if not (0.99 <= total <= 1.01):
        raise ValueError(
            f"Score weights must sum to 1.0, got {total:.4f}. "
            f"Values: {weights}"
        )