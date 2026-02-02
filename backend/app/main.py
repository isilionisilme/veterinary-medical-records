from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.api.routes import MAX_UPLOAD_SIZE as ROUTE_MAX_UPLOAD_SIZE
from backend.app.api.routes import router as api_router
from backend.app.infra import database
from backend.app.infra.sqlite_document_repository import SqliteDocumentRepository


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database.ensure_schema()
        yield

    app = FastAPI(title="Veterinary Medical Records API", version="0.1", lifespan=lifespan)
    app.state.document_repository = SqliteDocumentRepository()
    global MAX_UPLOAD_SIZE
    MAX_UPLOAD_SIZE = ROUTE_MAX_UPLOAD_SIZE  # re-export for compatibility
    app.include_router(api_router)

    return app


app = create_app()
