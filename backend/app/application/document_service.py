"""Document use-cases for the veterinary medical records system."""

from __future__ import annotations

import logging
import math
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from backend.app.application.confidence_calibration import (
    CALIBRATION_SIGNAL_ACCEPTED_UNCHANGED,
    CALIBRATION_SIGNAL_EDITED,
    build_context_key_from_interpretation_data,
    is_empty_value,
    normalize_mapping_id,
    resolve_calibration_policy_version,
)
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

NUMERIC_TYPES = (int, float)
logger = logging.getLogger(__name__)

_MEDICAL_RECORD_V1_SECTIONS: tuple[str, ...] = (
    "clinic",
    "patient",
    "owner",
    "visits",
    "notes",
    "other",
    "report_info",
)

_MEDICAL_RECORD_V1_FIELD_SLOTS: tuple[dict[str, object], ...] = (
    {
        "concept_id": "clinic.name",
        "section": "clinic",
        "scope": "document",
        "canonical_key": "clinic_name",
        "label_key": "clinic_name",
    },
    {
        "concept_id": "clinic.address",
        "section": "clinic",
        "scope": "document",
        "canonical_key": "clinic_address",
        "label_key": "clinic_address",
    },
    {
        "concept_id": "clinic.vet_name",
        "section": "clinic",
        "scope": "document",
        "canonical_key": "vet_name",
        "label_key": "vet_name",
    },
    {
        "concept_id": "clinic.nhc",
        "section": "clinic",
        "scope": "document",
        "canonical_key": "nhc",
        "aliases": ["medical_record_number"],
        "label_key": "nhc",
    },
    {
        "concept_id": "patient.pet_name",
        "section": "patient",
        "scope": "document",
        "canonical_key": "pet_name",
        "label_key": "pet_name",
    },
    {
        "concept_id": "patient.species",
        "section": "patient",
        "scope": "document",
        "canonical_key": "species",
        "label_key": "species",
    },
    {
        "concept_id": "patient.breed",
        "section": "patient",
        "scope": "document",
        "canonical_key": "breed",
        "label_key": "breed",
    },
    {
        "concept_id": "patient.sex",
        "section": "patient",
        "scope": "document",
        "canonical_key": "sex",
        "label_key": "sex",
    },
    {
        "concept_id": "patient.age",
        "section": "patient",
        "scope": "document",
        "canonical_key": "age",
        "label_key": "age",
    },
    {
        "concept_id": "patient.dob",
        "section": "patient",
        "scope": "document",
        "canonical_key": "dob",
        "label_key": "dob",
    },
    {
        "concept_id": "patient.microchip_id",
        "section": "patient",
        "scope": "document",
        "canonical_key": "microchip_id",
        "label_key": "microchip_id",
    },
    {
        "concept_id": "patient.weight",
        "section": "patient",
        "scope": "document",
        "canonical_key": "weight",
        "label_key": "weight",
    },
    {
        "concept_id": "patient.reproductive_status",
        "section": "patient",
        "scope": "document",
        "canonical_key": "reproductive_status",
        "aliases": ["repro_status"],
        "label_key": "reproductive_status",
    },
    {
        "concept_id": "owner.name",
        "section": "owner",
        "scope": "document",
        "canonical_key": "owner_name",
        "label_key": "owner_name",
    },
    {
        "concept_id": "owner.address",
        "section": "owner",
        "scope": "document",
        "canonical_key": "owner_address",
        "aliases": ["owner_id"],
        "label_key": "owner_address",
    },
    {
        "concept_id": "notes.main",
        "section": "notes",
        "scope": "document",
        "canonical_key": "notes",
        "label_key": "notes",
    },
    {
        "concept_id": "report.language",
        "section": "report_info",
        "scope": "document",
        "canonical_key": "language",
        "label_key": "language",
    },
)

_VISIT_GROUP_METADATA_KEYS_V1: tuple[str, ...] = (
    "visit_date",
    "admission_date",
    "discharge_date",
    "reason_for_visit",
)

_VISIT_SCOPED_KEYS_V1: tuple[str, ...] = (
    "symptoms",
    "diagnosis",
    "procedure",
    "medication",
    "treatment_plan",
    "allergies",
    "vaccinations",
    "lab_result",
    "imaging",
)

_VISIT_GROUP_METADATA_KEY_SET_V1 = set(_VISIT_GROUP_METADATA_KEYS_V1)
_VISIT_SCOPED_KEY_SET_V1 = set(_VISIT_SCOPED_KEYS_V1)
_VISIT_DATE_TOKEN_PATTERN_V1 = re.compile(
    r"(?P<iso>\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b)|"
    r"(?P<dmy>\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b)",
    re.IGNORECASE,
)
_VISIT_CONTEXT_PATTERN_V1 = re.compile(
    r"\b(visita|consulta|control|revisi[oó]n|seguimiento|ingreso|alta)\b",
    re.IGNORECASE,
)
_NON_VISIT_DATE_CONTEXT_PATTERN_V1 = re.compile(
    r"\b(nacimiento|dob|microchip|chip|factura|invoice|informe|emisi[oó]n|documento)\b",
    re.IGNORECASE,
)


def _normalize_visit_date_candidate_v1(value: object) -> str | None:
    if not isinstance(value, str):
        return None

    raw_value = value.strip()
    if not raw_value:
        return None

    candidates = [raw_value]
    for match in _VISIT_DATE_TOKEN_PATTERN_V1.finditer(raw_value):
        token = match.group(0)
        if token:
            candidates.append(token)

    seen_tokens: set[str] = set()
    for candidate in candidates:
        token = candidate.strip()
        if not token:
            continue
        token_key = token.casefold()
        if token_key in seen_tokens:
            continue
        seen_tokens.add(token_key)

        normalized_token = token.replace("/", "-").replace(".", "-")
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d-%m-%y"):
            try:
                parsed = datetime.strptime(normalized_token, fmt)
            except ValueError:
                continue
            if fmt == "%d-%m-%y" and (parsed.year < 2000 or parsed.year > 2100):
                continue
            if parsed.year < 1900 or parsed.year > 2100:
                continue
            return parsed.date().isoformat()

    return None


def _extract_visit_date_candidates_from_text_v1(*, text: object) -> list[str]:
    if not isinstance(text, str):
        return []

    snippet = text.strip()
    if not snippet:
        return []

    has_visit_context = _VISIT_CONTEXT_PATTERN_V1.search(snippet) is not None
    has_non_visit_context = _NON_VISIT_DATE_CONTEXT_PATTERN_V1.search(snippet) is not None
    if not has_visit_context or has_non_visit_context:
        return []

    dates: list[str] = []
    seen_dates: set[str] = set()
    for match in _VISIT_DATE_TOKEN_PATTERN_V1.finditer(snippet):
        normalized_date = _normalize_visit_date_candidate_v1(match.group(0))
        if normalized_date is None or normalized_date in seen_dates:
            continue
        seen_dates.add(normalized_date)
        dates.append(normalized_date)
    return dates


def _contains_any_date_token_v1(*, text: object) -> bool:
    if not isinstance(text, str):
        return False
    return _VISIT_DATE_TOKEN_PATTERN_V1.search(text) is not None


def _extract_evidence_snippet_v1(field: dict[str, object]) -> str | None:
    evidence = field.get("evidence")
    if not isinstance(evidence, dict):
        return None
    snippet = evidence.get("snippet")
    return snippet if isinstance(snippet, str) else None


def _default_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _to_utc_z(iso_timestamp: str) -> str:
    if iso_timestamp.endswith("+00:00"):
        return f"{iso_timestamp[:-6]}Z"
    return iso_timestamp


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
    normalized_data = dict(data)
    changed = False

    raw_fields = normalized_data.get("fields")
    if isinstance(raw_fields, list):
        normalized_fields: list[object] = []
        for item in raw_fields:
            if not isinstance(item, dict):
                normalized_fields.append(item)
                continue
            normalized_field = _sanitize_confidence_breakdown(item)
            normalized_fields.append(normalized_field)
            if normalized_field != item:
                changed = True
        if changed:
            normalized_data["fields"] = normalized_fields

    global_schema = normalized_data.get("global_schema_v0")
    if not isinstance(global_schema, dict):
        base_data = normalized_data if changed else data
        return _project_review_payload_to_v1(dict(base_data))

    raw_microchip = global_schema.get("microchip_id")
    normalized_microchip = normalize_microchip_digits_only(raw_microchip)
    if normalized_microchip == raw_microchip:
        base_data = normalized_data if changed else data
        return _project_review_payload_to_v1(dict(base_data))

    normalized_global_schema = dict(global_schema)
    normalized_global_schema["microchip_id"] = normalized_microchip
    normalized_data["global_schema_v0"] = normalized_global_schema

    return _project_review_payload_to_v1(normalized_data)


def _project_review_payload_to_v1(data: dict[str, object]) -> dict[str, object]:
    schema_version = data.get("schema_version")
    medical_record_view = data.get("medical_record_view")
    projected = dict(data)

    if schema_version != "v1":
        projected["schema_version"] = "v1"

    if not isinstance(medical_record_view, dict):
        projected["medical_record_view"] = {
            "version": "mvp-1",
            "sections": list(_MEDICAL_RECORD_V1_SECTIONS),
            "field_slots": [dict(slot) for slot in _MEDICAL_RECORD_V1_FIELD_SLOTS],
        }

    if not isinstance(projected.get("visits"), list):
        projected["visits"] = []
    if not isinstance(projected.get("other_fields"), list):
        projected["other_fields"] = []

    return _normalize_v1_review_scoping(projected)


def _normalize_v1_review_scoping(data: dict[str, object]) -> dict[str, object]:
    if data.get("schema_version") != "v1":
        return data

    raw_fields = data.get("fields")
    if not isinstance(raw_fields, list):
        return data

    projected = dict(data)
    fields_to_keep: list[object] = []
    visit_scoped_fields: list[dict[str, object]] = []
    visit_group_metadata: dict[str, list[object]] = {}
    detected_visit_dates: list[str] = []
    seen_detected_visit_dates: set[str] = set()

    for item in raw_fields:
        if not isinstance(item, dict):
            fields_to_keep.append(item)
            continue

        key_raw = item.get("key")
        key = key_raw if isinstance(key_raw, str) else ""
        if key in _VISIT_GROUP_METADATA_KEY_SET_V1:
            values = visit_group_metadata.setdefault(key, [])
            values.append(item.get("value"))
            if key == "visit_date":
                normalized_visit_date = _normalize_visit_date_candidate_v1(item.get("value"))
                if (
                    normalized_visit_date is not None
                    and normalized_visit_date not in seen_detected_visit_dates
                ):
                    seen_detected_visit_dates.add(normalized_visit_date)
                    detected_visit_dates.append(normalized_visit_date)
            continue

        if key in _VISIT_SCOPED_KEY_SET_V1:
            visit_field = dict(item)
            visit_field["scope"] = "visit"
            visit_field["section"] = "visits"
            visit_scoped_fields.append(visit_field)
            evidence_snippet = _extract_evidence_snippet_v1(visit_field)
            for normalized_visit_date in _extract_visit_date_candidates_from_text_v1(
                text=evidence_snippet
            ):
                if normalized_visit_date in seen_detected_visit_dates:
                    continue
                seen_detected_visit_dates.add(normalized_visit_date)
                detected_visit_dates.append(normalized_visit_date)
            continue

        fields_to_keep.append(item)

    if not visit_scoped_fields and not visit_group_metadata:
        return projected

    raw_visits = projected.get("visits")
    visits: list[dict[str, object]] = []
    if isinstance(raw_visits, list):
        for visit in raw_visits:
            if isinstance(visit, dict):
                visits.append(dict(visit))

    unassigned_visit: dict[str, object] | None = None
    assigned_visits: list[dict[str, object]] = []
    visit_by_date: dict[str, dict[str, object]] = {}
    for visit in visits:
        visit_id = visit.get("visit_id")
        if isinstance(visit_id, str) and visit_id == "unassigned":
            unassigned_visit = visit
            continue

        existing_fields = visit.get("fields")
        if isinstance(existing_fields, list):
            visit["fields"] = list(existing_fields)
        else:
            visit["fields"] = []

        normalized_visit_date = _normalize_visit_date_candidate_v1(visit.get("visit_date"))
        if normalized_visit_date is not None:
            visit["visit_date"] = normalized_visit_date
            visit_by_date.setdefault(normalized_visit_date, visit)
            if normalized_visit_date not in seen_detected_visit_dates:
                seen_detected_visit_dates.add(normalized_visit_date)
                detected_visit_dates.append(normalized_visit_date)

        assigned_visits.append(visit)

    for index, visit_date in enumerate(detected_visit_dates, start=1):
        if visit_date in visit_by_date:
            continue
        generated_visit = {
            "visit_id": f"visit-{index:03d}",
            "visit_date": visit_date,
            "admission_date": None,
            "discharge_date": None,
            "reason_for_visit": None,
            "fields": [],
        }
        assigned_visits.append(generated_visit)
        visit_by_date[visit_date] = generated_visit

    for visit in assigned_visits:
        for metadata_key in _VISIT_GROUP_METADATA_KEYS_V1:
            if metadata_key not in visit:
                visit[metadata_key] = None

    if unassigned_visit is not None:
        existing_unassigned_fields = unassigned_visit.get("fields")
        if isinstance(existing_unassigned_fields, list):
            unassigned_visit["fields"] = list(existing_unassigned_fields)
        else:
            unassigned_visit["fields"] = []

    for visit_field in visit_scoped_fields:
        evidence_snippet = _extract_evidence_snippet_v1(visit_field)
        evidence_visit_dates = _extract_visit_date_candidates_from_text_v1(text=evidence_snippet)
        target_visit: dict[str, object] | None = None
        for candidate_visit_date in evidence_visit_dates:
            target_visit = visit_by_date.get(candidate_visit_date)
            if target_visit is not None:
                break
        has_ambiguous_date_token = _contains_any_date_token_v1(text=evidence_snippet)
        if (
            target_visit is None
            and len(visit_by_date) == 1
            and not has_ambiguous_date_token
        ):
            target_visit = next(iter(visit_by_date.values()))

        if target_visit is None:
            if unassigned_visit is None:
                unassigned_visit = {
                    "visit_id": "unassigned",
                    "visit_date": None,
                    "admission_date": None,
                    "discharge_date": None,
                    "reason_for_visit": None,
                    "fields": [],
                }
            unassigned_fields = unassigned_visit.get("fields")
            if not isinstance(unassigned_fields, list):
                unassigned_fields = []
                unassigned_visit["fields"] = unassigned_fields
            unassigned_fields.append(visit_field)
            continue

        target_visit_fields = target_visit.get("fields")
        if not isinstance(target_visit_fields, list):
            target_visit_fields = []
            target_visit["fields"] = target_visit_fields
        target_visit_fields.append(visit_field)

    metadata_values_for_unassigned: dict[str, object] = {}
    for metadata_key in _VISIT_GROUP_METADATA_KEYS_V1:
        values = visit_group_metadata.get(metadata_key, [])
        if metadata_key == "visit_date":
            for value in values:
                normalized_visit_date = _normalize_visit_date_candidate_v1(value)
                if normalized_visit_date is None:
                    continue
                target_visit = visit_by_date.get(normalized_visit_date)
                if target_visit is None:
                    metadata_values_for_unassigned.setdefault(metadata_key, normalized_visit_date)
                    continue
                target_visit["visit_date"] = normalized_visit_date
            continue

        if values:
            metadata_values_for_unassigned.setdefault(metadata_key, values[0])

    if unassigned_visit is not None:
        for metadata_key in _VISIT_GROUP_METADATA_KEYS_V1:
            if metadata_key in metadata_values_for_unassigned:
                unassigned_visit[metadata_key] = metadata_values_for_unassigned[metadata_key]
            elif metadata_key not in unassigned_visit:
                unassigned_visit[metadata_key] = None

    assigned_visits.sort(
        key=lambda visit: (
            str(visit.get("visit_date") or "9999-12-31"),
            str(visit.get("visit_id") or ""),
        )
    )

    normalized_visits: list[dict[str, object]] = list(assigned_visits)
    if unassigned_visit is not None:
        normalized_visits.append(unassigned_visit)

    projected["fields"] = fields_to_keep
    projected["visits"] = normalized_visits
    return projected


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
    context_key = _resolve_context_key_for_edit_scopes(active_data, active_fields)
    calibration_policy_version = resolve_calibration_policy_version()

    updated_fields = [dict(field) for field in active_fields]
    field_change_logs: list[dict[str, object]] = []
    now_iso = now_provider()
    occurred_at = _to_utc_z(now_iso)

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
                "field_candidate_confidence": 1.0,
                "field_mapping_confidence": 1.0,
                "text_extraction_reliability": _sanitize_text_extraction_reliability(None),
                "field_review_history_adjustment": _sanitize_field_review_history_adjustment(0),
                "context_key": context_key,
                "mapping_id": None,
                "policy_version": calibration_policy_version,
                "is_critical": key in CRITICAL_KEYS_V0,
                "origin": "human",
            }
            new_field_key = new_field.get("key")
            resolved_field_key = new_field_key if isinstance(new_field_key, str) else None
            updated_fields.append(new_field)
            field_change_logs.append(
                _build_field_change_log(
                    document_id=run.document_id,
                    run_id=run_id,
                    interpretation_id="",  # Filled after new interpretation id is generated.
                    base_version_number=base_version_number,
                    new_version_number=active_version_number + 1,
                    field_id=new_field_id,
                    field_key=resolved_field_key,
                    value_type=value_type,
                    old_value=None,
                    new_value=change.get("value"),
                    change_type="ADD",
                    created_at=now_iso,
                    occurred_at=occurred_at,
                    context_key=context_key,
                    mapping_id=None,
                    policy_version=calibration_policy_version,
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

        existing_field = updated_fields[existing_index]
        old_value = existing_field.get("value")
        field_key = existing_field.get("key")
        resolved_field_key = str(field_key) if isinstance(field_key, str) else None
        existing_value_type = existing_field.get("value_type")
        resolved_value_type = (
            str(existing_value_type) if isinstance(existing_value_type, str) else None
        )
        if op == "DELETE":
            mapping_id = normalize_mapping_id(existing_field.get("mapping_id"))
            updated_fields.pop(existing_index)
            field_change_logs.append(
                _build_field_change_log(
                    document_id=run.document_id,
                    run_id=run_id,
                    interpretation_id="",
                    base_version_number=base_version_number,
                    new_version_number=active_version_number + 1,
                    field_id=field_id,
                    field_key=resolved_field_key,
                    value_type=resolved_value_type,
                    old_value=old_value,
                    new_value=None,
                    change_type="DELETE",
                    created_at=now_iso,
                    occurred_at=occurred_at,
                    context_key=context_key,
                    mapping_id=mapping_id,
                    policy_version=calibration_policy_version,
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
        if _is_noop_update(
            old_value=old_value,
            new_value=change.get("value"),
            existing_value_type=resolved_value_type,
            incoming_value_type=value_type,
        ):
            continue

        mapping_id = normalize_mapping_id(existing_field.get("mapping_id"))
        updated_fields[existing_index] = {
            **updated_fields[existing_index],
            "value": change.get("value"),
            "value_type": value_type,
            "origin": "human",
            "field_candidate_confidence": 1.0,
            "field_mapping_confidence": 1.0,
            "text_extraction_reliability": _sanitize_text_extraction_reliability(None),
            "field_review_history_adjustment": _sanitize_field_review_history_adjustment(0),
            "context_key": context_key,
            "mapping_id": mapping_id,
            "policy_version": calibration_policy_version,
        }
        field_change_logs.append(
            _build_field_change_log(
                document_id=run.document_id,
                run_id=run_id,
                interpretation_id="",
                base_version_number=base_version_number,
                new_version_number=active_version_number + 1,
                field_id=field_id,
                field_key=resolved_field_key,
                value_type=value_type,
                old_value=old_value,
                new_value=change.get("value"),
                change_type="UPDATE",
                created_at=now_iso,
                occurred_at=occurred_at,
                context_key=context_key,
                mapping_id=mapping_id,
                policy_version=calibration_policy_version,
            )
        )

    new_interpretation_id = str(uuid4())
    for log in field_change_logs:
        log["interpretation_id"] = new_interpretation_id

    new_data: dict[str, object] = dict(active_data)
    new_data["created_at"] = now_iso
    new_data["processing_run_id"] = run_id
    new_data["fields"] = [_sanitize_confidence_breakdown(field) for field in updated_fields]
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


def _normalize_string_for_noop(value: str) -> str:
    return " ".join(value.split())


def _normalize_value_for_noop(*, value: object, value_type: str) -> object:
    normalized_type = value_type.strip().lower()
    if normalized_type in {"string", "text", "date"}:
        if isinstance(value, str):
            return _normalize_string_for_noop(value)
        return value

    if normalized_type in {"integer", "int", "number", "float", "decimal"}:
        if isinstance(value, bool):
            return value
        if isinstance(value, NUMERIC_TYPES):
            numeric = float(value)
            if math.isfinite(numeric):
                return numeric
            return value
        if isinstance(value, str):
            candidate = value.strip()
            if not candidate:
                return candidate
            try:
                numeric = float(candidate)
            except ValueError:
                return candidate
            if math.isfinite(numeric):
                return numeric
            return candidate
        return value

    if normalized_type in {"boolean", "bool"}:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            candidate = value.strip().lower()
            if candidate in {"true", "1"}:
                return True
            if candidate in {"false", "0"}:
                return False
            return candidate
        return value

    if isinstance(value, str):
        return value.strip()
    return value


def _is_noop_update(
    *,
    old_value: object,
    new_value: object,
    existing_value_type: str | None,
    incoming_value_type: str,
) -> bool:
    if existing_value_type is None:
        return False
    if existing_value_type != incoming_value_type:
        return False
    return _normalize_value_for_noop(value=old_value, value_type=incoming_value_type) == (
        _normalize_value_for_noop(value=new_value, value_type=incoming_value_type)
    )


def _sanitize_text_extraction_reliability(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        numeric = float(value)
        if math.isfinite(numeric) and 0.0 <= numeric <= 1.0:
            return numeric
    return None


def _sanitize_field_review_history_adjustment(value: object) -> float:
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, int | float):
        numeric = float(value)
        if math.isfinite(numeric):
            return numeric
    return 0.0


def _sanitize_field_candidate_confidence(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, NUMERIC_TYPES):
        numeric = float(value)
        if math.isfinite(numeric):
            return min(max(numeric, 0.0), 1.0)
    return None


def _sanitize_field_mapping_confidence(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, NUMERIC_TYPES):
        numeric = float(value)
        if math.isfinite(numeric):
            return min(max(numeric, 0.0), 1.0)
    return None


def _compose_field_mapping_confidence(
    *, candidate_confidence: float, review_history_adjustment: float
) -> float:
    composed = candidate_confidence + (review_history_adjustment / 100.0)
    return min(max(composed, 0.0), 1.0)


def _sanitize_confidence_breakdown(field: dict[str, object]) -> dict[str, object]:
    sanitized = dict(field)
    sanitized.pop("confidence", None)
    sanitized["text_extraction_reliability"] = _sanitize_text_extraction_reliability(
        sanitized.get("text_extraction_reliability")
    )
    sanitized["field_review_history_adjustment"] = _sanitize_field_review_history_adjustment(
        sanitized.get("field_review_history_adjustment")
    )
    candidate_confidence = _sanitize_field_candidate_confidence(
        sanitized.get("field_candidate_confidence")
    )
    if candidate_confidence is None:
        mapping_confidence = _sanitize_field_mapping_confidence(
            sanitized.get("field_mapping_confidence")
        )
        candidate_confidence = mapping_confidence if mapping_confidence is not None else 0.0
    sanitized["field_candidate_confidence"] = candidate_confidence
    sanitized["field_mapping_confidence"] = _compose_field_mapping_confidence(
        candidate_confidence=candidate_confidence,
        review_history_adjustment=sanitized["field_review_history_adjustment"],
    )
    return sanitized


def _build_review_calibration_deltas(
    *,
    document_id: str,
    run_id: str,
    interpretation_data: dict[str, object],
) -> list[dict[str, object]]:
    fields = _coerce_interpretation_fields(interpretation_data.get("fields"))
    context_key = _resolve_context_key_for_edit_scopes(interpretation_data, fields)
    policy_version = next(
        (
            str(field_policy_version).strip()
            for field in fields
            if isinstance((field_policy_version := field.get("policy_version")), str)
            and str(field_policy_version).strip()
        ),
        resolve_calibration_policy_version(),
    )
    scoped_deltas: dict[tuple[str, str | None], dict[str, object]] = {}
    for field in fields:
        field_key = field.get("key")
        if not isinstance(field_key, str) or not field_key.strip():
            continue
        if is_empty_value(field.get("value")):
            continue

        mapping_id = normalize_mapping_id(field.get("mapping_id"))
        scope = (field_key, mapping_id)
        entry = scoped_deltas.setdefault(
            scope,
            {
                "context_key": context_key,
                "field_key": field_key,
                "mapping_id": mapping_id,
                "policy_version": policy_version,
                "accept_delta": 0,
                "edit_delta": 0,
            },
        )

        origin = field.get("origin")
        if origin == "human":
            entry["edit_delta"] = 1
            entry["accept_delta"] = 0
        elif origin == "machine" and int(entry["edit_delta"]) == 0:
            entry["accept_delta"] = 1

    return [
        {
            "event_type": (
                "field_accepted_unchanged"
                if delta["accept_delta"] == 1
                else "field_edited_confirmed"
            ),
            "source": "mark_reviewed",
            "document_id": document_id,
            "run_id": run_id,
            "field_key": delta["field_key"],
            "mapping_id": delta["mapping_id"],
            "context_key": delta["context_key"],
            "policy_version": delta["policy_version"],
            "accept_delta": delta["accept_delta"],
            "edit_delta": delta["edit_delta"],
        }
        for delta in scoped_deltas.values()
        if delta["accept_delta"] != 0 or delta["edit_delta"] != 0
    ]


def _resolve_context_key_for_edit_scopes(
    interpretation_data: dict[str, object],
    fields: list[dict[str, object]],
) -> str:
    for field in fields:
        context_key = field.get("context_key")
        if isinstance(context_key, str) and context_key.strip():
            return context_key
    return build_context_key_from_interpretation_data(interpretation_data)


def _apply_reviewed_document_calibration(
    *,
    document_id: str,
    reviewed_run_id: str | None,
    repository: DocumentRepository,
    created_at: str,
) -> None:
    if reviewed_run_id is None:
        return
    payload = repository.get_latest_artifact_payload(
        run_id=reviewed_run_id,
        artifact_type="STRUCTURED_INTERPRETATION",
    )
    if not isinstance(payload, dict):
        return
    interpretation_data = payload.get("data")
    if not isinstance(interpretation_data, dict):
        return

    signal_events = _build_review_calibration_deltas(
        document_id=document_id,
        run_id=reviewed_run_id,
        interpretation_data=interpretation_data,
    )
    for event in signal_events:
        repository.apply_calibration_deltas(
            context_key=str(event["context_key"]),
            field_key=str(event["field_key"]),
            mapping_id=normalize_mapping_id(event.get("mapping_id")),
            policy_version=str(event["policy_version"]),
            accept_delta=int(event["accept_delta"]),
            edit_delta=int(event["edit_delta"]),
            updated_at=created_at,
        )
        signal_type = (
            CALIBRATION_SIGNAL_ACCEPTED_UNCHANGED
            if int(event["accept_delta"]) == 1
            else CALIBRATION_SIGNAL_EDITED
        )
        repository.append_artifact(
            run_id=reviewed_run_id,
            artifact_type="CALIBRATION_SIGNAL",
            payload={
                **event,
                "signal_type": signal_type,
                "created_at": created_at,
            },
            created_at=created_at,
        )

    snapshot_payload = {
        "event_type": "calibration_review_snapshot",
        "source": "mark_reviewed",
        "document_id": document_id,
        "run_id": reviewed_run_id,
        "status": "applied",
        "created_at": created_at,
        "deltas": signal_events,
    }
    repository.append_artifact(
        run_id=reviewed_run_id,
        artifact_type="CALIBRATION_REVIEW_SNAPSHOT",
        payload=snapshot_payload,
        created_at=created_at,
    )


def _revert_reviewed_document_calibration(
    *,
    document_id: str,
    reviewed_run_id: str | None,
    repository: DocumentRepository,
    created_at: str,
) -> None:
    snapshot_run_id = reviewed_run_id
    snapshot: dict[str, object] | None = None

    if reviewed_run_id is not None:
        candidate_snapshot = repository.get_latest_artifact_payload(
            run_id=reviewed_run_id,
            artifact_type="CALIBRATION_REVIEW_SNAPSHOT",
        )
        if isinstance(candidate_snapshot, dict):
            if candidate_snapshot.get("status") == "reverted":
                return
            snapshot = candidate_snapshot
        else:
            logger.warning(
                "Calibration snapshot missing while reopening document_id=%s run_id=%s",
                document_id,
                reviewed_run_id,
            )

    if snapshot is None:
        fallback = repository.get_latest_applied_calibration_snapshot(document_id=document_id)
        if fallback is None:
            logger.warning(
                "Calibration snapshot missing while reopening document_id=%s reviewed_run_id=%s",
                document_id,
                reviewed_run_id,
            )
            return
        snapshot_run_id, snapshot = fallback

    raw_deltas = snapshot.get("deltas")
    if not isinstance(raw_deltas, list):
        logger.warning(
            "Calibration snapshot malformed while reopening document_id=%s run_id=%s",
            document_id,
            snapshot_run_id,
        )
        return

    reverted_deltas: list[dict[str, object]] = []
    for raw_delta in raw_deltas:
        if not isinstance(raw_delta, dict):
            continue
        context_key = raw_delta.get("context_key")
        field_key = raw_delta.get("field_key")
        policy_version = raw_delta.get("policy_version")
        if not isinstance(context_key, str) or not context_key.strip():
            continue
        if not isinstance(field_key, str) or not field_key.strip():
            continue
        if not isinstance(policy_version, str) or not policy_version.strip():
            continue

        accept_delta = int(raw_delta.get("accept_delta", 0))
        edit_delta = int(raw_delta.get("edit_delta", 0))
        if accept_delta == 0 and edit_delta == 0:
            continue

        mapping_id = normalize_mapping_id(raw_delta.get("mapping_id"))
        repository.apply_calibration_deltas(
            context_key=context_key,
            field_key=field_key,
            mapping_id=mapping_id,
            policy_version=policy_version,
            accept_delta=-accept_delta,
            edit_delta=-edit_delta,
            updated_at=created_at,
        )
        reverted_deltas.append(
            {
                "context_key": context_key,
                "field_key": field_key,
                "mapping_id": mapping_id,
                "policy_version": policy_version,
                "accept_delta": -accept_delta,
                "edit_delta": -edit_delta,
            }
        )

    repository.append_artifact(
        run_id=snapshot_run_id,
        artifact_type="CALIBRATION_REVIEW_REVERTED",
        payload={
            "event_type": "calibration_review_reverted",
            "source": "reopen_reviewed_document",
            "document_id": document_id,
            "run_id": snapshot_run_id,
            "reverted_from_snapshot_created_at": snapshot.get("created_at"),
            "created_at": created_at,
            "deltas": reverted_deltas,
        },
        created_at=created_at,
    )
    repository.append_artifact(
        run_id=snapshot_run_id,
        artifact_type="CALIBRATION_REVIEW_SNAPSHOT",
        payload={
            **snapshot,
            "status": "reverted",
            "reverted_at": created_at,
        },
        created_at=created_at,
    )


def _build_field_change_log(
    *,
    document_id: str,
    run_id: str,
    interpretation_id: str,
    base_version_number: int,
    new_version_number: int,
    field_id: str,
    field_key: str | None,
    value_type: str | None,
    old_value: object,
    new_value: object,
    change_type: str,
    created_at: str,
    occurred_at: str,
    context_key: str,
    mapping_id: str | None,
    policy_version: str,
) -> dict[str, object]:
    return {
        "event_type": "field_corrected",
        "source": "reviewer_edit",
        "document_id": document_id,
        "run_id": run_id,
        "change_id": str(uuid4()),
        "interpretation_id": interpretation_id,
        "base_version_number": base_version_number,
        "new_version_number": new_version_number,
        "field_id": field_id,
        "field_key": field_key,
        "field_path": f"fields.{field_id}.value",
        "value_type": value_type,
        "old_value": old_value,
        "new_value": new_value,
        "change_type": change_type,
        "created_at": created_at,
        "occurred_at": occurred_at,
        "context_key": context_key,
        "mapping_id": mapping_id,
        "policy_version": policy_version,
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
    latest_completed_run = repository.get_latest_completed_run(document_id)
    reviewed_run_id = latest_completed_run.run_id if latest_completed_run is not None else None
    updated = repository.update_review_status(
        document_id=document_id,
        review_status=ReviewStatus.REVIEWED.value,
        updated_at=reviewed_at,
        reviewed_at=reviewed_at,
        reviewed_by=reviewed_by,
        reviewed_run_id=reviewed_run_id,
    )
    if updated is None:
        return None

    _apply_reviewed_document_calibration(
        document_id=document_id,
        reviewed_run_id=reviewed_run_id,
        repository=repository,
        created_at=reviewed_at,
    )

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

    reopened_at = now_provider()
    updated = repository.update_review_status(
        document_id=document_id,
        review_status=ReviewStatus.IN_REVIEW.value,
        updated_at=reopened_at,
        reviewed_at=None,
        reviewed_by=None,
        reviewed_run_id=None,
    )
    if updated is None:
        return None

    _revert_reviewed_document_calibration(
        document_id=document_id,
        reviewed_run_id=document.reviewed_run_id,
        repository=repository,
        created_at=reopened_at,
    )

    return ReviewToggleResult(
        document_id=updated.document_id,
        review_status=updated.review_status.value,
        reviewed_at=updated.reviewed_at,
        reviewed_by=updated.reviewed_by,
    )
