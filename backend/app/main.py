from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile, status

from backend.app.api.schemas import DocumentUploadResponse
from backend.app.application.document_service import register_document_upload
from backend.app.infra import database
from backend.app.infra.sqlite_document_repository import SqliteDocumentRepository

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/tiff",
}
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".tiff"}


def create_app() -> FastAPI:
    app = FastAPI(title="Veterinary Medical Records API", version="0.1")
    app.state.document_repository = SqliteDocumentRepository()

    @app.on_event("startup")
    def on_startup() -> None:
        database.ensure_schema()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post(
        "/documents/upload",
        response_model=DocumentUploadResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def upload_document(
        file: UploadFile = File(...),
    ) -> DocumentUploadResponse:  # noqa: B008
        _validate_upload(file)
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Document exceeds the maximum allowed size of 10 MB.",
            )

        result = register_document_upload(
            filename=Path(file.filename).name,
            content_type=file.content_type or "",
            repository=app.state.document_repository,
        )

        return DocumentUploadResponse(
            document_id=result.document_id,
            state=result.state,
            message=result.message,
        )

    return app


def _validate_upload(file: UploadFile) -> None:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type.",
        )

    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file extension.",
        )


app = create_app()
