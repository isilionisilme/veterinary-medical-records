"""Health-related API routes."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, Response

from backend.app.api.schemas import HealthResponse
from backend.app.infra import database
from backend.app.settings import get_settings

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Return a minimal status payload for uptime monitoring.",
)
def health(response: Response) -> HealthResponse:
    """Health check endpoint with dependency readiness checks."""

    overall = "healthy"
    database_status = "ok"
    storage_status = "ok"

    try:
        db_path = database.get_database_path()
        with database.get_connection() as conn:
            conn.execute("SELECT 1")
        _ = db_path
    except Exception as exc:  # pragma: no cover - exercised by tests with stubs
        _ = exc
        database_status = "error"
        overall = "degraded"

    try:
        storage_path = Path(get_settings().vet_records_storage_path)
        if storage_path.exists() and os.access(storage_path, os.W_OK):
            storage_status = "ok"
        else:
            storage_status = "error"
            overall = "degraded"
    except Exception as exc:  # pragma: no cover - exercised by tests with stubs
        _ = exc
        storage_status = "error"
        overall = "degraded"

    response.status_code = 200 if overall == "healthy" else 503
    return HealthResponse(
        status=overall,
        database=database_status,
        storage=storage_status,
    )
