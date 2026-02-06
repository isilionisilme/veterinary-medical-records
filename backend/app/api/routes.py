"""FastAPI routes (thin adapters)."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from fastapi import APIRouter, File, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse, Response

from backend.app.api.schemas import (
    DocumentListItemResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentUploadResponse,
    LatestRunResponse,
)
from backend.app.application.document_service import (
    get_document_original_location,
    get_document_status_details,
    list_documents,
    register_document_upload,
)
from backend.app.ports.document_repository import DocumentRepository
from backend.app.ports.file_storage import FileStorage

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
}
ALLOWED_EXTENSIONS = {".pdf"}
DEFAULT_LIST_LIMIT = 50


@router.get(
    "/health",
    summary="Health check",
    description="Return a minimal status payload for uptime monitoring.",
)
def health() -> dict[str, str]:
    """Health check endpoint."""

    return {"status": "ok"}


@router.get(
    "/documents",
    response_model=DocumentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List uploaded documents and their status",
    description="Return paginated documents with derived processing status.",
    responses={500: {"description": "Unexpected system failure."}},
)
def list_documents_route(
    request: Request,
    limit: int = Query(
        DEFAULT_LIST_LIMIT,
        ge=1,
        description="Maximum number of documents to return.",
    ),
    offset: int = Query(
        0,
        ge=0,
        description="Pagination offset.",
    ),
) -> DocumentListResponse | JSONResponse:
    """Return a paginated list of documents with derived status labels.

    Args:
        request: Incoming FastAPI request (used to access app state).
        limit: Maximum number of documents to return.
        offset: Pagination offset.

    Returns:
        Paginated document list response or error payload.
    """

    repository = cast(DocumentRepository, request.app.state.document_repository)
    try:
        result = list_documents(repository=repository, limit=limit, offset=offset)
    except Exception as exc:  # pragma: no cover - defensive
        _log_event(
            event_type="DOCUMENT_LIST_VIEW_FAILED",
            document_id=None,
            failure_reason=str(exc),
        )
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DOCUMENT_LIST_FAILED",
            message="Unexpected error while listing documents.",
        )

    _log_event(
        event_type="DOCUMENT_LIST_VIEWED",
        document_id=None,
        count_returned=len(result.items),
    )

    items = [
        DocumentListItemResponse(
            document_id=item.document_id,
            original_filename=item.original_filename,
            created_at=item.created_at,
            status=item.status,
            status_label=item.status_label,
            failure_type=item.failure_type,
        )
        for item in result.items
    ]
    return DocumentListResponse(
        items=items,
        limit=result.limit,
        offset=result.offset,
        total=result.total,
    )


@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get document processing status",
    description="Return document metadata and its current processing state.",
    responses={404: {"description": "Document not found (DOCUMENT_NOT_FOUND)."}},
)
def get_document_status(request: Request, document_id: str) -> DocumentResponse | JSONResponse:
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
    details = get_document_status_details(document_id=document_id, repository=repository)
    if details is None:
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="DOCUMENT_NOT_FOUND",
            message="Document not found.",
        )

    latest_run = None
    if details.latest_run is not None:
        latest_run = LatestRunResponse(
            run_id=details.latest_run.run_id,
            state=details.latest_run.state.value,
            failure_type=details.latest_run.failure_type,
        )

    _log_event(
        event_type="DOCUMENT_METADATA_VIEWED",
        document_id=details.document.document_id,
        run_id=details.latest_run.run_id if details.latest_run else None,
    )

    return DocumentResponse(
        document_id=details.document.document_id,
        original_filename=details.document.original_filename,
        content_type=details.document.content_type,
        file_size=details.document.file_size,
        created_at=details.document.created_at,
        updated_at=details.document.updated_at,
        status=details.status_view.status.value,
        status_message=details.status_view.status_message,
        failure_type=details.status_view.failure_type,
        latest_run=latest_run,
    )


@router.get(
    "/documents/{document_id}/original",
    status_code=status.HTTP_200_OK,
    response_class=FileResponse,
    response_model=None,
    summary="Download or preview an original document",
    description="Return the original uploaded PDF for preview or download.",
    responses={
        404: {"description": "Document not found (DOCUMENT_NOT_FOUND)."},
        410: {"description": "Original file missing (ORIGINAL_FILE_MISSING)."},
        500: {"description": "Unexpected filesystem or I/O failure."},
    },
)
def get_document_original(
    request: Request,
    document_id: str,
    download: bool = Query(
        False,
        description="Return the document as an attachment when true; inline preview otherwise.",
    ),
) -> Response:
    """Return the original uploaded document file.

    Args:
        request: Incoming FastAPI request (used to access app state).
        document_id: Unique identifier for the document.
        download: When true, set Content-Disposition to attachment for download.

    Returns:
        A streamed PDF response or an error payload.
    """

    repository = cast(DocumentRepository, request.app.state.document_repository)
    storage = cast(FileStorage, request.app.state.file_storage)
    location = get_document_original_location(
        document_id=document_id,
        repository=repository,
        storage=storage,
    )
    if location is None:
        _log_event(
            event_type="DOCUMENT_ORIGINAL_ACCESS_FAILED",
            document_id=document_id,
            failure_reason="Document metadata not found.",
        )
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="DOCUMENT_NOT_FOUND",
            message="Document not found.",
        )
    if not location.exists:
        _log_event(
            event_type="DOCUMENT_ORIGINAL_ACCESS_FAILED",
            document_id=document_id,
            failure_reason="Original document file is missing.",
        )
        return _error_response(
            status_code=status.HTTP_410_GONE,
            error_code="ORIGINAL_FILE_MISSING",
            message="Original document file is missing.",
        )

    disposition_type = "attachment" if download else "inline"
    _log_event(
        event_type="DOCUMENT_ORIGINAL_ACCESSED",
        document_id=document_id,
        access_type="download" if download else "preview",
    )

    headers = {
        "Content-Disposition": (
            f'{disposition_type}; filename="{location.document.original_filename}"'
        )
    }
    try:
        return FileResponse(
            path=location.file_path,
            media_type="application/pdf",
            headers=headers,
        )
    except Exception as exc:  # pragma: no cover - defensive
        _log_event(
            event_type="DOCUMENT_ORIGINAL_ACCESS_FAILED",
            document_id=document_id,
            failure_reason=str(exc),
        )
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="ORIGINAL_FILE_ACCESS_FAILED",
            message="Unexpected error while accessing the original document.",
        )


@router.post(
    "/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a document upload",
    description=(
        "Validate an uploaded file and register its metadata. "
        "Release 1 stores the original PDF in filesystem storage."
    ),
    responses={
        400: {"description": "Invalid file type or empty upload."},
        413: {"description": "Uploaded file exceeds the maximum allowed size (10 MB)."},
        500: {"description": "Unexpected storage or database failure."},
    },
)
async def upload_document(
    request: Request,
    file: UploadFile = File(  # noqa: B008
        ...,
        description="Document file to register (validated for type/extension and size).",
    ),
) -> DocumentUploadResponse:
    """Register a document upload (Release 1: store original PDF + persist metadata).

    Args:
        request: Incoming FastAPI request (used to access app state).
        file: Uploaded file sent as multipart/form-data.

    Returns:
        Metadata about the registered document and its initial derived status.
    """

    validation_error = _validate_upload(file)
    if validation_error is not None:
        _log_event(
            event_type="DOCUMENT_UPLOADED",
            document_id=None,
            error_code=validation_error["error_code"],
            failure_reason=validation_error["message"],
        )
        return _error_response(status_code=status.HTTP_400_BAD_REQUEST, **validation_error)

    contents = await file.read()
    if len(contents) == 0:
        _log_event(
            event_type="DOCUMENT_UPLOADED",
            document_id=None,
            error_code="EMPTY_UPLOAD",
            failure_reason="The uploaded file is empty.",
        )
        return _error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="EMPTY_UPLOAD",
            message="The uploaded file is empty.",
        )
    if len(contents) > MAX_UPLOAD_SIZE:
        _log_event(
            event_type="DOCUMENT_UPLOADED",
            document_id=None,
            error_code="FILE_TOO_LARGE",
            failure_reason="Document exceeds the maximum allowed size.",
        )
        return _error_response(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            error_code="FILE_TOO_LARGE",
            message="Document exceeds the maximum allowed size of 10 MB.",
        )

    repository = cast(DocumentRepository, request.app.state.document_repository)
    storage = cast(FileStorage, request.app.state.file_storage)
    try:
        result = register_document_upload(
            filename=Path(file.filename).name,
            content_type=file.content_type or "",
            content=contents,
            repository=repository,
            storage=storage,
        )
    except Exception as exc:  # pragma: no cover - defensive
        _log_event(
            event_type="DOCUMENT_UPLOADED",
            document_id=None,
            error_code="UPLOAD_FAILED",
            failure_reason=str(exc),
        )
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="UPLOAD_FAILED",
            message="Unexpected error while storing the document.",
        )

    _log_event(
        event_type="DOCUMENT_UPLOADED",
        document_id=result.document_id,
    )

    return DocumentUploadResponse(
        document_id=result.document_id,
        status=result.status,
        created_at=result.created_at,
    )


def _validate_upload(file: UploadFile) -> dict[str, str] | None:
    """Validate uploaded file content type and file extension.

    Args:
        file: Uploaded file to validate.

    Returns:
        Error payload if validation fails, otherwise None.
    """

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        return {"error_code": "INVALID_FILE_TYPE", "message": "Unsupported file type."}

    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        return {"error_code": "INVALID_FILE_TYPE", "message": "Unsupported file extension."}

    return None


def _error_response(
    *, status_code: int, error_code: str, message: str, details: dict[str, Any] | None = None
) -> JSONResponse:
    payload: dict[str, Any] = {"error_code": error_code, "message": message}
    if details:
        payload["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


def _log_event(
    *,
    event_type: str,
    document_id: str | None,
    run_id: str | None = None,
    error_code: str | None = None,
    failure_reason: str | None = None,
    access_type: str | None = None,
    count_returned: int | None = None,
) -> None:
    payload: dict[str, Any] = {
        "event_type": event_type,
        "document_id": document_id,
        "run_id": run_id,
        "step_name": None,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    if error_code:
        payload["error_code"] = error_code
    if failure_reason:
        payload["failure_reason"] = failure_reason
    if access_type:
        payload["access_type"] = access_type
    if count_returned is not None:
        payload["count_returned"] = count_returned
    logger.info(json.dumps(payload))

