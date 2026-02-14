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
    ActiveInterpretationReviewResponse,
    DocumentListItemResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentReviewResponse,
    DocumentUploadResponse,
    ExtractionRunPersistResponse,
    ExtractionRunsAggregateSummaryResponse,
    ExtractionRunsListResponse,
    ExtractionRunSnapshotRequest,
    ExtractionRunTriageResponse,
    LatestCompletedRunReviewResponse,
    LatestRunResponse,
    ProcessingHistoryResponse,
    ProcessingHistoryRunResponse,
    ProcessingRunResponse,
    ProcessingStepResponse,
    RawTextArtifactAvailabilityResponse,
    RawTextArtifactResponse,
)
from backend.app.application.document_service import (
    get_document,
    get_document_original_location,
    get_document_review,
    get_document_status_details,
    get_processing_history,
    list_documents,
    register_document_upload,
)
from backend.app.application.extraction_observability import (
    get_extraction_runs,
    get_latest_extraction_run_triage,
    persist_extraction_run_snapshot,
    summarize_extraction_runs,
)
from backend.app.application.processing_runner import enqueue_processing_run
from backend.app.config import extraction_observability_enabled, processing_enabled
from backend.app.domain.models import ProcessingRunState, ProcessingStatus
from backend.app.ports.document_repository import DocumentRepository
from backend.app.ports.file_storage import FileStorage

router = APIRouter()
logger = logging.getLogger(__name__)

# Normative default: 20 MB (see docs/project/TECHNICAL_DESIGN.md Appendix B3.2).
MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20 MB
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
        result = list_documents(
            repository=repository,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:  # pragma: no cover - defensive
        _log_event(
            event_type="DOCUMENT_LIST_VIEW_FAILED",
            document_id=None,
            failure_reason=str(exc),
        )
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="INTERNAL_ERROR",
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
    responses={404: {"description": "Document not found (NOT_FOUND)."}},
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
    details = get_document_status_details(
        document_id=document_id,
        repository=repository,
    )
    if details is None:
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
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
    "/documents/{document_id}/processing-history",
    response_model=ProcessingHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get processing history for a document",
    description="Return chronological processing runs with step status artifacts.",
    responses={404: {"description": "Document not found (NOT_FOUND)."}},
)
def get_document_processing_history(
    request: Request, document_id: str
) -> ProcessingHistoryResponse | JSONResponse:
    """Return read-only processing history for a document."""

    repository = cast(DocumentRepository, request.app.state.document_repository)
    result = get_processing_history(document_id=document_id, repository=repository)
    if result is None:
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            message="Document not found.",
        )

    _log_event(
        event_type="DOCUMENT_PROCESSING_HISTORY_VIEWED",
        document_id=document_id,
    )
    return ProcessingHistoryResponse(
        document_id=result.document_id,
        runs=[
            ProcessingHistoryRunResponse(
                run_id=run.run_id,
                state=run.state,
                failure_type=run.failure_type,
                started_at=run.started_at,
                completed_at=run.completed_at,
                steps=[
                    ProcessingStepResponse(
                        step_name=step.step_name,
                        step_status=step.step_status,
                        attempt=step.attempt,
                        started_at=step.started_at,
                        ended_at=step.ended_at,
                        error_code=step.error_code,
                    )
                    for step in run.steps
                ],
            )
            for run in result.runs
        ],
    )


@router.get(
    "/documents/{document_id}/review",
    response_model=DocumentReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get review context for a document",
    description="Return latest completed run and its active interpretation.",
    responses={
        404: {"description": "Document not found (NOT_FOUND)."},
        409: {"description": "No completed run available for review (CONFLICT)."},
    },
)
def get_document_review_context(
    request: Request, document_id: str
) -> DocumentReviewResponse | JSONResponse:
    """Return review context based on the latest completed run."""

    repository = cast(DocumentRepository, request.app.state.document_repository)
    storage = cast(FileStorage, request.app.state.file_storage)
    if get_document(document_id=document_id, repository=repository) is None:
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            message="Document not found.",
        )

    review = get_document_review(
        document_id=document_id,
        repository=repository,
        storage=storage,
    )
    if review is None:
        # Defensive fallback; get_document_review currently returns a typed unavailability reason.
        return _error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
            message="Review context is not available.",
            details={"reason": "NO_COMPLETED_RUN"},
        )
    if review.review is None:
        reason = review.unavailable_reason or "NO_COMPLETED_RUN"
        message = (
            "Review is not available until a completed run exists."
            if reason == "NO_COMPLETED_RUN"
            else "Review interpretation is not available for the latest completed run."
        )
        return _error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
            message=message,
            details={"reason": reason},
        )

    _log_event(
        event_type="DOCUMENT_REVIEW_VIEWED",
        document_id=document_id,
        run_id=review.review.latest_completed_run.run_id,
    )

    return DocumentReviewResponse(
        document_id=review.review.document_id,
        latest_completed_run=LatestCompletedRunReviewResponse(
            run_id=review.review.latest_completed_run.run_id,
            state=review.review.latest_completed_run.state,
            completed_at=review.review.latest_completed_run.completed_at,
            failure_type=review.review.latest_completed_run.failure_type,
        ),
        active_interpretation=ActiveInterpretationReviewResponse(
            interpretation_id=review.review.active_interpretation.interpretation_id,
            version_number=review.review.active_interpretation.version_number,
            data=review.review.active_interpretation.data,
        ),
        raw_text_artifact=RawTextArtifactAvailabilityResponse(
            run_id=review.review.raw_text_artifact.run_id,
            available=review.review.raw_text_artifact.available,
        ),
    )


@router.get(
    "/documents/{document_id}/download",
    status_code=status.HTTP_200_OK,
    response_class=FileResponse,
    response_model=None,
    summary="Download or preview an original document",
    description="Return the original uploaded PDF for preview or download.",
    responses={
        404: {"description": "Document not found (NOT_FOUND)."},
        410: {"description": "Original file missing (ARTIFACT_MISSING)."},
        500: {"description": "Unexpected filesystem or I/O failure (INTERNAL_ERROR)."},
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
            error_code="NOT_FOUND",
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
            error_code="ARTIFACT_MISSING",
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
            error_code="INTERNAL_ERROR",
            message="Unexpected error while accessing the original document.",
        )


@router.post(
    "/documents/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a document upload",
    description=(
        "Validate an uploaded file and register its metadata. "
        "Release 1 stores the original PDF in filesystem storage."
    ),
    responses={
        400: {"description": "Invalid request (INVALID_REQUEST)."},
        413: {"description": "Uploaded file exceeds the maximum allowed size (FILE_TOO_LARGE)."},
        415: {"description": "Unsupported upload type (UNSUPPORTED_MEDIA_TYPE)."},
        500: {"description": "Unexpected storage or database failure (INTERNAL_ERROR)."},
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
        return _error_response(**validation_error)

    contents = await file.read()
    if len(contents) == 0:
        _log_event(
            event_type="DOCUMENT_UPLOADED",
            document_id=None,
            error_code="INVALID_REQUEST",
            failure_reason="The uploaded file is empty.",
        )
        return _error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_REQUEST",
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
            message="Document exceeds the maximum allowed size of 20 MB.",
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
        if processing_enabled():
            enqueue_processing_run(
                document_id=result.document_id,
                repository=repository,
            )
    except Exception as exc:  # pragma: no cover - defensive
        _log_event(
            event_type="DOCUMENT_UPLOADED",
            document_id=None,
            error_code="INTERNAL_ERROR",
            failure_reason=str(exc),
        )
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="INTERNAL_ERROR",
            message="Unexpected error while storing the document.",
        )

    _log_event(
        event_type="DOCUMENT_UPLOADED",
        document_id=result.document_id,
    )
    status_value = (
        ProcessingStatus.PROCESSING.value
        if processing_enabled()
        else ProcessingStatus.UPLOADED.value
    )
    return DocumentUploadResponse(
        document_id=result.document_id,
        status=status_value,
        created_at=result.created_at,
    )


@router.post(
    "/documents/{document_id}/reprocess",
    response_model=ProcessingRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new processing run",
    description="Create a new processing run for the document (append-only).",
    responses={404: {"description": "Document not found (NOT_FOUND)."}},
)
def reprocess_document(
    request: Request,
    document_id: str,
) -> ProcessingRunResponse | JSONResponse:
    """Create a new queued processing run for an existing document."""

    repository = cast(DocumentRepository, request.app.state.document_repository)
    if get_document(document_id=document_id, repository=repository) is None:
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            message="Document not found.",
        )

    if not processing_enabled():
        return _error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
            message="Processing is disabled.",
        )

    run = enqueue_processing_run(document_id=document_id, repository=repository)
    _log_event(
        event_type="REPROCESS_REQUESTED",
        document_id=document_id,
        run_id=run.run_id,
    )
    return ProcessingRunResponse(
        run_id=run.run_id,
        state=run.state.value,
        created_at=run.created_at,
    )


@router.get(
    "/runs/{run_id}/artifacts/raw-text",
    response_model=RawTextArtifactResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve raw extracted text",
    description="Return raw extracted text for a processing run.",
    responses={
        404: {"description": "Run not found (NOT_FOUND)."},
        409: {"description": "Raw text not ready or not available (CONFLICT)."},
        410: {"description": "Raw text artifact missing (ARTIFACT_MISSING)."},
    },
)
def get_raw_text_artifact(
    request: Request,
    run_id: str,
) -> RawTextArtifactResponse | JSONResponse:
    """Return extracted raw text for a processing run."""

    repository = cast(DocumentRepository, request.app.state.document_repository)
    storage = cast(FileStorage, request.app.state.file_storage)
    run = repository.get_run(run_id)
    if run is None:
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            message="Processing run not found.",
        )

    if run.state in {ProcessingRunState.QUEUED, ProcessingRunState.RUNNING}:
        return _error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
            message="Raw text is not ready yet.",
            details={"reason": "RAW_TEXT_NOT_READY"},
        )

    if run.state in {ProcessingRunState.FAILED, ProcessingRunState.TIMED_OUT}:
        return _error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
            message="Raw text is not available for this run.",
            details={"reason": "RAW_TEXT_NOT_AVAILABLE"},
        )

    if not storage.exists_raw_text(document_id=run.document_id, run_id=run.run_id):
        return _error_response(
            status_code=status.HTTP_410_GONE,
            error_code="ARTIFACT_MISSING",
            message="Raw text artifact is missing.",
        )

    try:
        text = storage.resolve_raw_text(document_id=run.document_id, run_id=run.run_id).read_text(
            encoding="utf-8"
        )
    except Exception as exc:  # pragma: no cover - defensive
        _log_event(
            event_type="RAW_TEXT_ACCESS_FAILED",
            document_id=run.document_id,
            run_id=run.run_id,
            failure_reason=str(exc),
        )
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="INTERNAL_ERROR",
            message="Unexpected error while accessing raw text.",
        )

    _log_event(
        event_type="RAW_TEXT_ACCESSED",
        document_id=run.document_id,
        run_id=run.run_id,
    )

    return RawTextArtifactResponse(
        run_id=run.run_id,
        artifact_type="RAW_TEXT",
        content_type="text/plain",
        text=text,
    )


@router.post(
    "/debug/extraction-runs",
    response_model=ExtractionRunPersistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Persist extraction observability snapshot",
    description="Persist extraction run snapshot locally and log diff versus previous run.",
)
def persist_debug_extraction_run(
    payload: ExtractionRunSnapshotRequest,
) -> ExtractionRunPersistResponse | JSONResponse:
    if not extraction_observability_enabled():
        return _extraction_observability_disabled_response()

    try:
        result = persist_extraction_run_snapshot(payload.model_dump())
    except ValueError as exc:
        return _error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_REQUEST",
            message=str(exc),
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Failed to persist extraction observability snapshot")
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="INTERNAL_ERROR",
            message="Unexpected error while persisting extraction snapshot.",
            details={"reason": str(exc)},
        )

    response_payload = ExtractionRunPersistResponse(
        document_id=str(result["document_id"]),
        run_id=str(result["run_id"]),
        stored_runs=int(result["stored_runs"]),
        changed_fields=int(result["changed_fields"]),
    )
    response_status = (
        status.HTTP_201_CREATED if bool(result.get("was_created", True)) else status.HTTP_200_OK
    )
    return JSONResponse(
        status_code=response_status,
        content=response_payload.model_dump(),
    )


@router.get(
    "/debug/extraction-runs/{document_id}",
    response_model=ExtractionRunsListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get persisted extraction observability snapshots",
    description="Return persisted extraction snapshots for a document (latest first).",
)
def list_debug_extraction_runs(document_id: str) -> ExtractionRunsListResponse | JSONResponse:
    if not extraction_observability_enabled():
        return _extraction_observability_disabled_response()

    runs = get_extraction_runs(document_id)
    return ExtractionRunsListResponse(document_id=document_id, runs=runs)


@router.get(
    "/debug/extraction-runs/{document_id}/triage",
    response_model=ExtractionRunTriageResponse,
    status_code=status.HTTP_200_OK,
    summary="Get extraction triage for latest persisted run",
    description="Return triage report for the latest persisted extraction snapshot.",
)
def get_debug_extraction_run_triage(document_id: str) -> ExtractionRunTriageResponse | JSONResponse:
    if not extraction_observability_enabled():
        return _extraction_observability_disabled_response()

    triage = get_latest_extraction_run_triage(document_id)
    if triage is None:
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            message="No extraction snapshots found for this document.",
        )

    return ExtractionRunTriageResponse(**triage)


@router.get(
    "/debug/extraction-runs/{document_id}/summary",
    response_model=ExtractionRunsAggregateSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated extraction evidence for recent runs",
    description=(
        "Aggregate missing/rejected/accepted counts over latest persisted runs and expose "
        "representative top1 samples for triage."
    ),
)
def get_debug_extraction_run_summary(
    document_id: str,
    limit: int = Query(20, ge=1, le=20, description="How many latest runs to aggregate."),
    run_id: str | None = Query(
        None,
        description="Optional run id to summarize a specific persisted extraction snapshot.",
    ),
) -> ExtractionRunsAggregateSummaryResponse | JSONResponse:
    if not extraction_observability_enabled():
        return _extraction_observability_disabled_response()

    summary = summarize_extraction_runs(document_id=document_id, limit=limit, run_id=run_id)
    if summary is None:
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            message="No extraction snapshots found for this document.",
        )

    return ExtractionRunsAggregateSummaryResponse(**summary)


def _validate_upload(file: UploadFile) -> dict[str, Any] | None:
    """Validate uploaded file content type and file extension.

    Args:
        file: Uploaded file to validate.

    Returns:
        Error payload if validation fails, otherwise None.
    """

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        return {
            "status_code": status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "error_code": "UNSUPPORTED_MEDIA_TYPE",
            "message": "Unsupported file type.",
        }

    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        return {
            "status_code": status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "error_code": "UNSUPPORTED_MEDIA_TYPE",
            "message": "Unsupported file extension.",
        }

    return None


def _error_response(
    *, status_code: int, error_code: str, message: str, details: dict[str, Any] | None = None
) -> JSONResponse:
    payload: dict[str, Any] = {"error_code": error_code, "message": message}
    if details:
        payload["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


def _extraction_observability_disabled_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={
            "error": "extraction_observability_disabled",
            "hint": "Set VET_RECORDS_EXTRACTION_OBS=1 and restart backend",
        },
    )


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

