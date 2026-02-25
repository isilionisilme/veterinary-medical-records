"""Health-related API routes."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get(
    "/health",
    summary="Health check",
    description="Return a minimal status payload for uptime monitoring.",
)
def health() -> dict[str, str]:
    """Health check endpoint."""

    return {"status": "ok"}
