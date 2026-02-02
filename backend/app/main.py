"""FastAPI application factory and composition root.

This module wires the HTTP API layer to application services and infrastructure
adapters. It is intentionally lightweight: routes remain thin adapters and
business logic lives in the application/domain layers.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.api.routes import MAX_UPLOAD_SIZE as ROUTE_MAX_UPLOAD_SIZE
from backend.app.api.routes import router as api_router
from backend.app.infra import database
from backend.app.infra.sqlite_document_repository import SqliteDocumentRepository


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
        yield

    app = FastAPI(
        title="Veterinary Medical Records API",
        description=(
            "API for registering veterinary medical record documents and tracking their "
            "processing lifecycle (Release 0: metadata only)."
        ),
        version="0.1",
        lifespan=lifespan,
    )
    app.state.document_repository = SqliteDocumentRepository()
    global MAX_UPLOAD_SIZE
    MAX_UPLOAD_SIZE = ROUTE_MAX_UPLOAD_SIZE  # re-export for compatibility
    app.include_router(api_router)

    return app


app = create_app()
