"""Health-related API routes."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.app.infra import database
from backend.app.settings import get_settings

router = APIRouter()


@router.get(
    "/health",
    summary="Health check",
    description="Return a minimal status payload for uptime monitoring.",
)
def health() -> JSONResponse:
    """Health check endpoint with dependency readiness checks."""

    checks: dict[str, dict[str, str]] = {}
    overall = "ok"

    try:
        db_path = database.get_database_path()
        with database.get_connection() as conn:
            conn.execute("SELECT 1")
        checks["database"] = {"status": "ok", "path": str(db_path)}
    except Exception as exc:  # pragma: no cover - exercised by tests with stubs
        checks["database"] = {"status": "error", "detail": str(exc)}
        overall = "degraded"

    try:
        storage_path = Path(get_settings().vet_records_storage_path)
        if storage_path.exists() and os.access(storage_path, os.W_OK):
            checks["storage"] = {"status": "ok", "path": str(storage_path)}
        else:
            checks["storage"] = {"status": "error", "path": str(storage_path)}
            overall = "degraded"
    except Exception as exc:  # pragma: no cover - exercised by tests with stubs
        checks["storage"] = {"status": "error", "detail": str(exc)}
        overall = "degraded"

    status_code = 200 if overall == "ok" else 503
    return JSONResponse(status_code=status_code, content={"status": overall, "checks": checks})
