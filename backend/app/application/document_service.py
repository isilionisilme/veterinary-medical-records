"""Document use-cases for the veterinary medical records system."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from backend.app.application.field_normalizers import normalize_microchip_digits_only
from backend.app.application.global_schema_v0 import (
    CRITICAL_KEYS_V0,
    REPEATABLE_KEYS_V0,
    VALUE_TYPE_BY_KEY_V0,
    normalize_global_schema_v0,
)
from backend.app.domain.models import (
    Document,
    DocumentWithLatestRun,
    ProcessingRunDetail,
    ProcessingRunState,
    ProcessingRunSummary,
    ProcessingStatus,
    ReviewStatus,
    StepArtifact,
)
from backend.app.domain.status import DocumentStatusView, derive_document_status, map_status_label
from backend.app.ports.document_repository import DocumentRepository
from backend.app.ports.file_storage import FileStorage


def _default_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _default_id() -> str:
    return str(uuid4())


@dataclass(frozen=True, slots=True)
class DocumentUploadResult:
    """Result returned after registering an uploaded document."""

    document_id: str
    status: str
    created_at: str


def register_document_upload(
    *,
    filename: str,
    content_type: str,
    content: bytes,
    repository: DocumentRepository,
    storage: FileStorage,
    id_provider: Callable[[], str] = _default_id,
    now_provider: Callable[[], str] = _default_now_iso,
) -> DocumentUploadResult:
    """Register an uploaded document and set its initial lifecycle state.

    Args:
        filename: Sanitized basename of the uploaded file.
        content_type: MIME type provided at upload time.
        repository: Persistence port used to store document metadata.
        id_provider: Provider for generating new document ids.
        now_provider: Provider for generating the creation timestamp (UTC ISO).

    Returns:
        A result object suitable for mapping to an HTTP response.
    """

    document_id = id_provider()
    created_at = now_provider()
    stored_file = storage.save(document_id=document_id, content=content)

    document = Document(
        document_id=document_id,
        original_filename=filename,
        content_type=content_type,
        file_size=stored_file.file_size,
        storage_path=stored_file.storage_path,
        created_at=created_at,
        updated_at=created_at,
        review_status=ReviewStatus.IN_REVIEW,
    )

    try:
        repository.create(document, ProcessingStatus.UPLOADED)
    except Exception:
        storage.delete(storage_path=stored_file.storage_path)
        raise

    return DocumentUploadResult(
        document_id=document_id,
        status=ProcessingStatus.UPLOADED.value,
        created_at=created_at,
    )


def get_document(*, document_id: str, repository: DocumentRepository) -> Document | None:
    """Retrieve document metadata for status visibility.

    Args:
        document_id: Unique identifier for the document.
        repository: Persistence port used to fetch the document.

    Returns:
        The document metadata, or None when not found.
    """

    return repository.get(document_id)


@dataclass(frozen=True, slots=True)
class DocumentStatusDetails:
    """Document status details derived from the latest processing run."""

    document: Document
    latest_run: ProcessingRunSummary | None
    status_view: DocumentStatusView


@dataclass(frozen=True, slots=True)
class DocumentOriginalLocation:
    """Resolved location and metadata for an original stored document file."""

    document: Document
    file_path: Path
    exists: bool


def get_document_status_details(
    *, document_id: str, repository: DocumentRepository
) -> DocumentStatusDetails | None:
    """Return document metadata with derived status details.

    Args:
        document_id: Unique identifier for the document.
        repository: Persistence port used to fetch document and run summaries.

    Returns:
        Document status details or None when the document does not exist.
    """

    document = repository.get(document_id)
    if document is None:
        return None

    latest_run = repository.get_latest_run(document_id)
    status_view = derive_document_status(latest_run)
    return DocumentStatusDetails(document=document, latest_run=latest_run, status_view=status_view)


def get_document_original_location(
    *, document_id: str, repository: DocumentRepository, storage: FileStorage
) -> DocumentOriginalLocation | None:
    """Resolve the stored location for an original uploaded document.

    Args:
        document_id: Unique identifier for the document.
        repository: Persistence port used to fetch document metadata.
        storage: File storage adapter used to resolve file locations.

    Returns:
        The resolved file location and metadata, or None when the document is missing.
    """

    document = repository.get(document_id)
    if document is None:
        return None

    return DocumentOriginalLocation(
        document=document,
        file_path=storage.resolve(storage_path=document.storage_path),
        exists=storage.exists(storage_path=document.storage_path),
    )


@dataclass(frozen=True, slots=True)
class ProcessingStepHistory:
    """Single step row for document processing history."""

    step_name: str
    step_status: str
    attempt: int
    started_at: str | None
    ended_at: str | None
    error_code: str | None


@dataclass(frozen=True, slots=True)
class ProcessingRunHistory:
    """Run row for document processing history."""

    run_id: str
    state: str
    failure_type: str | None
    started_at: str | None
    completed_at: str | None
    steps: list[ProcessingStepHistory]


@dataclass(frozen=True, slots=True)
class ProcessingHistory:
    """Document processing history response model for API adapters."""

    document_id: str
    runs: list[ProcessingRunHistory]


@dataclass(frozen=True, slots=True)
class LatestCompletedRunReview:
    """Latest completed run summary for review context."""

    run_id: str
    state: str
    completed_at: str | None
    failure_type: str | None


@dataclass(frozen=True, slots=True)
class ActiveInterpretationReview:
    """Active structured interpretation payload for review."""

    interpretation_id: str
    version_number: int
    data: dict[str, object]


@dataclass(frozen=True, slots=True)
class RawTextArtifactAvailability:
    """Raw text artifact availability for review context."""

    run_id: str
    available: bool


@dataclass(frozen=True, slots=True)
class DocumentReview:
    """Review payload for latest completed run context."""

    document_id: str
    latest_completed_run: LatestCompletedRunReview
    active_interpretation: ActiveInterpretationReview
    raw_text_artifact: RawTextArtifactAvailability
    review_status: str
    reviewed_at: str | None
    reviewed_by: str | None


@dataclass(frozen=True, slots=True)
class DocumentReviewLookupResult:
    """Outcome for resolving review context for a document."""

    review: DocumentReview | None
    unavailable_reason: str | None


@dataclass(frozen=True, slots=True)
class InterpretationEditResult:
    """Successful interpretation edit result."""

    run_id: str
    interpretation_id: str
    version_number: int
    data: dict[str, object]


@dataclass(frozen=True, slots=True)
class InterpretationEditOutcome:
    """Outcome for interpretation edit attempts."""

    result: InterpretationEditResult | None
    conflict_reason: str | None = None
    invalid_reason: str | None = None


def get_processing_history(
    *, document_id: str, repository: DocumentRepository
) -> ProcessingHistory | None:
    """Return chronological processing history for a document.

    Args:
        document_id: Unique identifier for the document.
        repository: Persistence port used to fetch runs and artifacts.

    Returns:
        Processing history when the document exists; otherwise None.
    """

    if repository.get(document_id) is None:
        return None

    run_rows = repository.list_processing_runs(document_id=document_id)
    runs = [_to_processing_run_history(run, repository) for run in run_rows]
    return ProcessingHistory(document_id=document_id, runs=runs)


def get_document_review(
    *,
    document_id: str,
    repository: DocumentRepository,
    storage: FileStorage,
) -> DocumentReviewLookupResult | None:
    """Return review context for the latest completed run.

    Returns:
        - None when the document does not exist.
        - DocumentReview when a completed run with interpretation is available.
    """

    document = repository.get(document_id)
    if document is None:
        return None

    latest_completed_run = repository.get_latest_completed_run(document_id)
    if latest_completed_run is None:
        return DocumentReviewLookupResult(
            review=None,
            unavailable_reason="NO_COMPLETED_RUN",
        )

    interpretation_payload = repository.get_latest_artifact_payload(
        run_id=latest_completed_run.run_id,
        artifact_type="STRUCTURED_INTERPRETATION",
    )
    if interpretation_payload is None:
        return DocumentReviewLookupResult(
            review=None,
            unavailable_reason="INTERPRETATION_MISSING",
        )

    interpretation_id = str(interpretation_payload.get("interpretation_id", ""))
    version_number_raw = interpretation_payload.get("version_number", 1)
    version_number = version_number_raw if isinstance(version_number_raw, int) else 1

    structured_data = interpretation_payload.get("data")
    if not isinstance(structured_data, dict):
        structured_data = {}
    structured_data = _normalize_review_interpretation_data(structured_data)

    return DocumentReviewLookupResult(
        review=DocumentReview(
            document_id=document_id,
            latest_completed_run=LatestCompletedRunReview(
                run_id=latest_completed_run.run_id,
                state=latest_completed_run.state.value,
                completed_at=latest_completed_run.completed_at,
                failure_type=latest_completed_run.failure_type,
            ),
            active_interpretation=ActiveInterpretationReview(
                interpretation_id=interpretation_id,
                version_number=version_number,
                data=structured_data,
            ),
            raw_text_artifact=RawTextArtifactAvailability(
                run_id=latest_completed_run.run_id,
                available=storage.exists_raw_text(
                    document_id=latest_completed_run.document_id,
                    run_id=latest_completed_run.run_id,
                ),
            ),
            review_status=document.review_status.value,
            reviewed_at=document.reviewed_at,
            reviewed_by=document.reviewed_by,
        ),
        unavailable_reason=None,
    )


def _normalize_review_interpretation_data(data: dict[str, object]) -> dict[str, object]:
    global_schema = data.get("global_schema_v0")
    if not isinstance(global_schema, dict):
        return data

    raw_microchip = global_schema.get("microchip_id")
    normalized_microchip = normalize_microchip_digits_only(raw_microchip)
    if normalized_microchip == raw_microchip:
        return data

    normalized_data = dict(data)
    normalized_global_schema = dict(global_schema)
    normalized_global_schema["microchip_id"] = normalized_microchip
    normalized_data["global_schema_v0"] = normalized_global_schema
    return normalized_data


def apply_interpretation_edits(
    *,
    run_id: str,
    base_version_number: int,
    changes: list[dict[str, object]],
    repository: DocumentRepository,
    now_provider: Callable[[], str] = _default_now_iso,
) -> InterpretationEditOutcome | None:
    """Apply veterinarian edits and append a new active interpretation version."""

    run = repository.get_run(run_id)
    if run is None:
        return None

    if any(
        row.state == ProcessingRunState.RUNNING
        for row in repository.list_processing_runs(document_id=run.document_id)
    ):
        return InterpretationEditOutcome(
            result=None,
            conflict_reason="REVIEW_BLOCKED_BY_ACTIVE_RUN",
        )

    if run.state != ProcessingRunState.COMPLETED:
        return InterpretationEditOutcome(
            result=None,
            conflict_reason="INTERPRETATION_NOT_AVAILABLE",
        )

    active_payload = repository.get_latest_artifact_payload(
        run_id=run_id,
        artifact_type="STRUCTURED_INTERPRETATION",
    )
    if active_payload is None:
        return InterpretationEditOutcome(result=None, conflict_reason="INTERPRETATION_MISSING")

    active_version_raw = active_payload.get("version_number", 1)
    active_version_number = active_version_raw if isinstance(active_version_raw, int) else 1
    if base_version_number != active_version_number:
        return InterpretationEditOutcome(
            result=None,
            conflict_reason="BASE_VERSION_MISMATCH",
        )

    active_data_raw = active_payload.get("data")
    active_data = dict(active_data_raw) if isinstance(active_data_raw, dict) else {}
    active_fields = _coerce_interpretation_fields(active_data.get("fields"))

    updated_fields = [dict(field) for field in active_fields]
    field_change_logs: list[dict[str, object]] = []
    now_iso = now_provider()

    for index, change in enumerate(changes):
        op_raw = change.get("op")
        op = str(op_raw).upper() if isinstance(op_raw, str) else ""
        if op not in {"ADD", "UPDATE", "DELETE"}:
            return InterpretationEditOutcome(result=None, invalid_reason=f"changes[{index}].op")

        if op == "ADD":
            key = str(change.get("key", "")).strip()
            if not key:
                return InterpretationEditOutcome(
                    result=None,
                    invalid_reason=f"changes[{index}].key",
                )
            value_type = str(change.get("value_type", "")).strip() or VALUE_TYPE_BY_KEY_V0.get(
                key, "string"
            )
            if "value" not in change:
                return InterpretationEditOutcome(
                    result=None,
                    invalid_reason=f"changes[{index}].value",
                )

            new_field_id = str(uuid4())
            new_field = {
                "field_id": new_field_id,
                "key": key,
                "value": change.get("value"),
                "value_type": value_type,
                "confidence": 1.0,
                "is_critical": key in CRITICAL_KEYS_V0,
                "origin": "human",
            }
            updated_fields.append(new_field)
            field_change_logs.append(
                _build_field_change_log(
                    interpretation_id="",  # Filled after new interpretation id is generated.
                    field_id=new_field_id,
                    old_value=None,
                    new_value=change.get("value"),
                    change_type="ADD",
                    created_at=now_iso,
                )
            )
            continue

        field_id = str(change.get("field_id", "")).strip()
        if not field_id:
            return InterpretationEditOutcome(
                result=None,
                invalid_reason=f"changes[{index}].field_id",
            )

        existing_index = next(
            (
                row_index
                for row_index, row in enumerate(updated_fields)
                if row.get("field_id") == field_id
            ),
            None,
        )
        if existing_index is None:
            return InterpretationEditOutcome(
                result=None, invalid_reason=f"changes[{index}].field_id_not_found"
            )

        old_value = updated_fields[existing_index].get("value")
        if op == "DELETE":
            updated_fields.pop(existing_index)
            field_change_logs.append(
                _build_field_change_log(
                    interpretation_id="",
                    field_id=field_id,
                    old_value=old_value,
                    new_value=None,
                    change_type="DELETE",
                    created_at=now_iso,
                )
            )
            continue

        if "value" not in change:
            return InterpretationEditOutcome(
                result=None,
                invalid_reason=f"changes[{index}].value",
            )
        value_type = str(change.get("value_type", "")).strip()
        if not value_type:
            return InterpretationEditOutcome(
                result=None,
                invalid_reason=f"changes[{index}].value_type",
            )

        updated_fields[existing_index] = {
            **updated_fields[existing_index],
            "value": change.get("value"),
            "value_type": value_type,
            "origin": "human",
            "confidence": 1.0,
        }
        field_change_logs.append(
            _build_field_change_log(
                interpretation_id="",
                field_id=field_id,
                old_value=old_value,
                new_value=change.get("value"),
                change_type="UPDATE",
                created_at=now_iso,
            )
        )

    new_interpretation_id = str(uuid4())
    for log in field_change_logs:
        log["interpretation_id"] = new_interpretation_id

    new_data: dict[str, object] = dict(active_data)
    new_data["created_at"] = now_iso
    new_data["processing_run_id"] = run_id
    new_data["fields"] = updated_fields
    new_data["global_schema_v0"] = _build_global_schema_from_fields(updated_fields)

    new_payload = {
        "interpretation_id": new_interpretation_id,
        "version_number": active_version_number + 1,
        "data": new_data,
    }
    repository.append_artifact(
        run_id=run_id,
        artifact_type="STRUCTURED_INTERPRETATION",
        payload=new_payload,
        created_at=now_iso,
    )
    for change_log in field_change_logs:
        repository.append_artifact(
            run_id=run_id,
            artifact_type="FIELD_CHANGE_LOG",
            payload=change_log,
            created_at=now_iso,
        )

    return InterpretationEditOutcome(
        result=InterpretationEditResult(
            run_id=run_id,
            interpretation_id=new_interpretation_id,
            version_number=active_version_number + 1,
            data=_normalize_review_interpretation_data(new_data),
        )
    )


def _coerce_interpretation_fields(raw_fields: object) -> list[dict[str, object]]:
    if not isinstance(raw_fields, list):
        return []
    fields: list[dict[str, object]] = []
    for item in raw_fields:
        if isinstance(item, dict):
            fields.append(dict(item))
    return fields


def _build_field_change_log(
    *,
    interpretation_id: str,
    field_id: str,
    old_value: object,
    new_value: object,
    change_type: str,
    created_at: str,
) -> dict[str, object]:
    return {
        "change_id": str(uuid4()),
        "interpretation_id": interpretation_id,
        "field_path": f"fields.{field_id}.value",
        "old_value": old_value,
        "new_value": new_value,
        "change_type": change_type,
        "created_at": created_at,
    }


def _build_global_schema_from_fields(fields: list[dict[str, object]]) -> dict[str, object]:
    schema_accumulator: dict[str, object] = {}
    for field in fields:
        key = str(field.get("key", "")).strip()
        if not key:
            continue
        value = field.get("value")
        if key in REPEATABLE_KEYS_V0:
            if is_field_value_empty(value):
                continue
            bucket = schema_accumulator.get(key)
            if not isinstance(bucket, list):
                bucket = []
                schema_accumulator[key] = bucket
            bucket.append(value)
            continue

        if key not in schema_accumulator and not is_field_value_empty(value):
            schema_accumulator[key] = value

    return normalize_global_schema_v0(schema_accumulator)


def is_field_value_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, list):
        return len(value) == 0
    return False


def _to_processing_run_history(
    run: ProcessingRunDetail, repository: DocumentRepository
) -> ProcessingRunHistory:
    return ProcessingRunHistory(
        run_id=run.run_id,
        state=run.state.value,
        failure_type=run.failure_type,
        started_at=run.started_at,
        completed_at=run.completed_at,
        steps=[
            _to_processing_step_history(step)
            for step in repository.list_step_artifacts(run_id=run.run_id)
        ],
    )


def _to_processing_step_history(step: StepArtifact) -> ProcessingStepHistory:
    return ProcessingStepHistory(
        step_name=step.step_name.value,
        step_status=step.step_status.value,
        attempt=step.attempt,
        started_at=step.started_at,
        ended_at=step.ended_at,
        error_code=step.error_code,
    )


@dataclass(frozen=True, slots=True)
class DocumentListItem:
    """Document list entry with derived status metadata."""

    document_id: str
    original_filename: str
    created_at: str
    status: str
    status_label: str
    failure_type: str | None
    review_status: str
    reviewed_at: str | None
    reviewed_by: str | None


@dataclass(frozen=True, slots=True)
class DocumentListResult:
    """Paginated document list result."""

    items: list[DocumentListItem]
    limit: int
    offset: int
    total: int


def list_documents(
    *,
    repository: DocumentRepository,
    limit: int,
    offset: int,
) -> DocumentListResult:
    """List documents with derived status for list views.

    Args:
        repository: Persistence port used to fetch documents and run summaries.
        limit: Maximum number of documents to return.
        offset: Pagination offset.

    Returns:
        Paginated list of document entries with derived status.
    """

    rows = repository.list_documents(limit=limit, offset=offset)
    total = repository.count_documents()
    items = [_to_list_item(row=row) for row in rows]
    return DocumentListResult(items=items, limit=limit, offset=offset, total=total)


def _to_list_item(*, row: DocumentWithLatestRun) -> DocumentListItem:
    status_view = derive_document_status(row.latest_run)
    return DocumentListItem(
        document_id=row.document.document_id,
        original_filename=row.document.original_filename,
        created_at=row.document.created_at,
        status=status_view.status.value,
        status_label=map_status_label(status_view.status),
        failure_type=status_view.failure_type,
        review_status=row.document.review_status.value,
        reviewed_at=row.document.reviewed_at,
        reviewed_by=row.document.reviewed_by,
    )


@dataclass(frozen=True, slots=True)
class ReviewToggleResult:
    """Document review toggle result."""

    document_id: str
    review_status: str
    reviewed_at: str | None
    reviewed_by: str | None


def mark_document_reviewed(
    *,
    document_id: str,
    repository: DocumentRepository,
    now_provider: Callable[[], str] = _default_now_iso,
    reviewed_by: str | None = None,
) -> ReviewToggleResult | None:
    """Mark a document as reviewed (idempotent)."""

    document = repository.get(document_id)
    if document is None:
        return None

    if document.review_status == ReviewStatus.REVIEWED:
        return ReviewToggleResult(
            document_id=document.document_id,
            review_status=document.review_status.value,
            reviewed_at=document.reviewed_at,
            reviewed_by=document.reviewed_by,
        )

    reviewed_at = now_provider()
    updated = repository.update_review_status(
        document_id=document_id,
        review_status=ReviewStatus.REVIEWED.value,
        updated_at=reviewed_at,
        reviewed_at=reviewed_at,
        reviewed_by=reviewed_by,
    )
    if updated is None:
        return None

    return ReviewToggleResult(
        document_id=updated.document_id,
        review_status=updated.review_status.value,
        reviewed_at=updated.reviewed_at,
        reviewed_by=updated.reviewed_by,
    )


def reopen_document_review(
    *,
    document_id: str,
    repository: DocumentRepository,
    now_provider: Callable[[], str] = _default_now_iso,
) -> ReviewToggleResult | None:
    """Reopen a reviewed document (idempotent)."""

    document = repository.get(document_id)
    if document is None:
        return None

    if document.review_status == ReviewStatus.IN_REVIEW:
        return ReviewToggleResult(
            document_id=document.document_id,
            review_status=document.review_status.value,
            reviewed_at=document.reviewed_at,
            reviewed_by=document.reviewed_by,
        )

    updated = repository.update_review_status(
        document_id=document_id,
        review_status=ReviewStatus.IN_REVIEW.value,
        updated_at=now_provider(),
        reviewed_at=None,
        reviewed_by=None,
    )
    if updated is None:
        return None

    return ReviewToggleResult(
        document_id=updated.document_id,
        review_status=updated.review_status.value,
        reviewed_at=updated.reviewed_at,
        reviewed_by=updated.reviewed_by,
    )
