"""FastAPI routes (thin adapters)."""

from __future__ import annotations

from pathlib import Path
from typing import cast

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from backend.app.api.schemas import DocumentUploadResponse
from backend.app.application.document_service import register_document_upload
from backend.app.ports.document_repository import DocumentRepository

router = APIRouter()

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


@router.get(
    "/health",
    summary="Health check",
    description="Return a minimal status payload for uptime monitoring.",
)
def health() -> dict[str, str]:
    """Health check endpoint."""

    return {"status": "ok"}


@router.post(
    "/documents/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a document upload",
    description=(
        "Validate an uploaded file and register its metadata. "
        "Release 0 stores metadata only (no file persistence)."
    ),
    responses={
        413: {"description": "Uploaded file exceeds the maximum allowed size (10 MB)."},
        415: {"description": "Unsupported content type or file extension."},
    },
)
async def upload_document(
    request: Request,
    file: UploadFile = File(  # noqa: B008
        ...,
        description="Document file to register (validated for type/extension and size).",
    ),
) -> DocumentUploadResponse:
    """Register a document upload (metadata only for Release 0).

    Args:
        request: Incoming FastAPI request (used to access app state).
        file: Uploaded file sent as multipart/form-data.

    Returns:
        Metadata about the registered document and its initial lifecycle state.

    Raises:
        HTTPException: If the upload is invalid (unsupported type/extension) or
            exceeds the maximum allowed size.
    """

    _validate_upload(file)
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Document exceeds the maximum allowed size of 10 MB.",
        )

    repository = cast(DocumentRepository, request.app.state.document_repository)
    result = register_document_upload(
        filename=Path(file.filename).name,
        content_type=file.content_type or "",
        repository=repository,
    )

    return DocumentUploadResponse(
        document_id=result.document_id,
        state=result.state,
        message=result.message,
    )


def _validate_upload(file: UploadFile) -> None:
    """Validate uploaded file content type and file extension.

    Args:
        file: Uploaded file to validate.

    Raises:
        HTTPException: If the content type or extension is not allowed.
    """

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

