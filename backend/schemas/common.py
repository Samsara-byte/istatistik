from __future__ import annotations

from typing import Any


def paginate(total: int, page: int, limit: int) -> dict[str, int]:
    """Return standard pagination metadata."""
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }
