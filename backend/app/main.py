"""FastAPI application factory and composition root.

This module wires the HTTP API layer to application services and infrastructure
adapters. It is intentionally lightweight: routes remain thin adapters and
business logic lives in the application/domain layers.
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import cast

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import MAX_UPLOAD_SIZE as ROUTE_MAX_UPLOAD_SIZE
from backend.app.api.routes import router as api_router
from backend.app.application.processing_runner import processing_scheduler
from backend.app.infra import database
from backend.app.infra.file_storage import LocalFileStorage
from backend.app.infra.sqlite_document_repository import SqliteDocumentRepository
from backend.app.ports.document_repository import DocumentRepository
from backend.app.ports.file_storage import FileStorage

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _processing_enabled() -> bool:
    raw = os.environ.get("VET_RECORDS_DISABLE_PROCESSING")
    if raw is None:
        return True
    return raw.strip().lower() not in {"1", "true", "yes", "on"}


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    This function is the composition root for the backend service. It wires the
    API router, configures the document repository adapter, and ensures the
    database schema exists at startup.

    Returns:
        The configured FastAPI application instance.

    Side Effects:
        - Ensures the SQLite schema exists on application startup.
        - Sets `app.state.document_repository` for request handlers.
        - Re-exports `MAX_UPLOAD_SIZE` for compatibility with existing imports.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        """FastAPI lifespan handler used to perform startup initialization."""

        database.ensure_schema()
        repository = cast(DocumentRepository, app.state.document_repository)
        storage = cast(FileStorage, app.state.file_storage)
        recovered = repository.recover_orphaned_runs(completed_at=_now_iso())
        if recovered:
            logger.info("Recovered %s orphaned runs", recovered)
        if _processing_enabled():
            stop_event = asyncio.Event()
            app.state.processing_stop_event = stop_event
            app.state.processing_task = asyncio.create_task(
                processing_scheduler(
                    repository=repository,
                    storage=storage,
                    stop_event=stop_event,
                )
            )
        else:
            app.state.processing_stop_event = None
            app.state.processing_task = None
        yield
        if app.state.processing_stop_event is not None:
            app.state.processing_stop_event.set()
            await app.state.processing_task

    app = FastAPI(
        title="Veterinary Medical Records API",
        description=(
            "API for registering veterinary medical record documents and tracking their "
            "processing lifecycle (Release 0: metadata only)."
        ),
        version="0.1",
        lifespan=lifespan,
    )
    cors_origins = _get_cors_origins()
    if cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    app.state.document_repository = SqliteDocumentRepository()
    app.state.file_storage = LocalFileStorage()
    global MAX_UPLOAD_SIZE
    MAX_UPLOAD_SIZE = ROUTE_MAX_UPLOAD_SIZE  # re-export for compatibility
    app.include_router(api_router)

    return app


def _get_cors_origins() -> list[str]:
    """Return the configured list of CORS origins for local development.

    Uses the comma-separated `VET_RECORDS_CORS_ORIGINS` environment variable.
    Defaults to the local Vite dev server origins when unset.
    """

    raw = os.environ.get("VET_RECORDS_CORS_ORIGINS")
    if raw is None:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins


app = create_app()
