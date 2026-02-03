"""FastAPI routes (thin adapters)."""

from __future__ import annotations

from pathlib import Path
from typing import cast

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from backend.app.api.schemas import DocumentResponse, DocumentUploadResponse
from backend.app.application.document_service import get_document, register_document_upload
from backend.app.ports.document_repository import DocumentRepository

router = APIRouter()

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"application/pdf"}
ALLOWED_EXTENSIONS = {".pdf"}


@router.get(
    "/health",
    summary="Health check",
    description="Return a minimal status payload for uptime monitoring.",
)
def health() -> dict[str, str]:
    """Health check endpoint."""

    return {"status": "ok"}


@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get document processing status",
    description="Return document metadata and its current processing state.",
    responses={404: {"description": "Document not found."}},
)
def get_document_status(request: Request, document_id: str) -> DocumentResponse:
    """Return the document processing status for a given document id.

    Args:
        request: Incoming FastAPI request (used to access app state).
        document_id: Unique identifier for the document.

    Returns:
        Document metadata including its current processing state.

    Raises:
        HTTPException: If the document does not exist.
    """

    repository = cast(DocumentRepository, request.app.state.document_repository)
    document = get_document(document_id=document_id, repository=repository)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    return DocumentResponse(
        document_id=document.document_id,
        filename=document.filename,
        content_type=document.content_type,
        created_at=document.created_at,
        state=document.state.value,
    )


@router.post(
    "/documents/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a document upload",
    description=(
        "Validate an uploaded file and register its metadata. "
        "Release 1 stores the file on disk and persists a reference path."
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
    """Register a document upload and persist it on disk.

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
    filename = Path(file.filename or "").name
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Missing filename.",
        )
    result = register_document_upload(
        filename=filename,
        content_type=file.content_type or "",
        file_bytes=contents,
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

