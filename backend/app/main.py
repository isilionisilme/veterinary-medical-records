from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile, status

from backend.app import database, models, schemas

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

    @app.on_event("startup")
    def on_startup() -> None:
        database.ensure_schema()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post(
        "/documents/upload",
        response_model=schemas.DocumentUploadResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def upload_document(
        file: UploadFile = File(...),
    ) -> schemas.DocumentUploadResponse:  # noqa: B008
        _validate_upload(file)
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Document exceeds the maximum allowed size of 10 MB.",
            )

        document_id = str(uuid4())
        now = datetime.now(UTC).isoformat()
        state = models.ProcessingStatus.UPLOADED.value

        with database.get_connection() as conn:
            conn.execute(
                """
                INSERT INTO documents (document_id, filename, content_type, created_at, state)
                VALUES (?, ?, ?, ?, ?)
                """,
                (document_id, Path(file.filename).name, file.content_type, now, state),
            )
            conn.execute(
                """
                INSERT INTO document_status_history (document_id, state, created_at)
                VALUES (?, ?, ?)
                """,
                (document_id, state, now),
            )
            conn.commit()

        return schemas.DocumentUploadResponse(
            document_id=document_id,
            state=state,
            message="Document registered successfully.",
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
