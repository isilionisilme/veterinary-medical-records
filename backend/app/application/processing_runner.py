"""In-process processing scheduler and run execution."""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
import zlib
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from backend.app.application.extraction_observability import (
    build_extraction_snapshot_from_interpretation,
    persist_extraction_run_snapshot,
)
from backend.app.application.extraction_quality import evaluate_extracted_text_quality
from backend.app.application.field_normalizers import normalize_canonical_fields
from backend.app.application.global_schema_v0 import (
    CRITICAL_KEYS_V0,
    GLOBAL_SCHEMA_V0_KEYS,
    REPEATABLE_KEYS_V0,
    VALUE_TYPE_BY_KEY_V0,
    normalize_global_schema_v0,
    validate_global_schema_v0_shape,
)
from backend.app.config import extraction_observability_enabled
from backend.app.domain.models import (
    ProcessingRun,
    ProcessingRunState,
    StepName,
    StepStatus,
)
from backend.app.ports.document_repository import DocumentRepository
from backend.app.ports.file_storage import FileStorage

logger = logging.getLogger(__name__)

PROCESSING_TICK_SECONDS = 0.5
PROCESSING_TIMEOUT_SECONDS = 120.0
MAX_RUNS_PER_TICK = 10
PDF_EXTRACTOR_FORCE_ENV = "PDF_EXTRACTOR_FORCE"
INTERPRETATION_DEBUG_INCLUDE_CANDIDATES_ENV = (
    "VET_RECORDS_INCLUDE_INTERPRETATION_CANDIDATES"
)
COVERAGE_CONFIDENCE_LABEL = 0.66
COVERAGE_CONFIDENCE_FALLBACK = 0.50
MVP_COVERAGE_DEBUG_KEYS: tuple[str, ...] = (
    "microchip_id",
    "clinical_record_number",
    "pet_name",
    "species",
    "breed",
    "sex",
    "weight",
    "visit_date",
    "owner_name",
    "owner_address",
    "diagnosis",
    "procedure",
    "medication",
    "reason_for_visit",
    "symptoms",
    "treatment_plan",
    "clinic_address",
    "clinic_name",
    "coat_color",
    "hair_length",
    "repro_status",
)
DATE_TARGET_KEYS = frozenset(
    {"visit_date", "document_date", "admission_date", "discharge_date"}
)
_DATE_CANDIDATE_PATTERN = re.compile(
    r"\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b"
)
_DATE_TARGET_ANCHORS: dict[str, tuple[str, ...]] = {
    "visit_date": (
        "visita",
        "consulta",
        "revision",
        "revisión",
        "control",
        "urgencia",
    ),
    "document_date": (
        "fecha documento",
        "documento",
        "informe",
        "historial",
        "fecha",
    ),
    "admission_date": ("admisión", "admision", "ingreso", "hospitaliza"),
    "discharge_date": ("alta", "egreso"),
}
_DATE_TARGET_PRIORITY: dict[str, int] = {
    "visit_date": 4,
    "admission_date": 3,
    "discharge_date": 3,
    "document_date": 2,
}
_MICROCHIP_KEYWORD_WINDOW_PATTERN = re.compile(
    r"(?is)(?:microchip|chip|n[ºo°\uFFFD]\s*chip)\s*(?:n[ºo°\uFFFD]\.?|id)?\s*[:\-]?\s*([^\n]{0,90})"
)
_MICROCHIP_DIGITS_PATTERN = re.compile(r"(?<!\d)(\d{9,15})(?!\d)")
_MICROCHIP_OCR_PREFIX_WINDOW_PATTERN = re.compile(
    r"(?is)\bn(?:[º°\uFFFD]|ro)\.?\s*[:\-]?\s*([^\n]{0,60})"
)
_VET_LABEL_LINE_PATTERN = re.compile(
    r"(?i)^\s*(?:veterinari(?:o|a|o/a)|vet|dr\.?|dra\.?|dr/a|doctor|doctora)\b\s*[:\-]?\s*(.*)$"
)
_OWNER_LABEL_LINE_PATTERN = re.compile(
    r"(?i)^\s*(?:propietari(?:o|a)|titular|dueñ(?:o|a)|owner)\b\s*[:\-]?\s*(.*)$"
)
_OWNER_NOMBRE_LINE_PATTERN = re.compile(r"(?i)^\s*nombre\s*(?::|-)?\s*(.*)$")
_OWNER_CLIENT_HEADER_LINE_PATTERN = re.compile(r"(?i)^\s*datos\s+del\s+cliente\s*$")
_OWNER_CLIENT_TABULAR_LABEL_LINE_PATTERN = re.compile(
    r"(?i)^\s*(?:especie|raza|f/?nto|capa|n[º°o]?\s*chip)\s*$"
)
_OWNER_INLINE_CONTEXT_WINDOW_LINES = 2
_OWNER_HEADER_LOOKBACK_LINES = 8
_OWNER_TABULAR_FORWARD_SCAN_LINES = 8
_NAME_TOKEN_PATTERN = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\.-]*$")
_ADDRESS_SPLIT_PATTERN = re.compile(
    r"(?i)\b(?:c/|calle|av\.?|avenida|cp\b|n[º°o]\.?|num\.?|número|plaza|pte\.?|portal|piso|puerta)\b"
)
_ADDRESS_LIKE_PATTERN = re.compile(
    r"(?i)(?:\b(?:c/|calle|av\.?|avenida|cp\b|portal|piso|puerta)\b|\d+\s*(?:[,\-]|$))"
)
_PHONE_LIKE_PATTERN = re.compile(r"\+?\d[\d\s().-]{6,}")
_LICENSE_ONLY_PATTERN = re.compile(
    r"(?i)^\s*(?:col(?:egiad[oa])?\.?|n[º°o]?\s*col\.?|lic(?:encia)?\.?|cmp\.?|nif\b|dni\b)\s*[:\-]?\s*[A-Za-z0-9\-./\s]{3,}$"
)
_OWNER_CONTEXT_PATTERN = re.compile(
    r"(?i)\b(?:propietari(?:o|a)|titular|dueñ(?:o|a)|owner)\b"
)
_OWNER_PATIENT_LABEL_PATTERN = re.compile(r"(?i)\bpaciente\b\s*[:\-]")
_VET_OR_CLINIC_CONTEXT_PATTERN = re.compile(
    r"(?i)\b(?:veterinari[oa]|vet\b|doctor(?:a)?\b|dra\.?\b|dr\.?\b|cl[ií]nica|hospital|centro\s+veterinario)\b"
)
_CLINICAL_RECORD_GUARD_PATTERN = re.compile(r"(?i)\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b")


def _default_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _default_id() -> str:
    return str(uuid4())


@dataclass(frozen=True, slots=True)
class EnqueuedRun:
    run_id: str
    created_at: str
    state: ProcessingRunState


class ProcessingError(Exception):
    """Processing failure with a failure_type mapping."""

    def __init__(self, failure_type: str) -> None:
        super().__init__(failure_type)
        self.failure_type = failure_type


class InterpretationBuildError(Exception):
    """Raised when interpretation cannot be built into the canonical v0 shape."""

    def __init__(
        self, *, error_code: str, details: dict[str, object] | None = None
    ) -> None:
        super().__init__(error_code)
        self.error_code = error_code
        self.details = details


def enqueue_processing_run(
    *,
    document_id: str,
    repository: DocumentRepository,
    id_provider: callable = _default_id,
    now_provider: callable = _default_now_iso,
) -> EnqueuedRun:
    """Create a new queued processing run (append-only)."""

    run_id = id_provider()
    created_at = now_provider()
    repository.create_processing_run(
        run_id=run_id,
        document_id=document_id,
        state=ProcessingRunState.QUEUED,
        created_at=created_at,
    )
    return EnqueuedRun(
        run_id=run_id, created_at=created_at, state=ProcessingRunState.QUEUED
    )


async def processing_scheduler(
    *,
    repository: DocumentRepository,
    storage: FileStorage,
    stop_event: asyncio.Event,
    tick_seconds: float = PROCESSING_TICK_SECONDS,
) -> None:
    """Continuously start eligible queued runs and execute them."""

    while not stop_event.is_set():
        await _process_queued_runs(repository=repository, storage=storage)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=tick_seconds)
        except asyncio.TimeoutError:
            continue


async def _process_queued_runs(
    *, repository: DocumentRepository, storage: FileStorage
) -> None:
    queued_runs = repository.list_queued_runs(limit=MAX_RUNS_PER_TICK)
    for run in queued_runs:
        started = repository.try_start_run(
            run_id=run.run_id,
            document_id=run.document_id,
            started_at=_default_now_iso(),
        )
        if not started:
            continue
        await _execute_run(run=run, repository=repository, storage=storage)


async def _execute_run(
    *, run: ProcessingRun, repository: DocumentRepository, storage: FileStorage
) -> None:
    try:
        await asyncio.wait_for(
            _process_document(
                run_id=run.run_id,
                document_id=run.document_id,
                repository=repository,
                storage=storage,
            ),
            timeout=PROCESSING_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        repository.complete_run(
            run_id=run.run_id,
            state=ProcessingRunState.TIMED_OUT,
            completed_at=_default_now_iso(),
            failure_type=None,
        )
        return
    except ProcessingError as exc:
        repository.complete_run(
            run_id=run.run_id,
            state=ProcessingRunState.FAILED,
            completed_at=_default_now_iso(),
            failure_type=exc.failure_type,
        )
        return
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Processing run failed: %s", exc)
        repository.complete_run(
            run_id=run.run_id,
            state=ProcessingRunState.FAILED,
            completed_at=_default_now_iso(),
            failure_type="INTERPRETATION_FAILED",
        )
        return

    completed_at = _default_now_iso()
    repository.complete_run(
        run_id=run.run_id,
        state=ProcessingRunState.COMPLETED,
        completed_at=completed_at,
        failure_type=None,
    )
    _persist_observability_snapshot_for_completed_run(
        repository=repository,
        document_id=run.document_id,
        run_id=run.run_id,
        created_at=completed_at,
    )


def _persist_observability_snapshot_for_completed_run(
    *,
    repository: DocumentRepository,
    document_id: str,
    run_id: str,
    created_at: str,
) -> None:
    if not extraction_observability_enabled():
        return

    interpretation_payload = repository.get_latest_artifact_payload(
        run_id=run_id,
        artifact_type="STRUCTURED_INTERPRETATION",
    )
    if not isinstance(interpretation_payload, dict):
        return

    snapshot = build_extraction_snapshot_from_interpretation(
        document_id=document_id,
        run_id=run_id,
        created_at=created_at,
        interpretation_payload=interpretation_payload,
    )
    if not isinstance(snapshot, dict):
        return

    try:
        persist_extraction_run_snapshot(snapshot)
    except Exception:  # pragma: no cover - defensive
        logger.exception(
            "Failed to persist extraction observability snapshot for completed run",
            extra={"document_id": document_id, "run_id": run_id},
        )


async def _process_document(
    *,
    run_id: str,
    document_id: str,
    repository: DocumentRepository,
    storage: FileStorage,
) -> None:
    extraction_started_at = _default_now_iso()
    _append_step_status(
        repository=repository,
        run_id=run_id,
        step_name=StepName.EXTRACTION,
        step_status=StepStatus.RUNNING,
        attempt=1,
        started_at=extraction_started_at,
        ended_at=None,
        error_code=None,
    )

    document = repository.get(document_id)
    if document is None:
        _append_step_status(
            repository=repository,
            run_id=run_id,
            step_name=StepName.EXTRACTION,
            step_status=StepStatus.FAILED,
            attempt=1,
            started_at=extraction_started_at,
            ended_at=_default_now_iso(),
            error_code="EXTRACTION_FAILED",
        )
        raise ProcessingError("EXTRACTION_FAILED")
    if not storage.exists(storage_path=document.storage_path):
        _append_step_status(
            repository=repository,
            run_id=run_id,
            step_name=StepName.EXTRACTION,
            step_status=StepStatus.FAILED,
            attempt=1,
            started_at=extraction_started_at,
            ended_at=_default_now_iso(),
            error_code="EXTRACTION_FAILED",
        )
        raise ProcessingError("EXTRACTION_FAILED")

    file_path = storage.resolve(storage_path=document.storage_path)
    file_size = await asyncio.to_thread(lambda: file_path.stat().st_size)
    if file_size == 0:
        _append_step_status(
            repository=repository,
            run_id=run_id,
            step_name=StepName.EXTRACTION,
            step_status=StepStatus.FAILED,
            attempt=1,
            started_at=extraction_started_at,
            ended_at=_default_now_iso(),
            error_code="EXTRACTION_FAILED",
        )
        raise ProcessingError("EXTRACTION_FAILED")

    raw_text, extractor_used = await asyncio.to_thread(
        _extract_pdf_text_with_extractor, file_path
    )
    quality_score, quality_pass, quality_reasons = evaluate_extracted_text_quality(
        raw_text
    )
    logger.info(
        (
            "PDF extraction finished run_id=%s document_id=%s extractor=%s chars=%d "
            "quality_score=%.3f quality_pass=%s quality_reasons=%s"
        ),
        run_id,
        document_id,
        extractor_used,
        len(raw_text),
        quality_score,
        quality_pass,
        quality_reasons,
    )
    if not quality_pass:
        _append_step_status(
            repository=repository,
            run_id=run_id,
            step_name=StepName.EXTRACTION,
            step_status=StepStatus.FAILED,
            attempt=1,
            started_at=extraction_started_at,
            ended_at=_default_now_iso(),
            error_code="EXTRACTION_LOW_QUALITY",
        )
        raise ProcessingError("EXTRACTION_LOW_QUALITY")

    try:
        storage.save_raw_text(document_id=document_id, run_id=run_id, text=raw_text)
    except Exception as exc:
        _append_step_status(
            repository=repository,
            run_id=run_id,
            step_name=StepName.EXTRACTION,
            step_status=StepStatus.FAILED,
            attempt=1,
            started_at=extraction_started_at,
            ended_at=_default_now_iso(),
            error_code="EXTRACTION_FAILED",
        )
        raise ProcessingError("EXTRACTION_FAILED") from exc

    _append_step_status(
        repository=repository,
        run_id=run_id,
        step_name=StepName.EXTRACTION,
        step_status=StepStatus.SUCCEEDED,
        attempt=1,
        started_at=extraction_started_at,
        ended_at=_default_now_iso(),
        error_code=None,
    )

    interpretation_started_at = _default_now_iso()
    _append_step_status(
        repository=repository,
        run_id=run_id,
        step_name=StepName.INTERPRETATION,
        step_status=StepStatus.RUNNING,
        attempt=1,
        started_at=interpretation_started_at,
        ended_at=None,
        error_code=None,
    )
    try:
        interpretation_payload = _build_interpretation_artifact(
            document_id=document_id,
            run_id=run_id,
            raw_text=raw_text,
        )
        repository.append_artifact(
            run_id=run_id,
            artifact_type="STRUCTURED_INTERPRETATION",
            payload=interpretation_payload,
            created_at=_default_now_iso(),
        )
    except InterpretationBuildError as exc:
        _append_step_status(
            repository=repository,
            run_id=run_id,
            step_name=StepName.INTERPRETATION,
            step_status=StepStatus.FAILED,
            attempt=1,
            started_at=interpretation_started_at,
            ended_at=_default_now_iso(),
            error_code=exc.error_code,
            details=exc.details,
        )
        raise ProcessingError("INTERPRETATION_FAILED") from exc
    except Exception as exc:
        _append_step_status(
            repository=repository,
            run_id=run_id,
            step_name=StepName.INTERPRETATION,
            step_status=StepStatus.FAILED,
            attempt=1,
            started_at=interpretation_started_at,
            ended_at=_default_now_iso(),
            error_code="INTERPRETATION_FAILED",
            details=None,
        )
        raise ProcessingError("INTERPRETATION_FAILED") from exc

    await asyncio.sleep(0.05)
    _append_step_status(
        repository=repository,
        run_id=run_id,
        step_name=StepName.INTERPRETATION,
        step_status=StepStatus.SUCCEEDED,
        attempt=1,
        started_at=interpretation_started_at,
        ended_at=_default_now_iso(),
        error_code=None,
    )


def _build_interpretation_artifact(
    *, document_id: str, run_id: str, raw_text: str
) -> dict[str, object]:
    compact_text = _WHITESPACE_PATTERN.sub(" ", raw_text).strip()
    warning_codes: list[str] = []
    candidate_bundle: dict[str, list[dict[str, object]]] = {}
    canonical_evidence: dict[str, list[dict[str, object]]] = {}

    if compact_text:
        candidate_bundle = _mine_interpretation_candidates(raw_text)
        canonical_values, canonical_evidence = _map_candidates_to_global_schema(
            candidate_bundle
        )
        canonical_values = normalize_canonical_fields(
            canonical_values,
            canonical_evidence,
        )
        normalized_values = normalize_global_schema_v0(canonical_values)
        validation_errors = validate_global_schema_v0_shape(normalized_values)
        if validation_errors:
            raise InterpretationBuildError(
                error_code="INTERPRETATION_VALIDATION_FAILED",
                details={"errors": validation_errors},
            )

        fields = _build_structured_fields_from_global_schema(
            normalized_values=normalized_values,
            evidence_map=canonical_evidence,
        )
    else:
        normalized_values = normalize_global_schema_v0(None)
        fields = []
        warning_codes.append("EMPTY_RAW_TEXT")

    populated_keys = [
        key
        for key in GLOBAL_SCHEMA_V0_KEYS
        if (
            isinstance(normalized_values.get(key), list)
            and len(normalized_values.get(key, [])) > 0
        )
        or (
            isinstance(normalized_values.get(key), str)
            and bool(normalized_values.get(key))
        )
    ]
    now_iso = _default_now_iso()
    mvp_coverage_debug = _build_mvp_coverage_debug_summary(
        raw_text=raw_text,
        normalized_values=normalized_values,
        candidate_bundle=candidate_bundle,
        evidence_map=canonical_evidence,
    )
    data = {
        "schema_version": "v0",
        "document_id": document_id,
        "processing_run_id": run_id,
        "created_at": now_iso,
        "fields": fields,
        "global_schema_v0": normalized_values,
        "summary": {
            "total_keys": len(GLOBAL_SCHEMA_V0_KEYS),
            "populated_keys": len(populated_keys),
            "keys_present": populated_keys,
            "warning_codes": warning_codes,
            "date_selection": _build_date_selection_debug(canonical_evidence),
            "mvp_coverage_debug": mvp_coverage_debug,
        },
    }
    logger.info(
        "MVP coverage debug run_id=%s document_id=%s fields=%s",
        run_id,
        document_id,
        mvp_coverage_debug,
    )
    if _should_include_interpretation_candidates():
        data["candidate_bundle"] = candidate_bundle

    return {
        "interpretation_id": str(uuid4()),
        "version_number": 1,
        "data": data,
    }


def _should_include_interpretation_candidates() -> bool:
    raw = os.getenv(INTERPRETATION_DEBUG_INCLUDE_CANDIDATES_ENV, "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _mine_interpretation_candidates(
    raw_text: str
) -> dict[str, list[dict[str, object]]]:
    compact_text = _WHITESPACE_PATTERN.sub(" ", raw_text).strip()
    candidates: dict[str, list[dict[str, object]]] = defaultdict(list)
    seen_values: dict[str, set[str]] = defaultdict(set)

    def split_owner_before_address_tokens(text: str) -> str:
        tokens = text.split()
        if not tokens:
            return ""

        address_markers = {
            "calle",
            "av",
            "av.",
            "avenida",
            "cp",
            "codigo",
            "postal",
            "no",
            "no.",
            "nº",
            "n°",
            "num",
            "num.",
            "número",
            "plaza",
            "pte",
            "pte.",
            "portal",
            "piso",
            "puerta",
        }
        for index, token in enumerate(tokens):
            normalized_token = token.casefold().strip(".,:;()[]{}")
            if (
                normalized_token == "codigo"
                and index + 1 < len(tokens)
                and tokens[index + 1].casefold().strip(".,:;()[]{}") == "postal"
            ):
                return " ".join(tokens[:index]).strip()
            if normalized_token.startswith("c/") or normalized_token in address_markers:
                return " ".join(tokens[:index]).strip()
        return text

    def normalize_person_fragment(fragment: str) -> str | None:
        value = _WHITESPACE_PATTERN.sub(" ", fragment).strip(" .,:;\t\r\n")
        if not value:
            return None
        if "@" in value or _PHONE_LIKE_PATTERN.search(value):
            return None
        if _LICENSE_ONLY_PATTERN.match(value):
            return None
        if _ADDRESS_LIKE_PATTERN.search(value):
            return None

        tokens = value.split()
        if not 2 <= len(tokens) <= 5:
            return None
        letter_tokens = [token for token in tokens if _NAME_TOKEN_PATTERN.match(token)]
        if len(letter_tokens) < max(2, int(len(tokens) * 0.6)):
            return None
        return " ".join(tokens)

    def add_candidate(
        *,
        key: str,
        value: str,
        confidence: float,
        snippet: str,
        page: int | None = 1,
        anchor: str | None = None,
        anchor_priority: int = 0,
        target_reason: str | None = None,
    ) -> None:
        cleaned_value = value.strip(" .,:;\t\r\n")
        if not cleaned_value:
            return

        if key == "microchip_id":
            digit_match = _MICROCHIP_DIGITS_PATTERN.search(cleaned_value)
            if digit_match is None:
                return
            cleaned_value = digit_match.group(1)

        if key == "owner_name":
            cleaned_value = split_owner_before_address_tokens(cleaned_value)
            normalized_person = normalize_person_fragment(cleaned_value)
            if normalized_person is None:
                return
            cleaned_value = normalized_person
            if _VET_OR_CLINIC_CONTEXT_PATTERN.search(snippet) is not None:
                return

        if key == "vet_name":
            normalized_person = normalize_person_fragment(cleaned_value)
            if normalized_person is None:
                return
            if _ADDRESS_LIKE_PATTERN.search(normalized_person):
                return
            cleaned_value = normalized_person

        normalized_key = cleaned_value.casefold()
        if normalized_key in seen_values[key]:
            return
        seen_values[key].add(normalized_key)
        effective_confidence = (
            COVERAGE_CONFIDENCE_LABEL
            if confidence >= COVERAGE_CONFIDENCE_LABEL
            else COVERAGE_CONFIDENCE_FALLBACK
        )
        candidates[key].append(
            {
                "value": cleaned_value,
                "confidence": round(min(max(effective_confidence, 0.0), 1.0), 2),
                "anchor": anchor,
                "anchor_priority": anchor_priority,
                "target_reason": target_reason,
                "evidence": {
                    "page": page,
                    "snippet": snippet.strip()[:220],
                },
            }
        )

    def add_labeled_person_candidates(
        *,
        key: str,
        pattern: re.Pattern[str],
        confidence: float,
        owner_mode: bool = False,
    ) -> None:
        raw_lines = raw_text.splitlines()

        for index, raw_line in enumerate(raw_lines):
            line = raw_line.strip()
            if not line:
                continue

            match = pattern.match(line)
            if match is None:
                continue

            candidate_source = match.group(1).strip() if isinstance(match.group(1), str) else ""
            if not candidate_source and ":" in line:
                for next_index in range(index + 1, min(index + 4, len(raw_lines))):
                    next_line = raw_lines[next_index].strip()
                    if next_line:
                        candidate_source = next_line
                        break

            if not candidate_source:
                continue

            if owner_mode:
                candidate_source = split_owner_before_address_tokens(candidate_source)

            normalized = normalize_person_fragment(candidate_source)
            if normalized is None:
                continue

            lower_line = line.casefold()
            if key == "vet_name" and _ADDRESS_LIKE_PATTERN.search(lower_line):
                continue
            if key == "owner_name" and _VET_OR_CLINIC_CONTEXT_PATTERN.search(lower_line):
                continue

            add_candidate(
                key=key,
                value=normalized,
                confidence=confidence,
                snippet=line,
            )

    add_labeled_person_candidates(
        key="vet_name",
        pattern=_VET_LABEL_LINE_PATTERN,
        confidence=COVERAGE_CONFIDENCE_LABEL,
    )
    add_labeled_person_candidates(
        key="owner_name",
        pattern=_OWNER_LABEL_LINE_PATTERN,
        confidence=COVERAGE_CONFIDENCE_LABEL,
        owner_mode=True,
    )

    raw_lines = raw_text.splitlines()
    for index, raw_line in enumerate(raw_lines):
        line = raw_line.strip()
        if not line:
            continue
        match = _OWNER_NOMBRE_LINE_PATTERN.match(line)
        if match is None:
            continue

        window_start = max(0, index - _OWNER_INLINE_CONTEXT_WINDOW_LINES)
        window_end = min(
            len(raw_lines),
            index + _OWNER_INLINE_CONTEXT_WINDOW_LINES + 1,
        )
        context_window = " ".join(raw_lines[window_start:window_end])
        pre_context_window = " ".join(raw_lines[window_start:index])
        has_owner_context = _OWNER_CONTEXT_PATTERN.search(context_window) is not None
        previous_non_empty_line = ""
        for back_index in range(index - 1, -1, -1):
            previous_line = raw_lines[back_index].strip()
            if previous_line:
                previous_non_empty_line = previous_line
                break

        has_client_header_context = bool(
            previous_non_empty_line
            and _OWNER_CLIENT_HEADER_LINE_PATTERN.match(previous_non_empty_line)
        )
        if not has_owner_context and not has_client_header_context:
            lookback_start = max(0, index - _OWNER_HEADER_LOOKBACK_LINES)
            has_client_header_context = any(
                _OWNER_CLIENT_HEADER_LINE_PATTERN.match(raw_lines[lookback_index].strip())
                for lookback_index in range(lookback_start, index)
            )
        if not has_owner_context and not has_client_header_context:
            continue
        if _VET_OR_CLINIC_CONTEXT_PATTERN.search(context_window) is not None:
            continue
        if not has_owner_context and _OWNER_PATIENT_LABEL_PATTERN.search(pre_context_window):
            continue

        candidate_source = match.group(1).strip() if isinstance(match.group(1), str) else ""
        if not candidate_source:
            for next_index in range(
                index + 1,
                min(index + _OWNER_TABULAR_FORWARD_SCAN_LINES + 1, len(raw_lines)),
            ):
                next_line = raw_lines[next_index].strip()
                if not next_line:
                    continue
                if _OWNER_CLIENT_TABULAR_LABEL_LINE_PATTERN.match(next_line):
                    continue

                inline_candidate = split_owner_before_address_tokens(next_line)
                inline_normalized = normalize_person_fragment(inline_candidate)
                if inline_normalized is None:
                    continue

                candidate_source = inline_normalized
                break

        candidate_source = split_owner_before_address_tokens(candidate_source)

        normalized = normalize_person_fragment(candidate_source)
        if normalized is None:
            continue

        add_candidate(
            key="owner_name",
            value=normalized,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )

    labeled_patterns: tuple[tuple[str, str, float], ...] = (
        (
            "pet_name",
            r"(?:paciente|nombre(?:\s+del\s+paciente)?|patient)\s*[:\-]\s*([^\n;]{2,100})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "species",
            r"(?:especie\s*/\s*raza|raza\s*/\s*especie)\s*[:\-]\s*([^\n;]{2,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "breed",
            r"(?:especie\s*/\s*raza|raza\s*/\s*especie)\s*[:\-]\s*([^\n;]{2,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        ("species", r"(?:especie|species)\s*[:\-]\s*([^\n;]{2,80})", COVERAGE_CONFIDENCE_LABEL),
        ("breed", r"(?:raza|breed)\s*[:\-]\s*([^\n;]{2,80})", COVERAGE_CONFIDENCE_LABEL),
        ("sex", r"(?:sexo|sex)\s*[:\-]\s*([^\n;]{1,40})", COVERAGE_CONFIDENCE_LABEL),
        ("age", r"(?:edad|age)\s*[:\-]\s*([^\n;]{1,60})", COVERAGE_CONFIDENCE_LABEL),
        (
            "dob",
            r"(?:f(?:echa)?\s*(?:de\s*)?(?:nacimiento|nac\.|nac)|dob|birth\s*date)\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "weight",
            r"(?:peso|weight)\s*[:\-]?\s*([0-9]+(?:[\.,][0-9]+)?\s*(?:kg|kgs|g)?)",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "microchip_id",
            r"(?:microchip|chip)\s*(?:n[ºo°\uFFFD]\.?|nro\.?|id)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9./_\-]{1,30}(?:\s+[A-Za-z0-9][A-Za-z0-9./_\-]{0,20}){0,3})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "clinical_record_number",
            r"(?:nhc|n[ºo°]?\s*(?:historial|historia\s*cl[ií]nica)|historial\s*cl[ií]nico|n[uú]mero\s*de\s*historial)\s*[:\-]?\s*([A-Za-z0-9./_\-]{2,40})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "visit_date",
            r"(?:fecha\s+de\s+visita|visita|consulta|visit\s+date)\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "document_date",
            r"(?:fecha\s+documento|fecha|date)\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "clinic_name",
            r"(?:cl[ií]nica|centro\s+veterinario|hospital\s+veterinario)\s*[:\-]\s*([^\n;]{3,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "clinic_address",
            r"(?:direcci[oó]n\s*(?:de\s*la\s*cl[ií]nica)?|domicilio\s*(?:de\s*la\s*cl[ií]nica)?)\s*[:\-]\s*([^\n;]{4,160})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "vet_name",
            r"(?:veterinari[oa]|dr\.?|dra\.?)\s*[:\-]\s*([^\n;]{3,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "owner_name",
            r"(?:propietari[oa]|tutor)\s*[:\-]\s*([^\n;]{3,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "owner_address",
            (
                r"(?:direcci[oó]n\s*(?:del\s*propietari[oa])?|domicilio\s*"
                r"(?:del\s*propietari[oa])?)\s*[:\-]\s*([^\n;]{4,160})"
            ),
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "coat_color",
            r"(?:capa|color\s*(?:del\s*(?:pelaje|pelo))?)\s*[:\-]\s*([^\n;]{2,100})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "hair_length",
            r"(?:pelo|longitud\s*del\s*pelo)\s*[:\-]\s*([^\n;]{2,100})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "repro_status",
            (
                r"(?:estado\s*reproductivo|repro(?:ductivo)?|esterilizad[oa]|"
                r"castrad[oa]|f[eé]rtil)\s*[:\-]\s*([^\n;]{2,80})"
            ),
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "reason_for_visit",
            r"(?:motivo(?:\s+de\s+consulta)?|reason\s+for\s+visit)\s*[:\-]\s*([^\n]{3,200})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "invoice_total",
            r"(?:total|importe\s+total|total\s+factura)\s*[:\-]?\s*([0-9]+(?:[\.,][0-9]{2})?\s*(?:€|eur)?)",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "covered_amount",
            r"(?:cubierto|covered)\s*[:\-]?\s*([0-9]+(?:[\.,][0-9]{2})?\s*(?:€|eur)?)",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "non_covered_amount",
            r"(?:no\s+cubierto|non[-\s]?covered)\s*[:\-]?\s*([0-9]+(?:[\.,][0-9]{2})?\s*(?:€|eur)?)",
            COVERAGE_CONFIDENCE_LABEL,
        ),
    )

    for key, pattern, confidence in labeled_patterns:
        for match in re.finditer(pattern, raw_text, flags=re.IGNORECASE):
            add_candidate(
                key=key,
                value=match.group(1),
                confidence=confidence,
                snippet=match.group(0),
            )

    for match in _MICROCHIP_KEYWORD_WINDOW_PATTERN.finditer(raw_text):
        window = match.group(1) if isinstance(match.group(1), str) else ""
        digit_match = _MICROCHIP_DIGITS_PATTERN.search(window)
        if digit_match is None:
            continue
        add_candidate(
            key="microchip_id",
            value=digit_match.group(1),
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=match.group(0),
        )

    for match in re.finditer(
        (
            r"(?is)(?:nhc|n[ºo°]?\s*(?:historial|historia\s*cl[ií]nica)|"
            r"historial\s*cl[ií]nico)\s*[:\-]?\s*([^\n]{1,60})"
        ),
        raw_text,
    ):
        raw_value = str(match.group(1)).strip()
        if not raw_value or _CLINICAL_RECORD_GUARD_PATTERN.search(raw_value):
            continue
        add_candidate(
            key="clinical_record_number",
            value=raw_value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=match.group(0),
        )

    for match in _MICROCHIP_OCR_PREFIX_WINDOW_PATTERN.finditer(raw_text):
        window = match.group(1) if isinstance(match.group(1), str) else ""
        digit_match = _MICROCHIP_DIGITS_PATTERN.search(window)
        if digit_match is None:
            continue
        add_candidate(
            key="microchip_id",
            value=digit_match.group(1),
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet=match.group(0),
        )

    for match in re.finditer(
        r"\b([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})\b", raw_text
    ):
        snippet = raw_text[
            max(0, match.start() - 36) : min(len(raw_text), match.end() + 36)
        ]
        add_candidate(
            key="document_date",
            value=match.group(1),
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet=snippet,
        )

    for date_candidate in _extract_date_candidates_with_classification(raw_text):
        add_candidate(
            key=str(date_candidate["target_key"]),
            value=str(date_candidate["value"]),
            confidence=float(date_candidate["confidence"]),
            snippet=str(date_candidate["snippet"]),
            page=1,
            anchor=(
                str(date_candidate["anchor"]) if date_candidate.get("anchor") else None
            ),
            anchor_priority=int(date_candidate["anchor_priority"]),
            target_reason=str(date_candidate["target_reason"]),
        )

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    species_keywords = {
        "canino": "canino",
        "canina": "canino",
        "perro": "canino",
        "felino": "felino",
        "felina": "felino",
        "gato": "felino",
    }
    breed_keywords = (
        "labrador",
        "retriever",
        "bulldog",
        "pastor",
        "yorkshire",
        "mestiz",
        "beagle",
        "caniche",
    )
    stopwords_upper = {
        "DATOS",
        "CLIENTE",
        "NOMBRE",
        "ESPECIE",
        "RAZA",
        "SEXO",
        "CHIP",
        "HISTORIAL",
        "VISITA",
    }

    for line in lines:
        if ":" in line:
            header, value = line.split(":", 1)
        elif "-" in line:
            header, value = line.split("-", 1)
        else:
            header, value = "", ""

        lower_header = header.casefold()
        if value:
            if any(token in lower_header for token in ("diagn", "impresi")):
                add_candidate(
                    key="diagnosis",
                    value=value,
                    confidence=COVERAGE_CONFIDENCE_LABEL,
                    snippet=line,
                )
            if any(
                token in lower_header
                for token in ("trat", "medic", "prescrip", "receta")
            ):
                add_candidate(
                    key="medication",
                    value=value,
                    confidence=COVERAGE_CONFIDENCE_LABEL,
                    snippet=line,
                )
                add_candidate(
                    key="treatment_plan", value=value, confidence=0.7, snippet=line
                )
            if any(
                token in lower_header for token in ("proced", "interv", "cirug", "quir")
            ):
                add_candidate(
                    key="procedure",
                    value=value,
                    confidence=COVERAGE_CONFIDENCE_LABEL,
                    snippet=line,
                )
            if any(token in lower_header for token in ("sintom", "symptom")):
                add_candidate(
                    key="symptoms",
                    value=value,
                    confidence=COVERAGE_CONFIDENCE_LABEL,
                    snippet=line,
                )
            if any(token in lower_header for token in ("vacun", "vaccin")):
                add_candidate(
                    key="vaccinations",
                    value=value,
                    confidence=COVERAGE_CONFIDENCE_LABEL,
                    snippet=line,
                )
            if any(token in lower_header for token in ("laboratorio", "analit", "lab")):
                add_candidate(
                    key="lab_result",
                    value=value,
                    confidence=COVERAGE_CONFIDENCE_LABEL,
                    snippet=line,
                )
            if any(
                token in lower_header
                for token in ("radiograf", "ecograf", "imagen", "tac", "rm")
            ):
                add_candidate(
                    key="imaging",
                    value=value,
                    confidence=COVERAGE_CONFIDENCE_LABEL,
                    snippet=line,
                )
            if any(token in lower_header for token in ("linea", "concepto", "item")):
                add_candidate(
                    key="line_item",
                    value=value,
                    confidence=COVERAGE_CONFIDENCE_LABEL,
                    snippet=line,
                )

        lower_line = line.casefold()
        if any(token in lower_line for token in ("macho", "hembra", "male", "female")):
            if "macho" in lower_line or "male" in lower_line:
                add_candidate(
                    key="sex",
                    value="macho",
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=line,
                )
            if "hembra" in lower_line or "female" in lower_line:
                add_candidate(
                    key="sex",
                    value="hembra",
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=line,
                )

        if (
            any(token in lower_line for token in ("diagn", "impresi"))
            and ":" not in line
        ):
            add_candidate(key="diagnosis", value=line, confidence=0.64, snippet=line)
        if any(
            token in lower_line
            for token in (
                "amoxic",
                "clavul",
                "predni",
                "omepra",
                "antibiot",
                "mg",
                "cada",
            )
        ):
            add_candidate(
                key="medication",
                value=line,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )
        if any(
            token in lower_line
            for token in ("cirug", "proced", "sut", "cura", "ecograf", "radiograf")
        ):
            add_candidate(
                key="procedure",
                value=line,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )

        timeline_match = re.match(r"^-\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4})\s*-", line)
        if timeline_match:
            add_candidate(
                key="document_date",
                value=timeline_match.group(1),
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
                target_reason="timeline_unanchored",
            )

    for index, line in enumerate(lines):
        lower_line = line.casefold()
        normalized_single = _WHITESPACE_PATTERN.sub(" ", lower_line).strip()

        if normalized_single in species_keywords:
            add_candidate(
                key="species",
                value=species_keywords[normalized_single],
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )

        if any(keyword in lower_line for keyword in breed_keywords) and len(line) <= 80:
            add_candidate(
                key="breed",
                value=line,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )

        if normalized_single in {"m", "macho", "male", "h", "hembra", "female"}:
            window = " ".join(
                lines[max(0, index - 1) : min(len(lines), index + 2)]
            ).casefold()
            if "sexo" in window:
                sex_value = (
                    "macho" if normalized_single in {"m", "macho", "male"} else "hembra"
                )
                add_candidate(
                    key="sex",
                    value=sex_value,
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=" ".join(
                        lines[max(0, index - 1) : min(len(lines), index + 2)]
                    ),
                )

        if (
            line.isupper()
            and 2 < len(line) <= 30
            and line not in stopwords_upper
            and " " not in line
        ):
            nearby = " ".join(lines[index : min(len(lines), index + 4)]).casefold()
            if any(
                token in nearby
                for token in ("canino", "felino", "raza", "chip", "especie")
            ):
                add_candidate(
                    key="pet_name",
                    value=line.title(),
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=line,
                )

    if (
        compact_text
        and "language" not in candidates
        and any(
            token in compact_text.casefold()
            for token in ("paciente", "diagnost", "tratamiento")
        )
    ):
        add_candidate(
            key="language",
            value="es",
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet="Heuristic language inference based on Spanish clinical tokens",
            page=None,
        )

    return dict(candidates)


def _extract_date_candidates_with_classification(
    raw_text: str,
) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    lower_text = raw_text.casefold()

    for match in _DATE_CANDIDATE_PATTERN.finditer(raw_text):
        value = match.group(1)
        start = max(0, match.start() - 70)
        end = min(len(raw_text), match.end() + 70)
        snippet = _WHITESPACE_PATTERN.sub(" ", raw_text[start:end]).strip()
        context = lower_text[start:end]

        chosen_key = "document_date"
        chosen_anchor = "fallback"
        chosen_priority = 1
        chosen_reason = "fallback_document_date"

        for key, anchors in _DATE_TARGET_ANCHORS.items():
            matched_anchor = next((anchor for anchor in anchors if anchor in context), None)
            if matched_anchor is None:
                continue

            priority = _DATE_TARGET_PRIORITY.get(key, 1)
            if priority > chosen_priority:
                chosen_key = key
                chosen_anchor = matched_anchor
                chosen_priority = priority
                chosen_reason = f"anchor:{matched_anchor}"

        confidence = (
            COVERAGE_CONFIDENCE_LABEL
            if chosen_priority > 1
            else COVERAGE_CONFIDENCE_FALLBACK
        )
        candidates.append(
            {
                "target_key": chosen_key,
                "value": value,
                "confidence": confidence,
                "snippet": snippet,
                "anchor": chosen_anchor,
                "anchor_priority": chosen_priority,
                "target_reason": chosen_reason,
            }
        )

    return candidates


def _map_candidates_to_global_schema(
    candidate_bundle: Mapping[str, list[dict[str, object]]]
) -> tuple[dict[str, object], dict[str, list[dict[str, object]]]]:
    mapped: dict[str, object] = {}
    evidence_map: dict[str, list[dict[str, object]]] = {}

    for key in GLOBAL_SCHEMA_V0_KEYS:
        key_candidates = sorted(
            candidate_bundle.get(key, []),
            key=lambda item: _candidate_sort_key(item, key),
            reverse=True,
        )

        if key in REPEATABLE_KEYS_V0:
            selected = key_candidates[:3]
            mapped[key] = [
                str(item.get("value", "")).strip()
                for item in selected
                if str(item.get("value", "")).strip()
            ]
            evidence_map[key] = selected
            continue

        if key_candidates:
            top = key_candidates[0]
            mapped[key] = str(top.get("value", "")).strip() or None
            evidence_map[key] = [top]
        else:
            mapped[key] = None
            evidence_map[key] = []

    return mapped, evidence_map


def _candidate_sort_key(item: dict[str, object], key: str) -> tuple[float, float]:
    confidence = float(item.get("confidence", 0.0))
    if key in DATE_TARGET_KEYS:
        return float(item.get("anchor_priority", 0)), confidence

    if key == "microchip_id":
        raw_value = str(item.get("value", "")).strip()
        if _MICROCHIP_DIGITS_PATTERN.fullmatch(raw_value):
            return 2.0, confidence
        if _MICROCHIP_DIGITS_PATTERN.search(raw_value):
            return 1.0, confidence
        return 0.0, confidence

    return 0.0, confidence


def _build_date_selection_debug(
    evidence_map: Mapping[str, list[dict[str, object]]],
) -> dict[str, dict[str, object] | None]:
    payload: dict[str, dict[str, object] | None] = {}
    for key in ("visit_date", "document_date", "admission_date", "discharge_date"):
        candidates = evidence_map.get(key, [])
        if not candidates:
            payload[key] = None
            continue
        top = candidates[0]
        payload[key] = {
            "anchor": top.get("anchor"),
            "anchor_priority": top.get("anchor_priority", 0),
            "target_reason": top.get("target_reason"),
        }
    return payload


def _build_mvp_coverage_debug_summary(
    *,
    raw_text: str,
    normalized_values: Mapping[str, object],
    candidate_bundle: Mapping[str, list[dict[str, object]]],
    evidence_map: Mapping[str, list[dict[str, object]]],
) -> dict[str, dict[str, object] | None]:
    summary: dict[str, dict[str, object] | None] = {}
    for key in MVP_COVERAGE_DEBUG_KEYS:
        raw_value = normalized_values.get(key)
        accepted = (
            isinstance(raw_value, str)
            and bool(raw_value.strip())
        ) or (
            isinstance(raw_value, list)
            and len(raw_value) > 0
        )

        key_candidates = sorted(
            candidate_bundle.get(key, []),
            key=lambda item: _candidate_sort_key(item, key),
            reverse=True,
        )
        top1 = key_candidates[0] if key_candidates else None
        top1_value = (
            str(top1.get("value", "")).strip() if isinstance(top1, dict) else None
        )
        top1_conf = (
            float(top1.get("confidence", 0.0)) if isinstance(top1, dict) else None
        )

        line_number: int | None = None
        if accepted:
            key_evidence = evidence_map.get(key, [])
            top_evidence = key_evidence[0] if key_evidence else None
            evidence_payload = (
                top_evidence.get("evidence")
                if isinstance(top_evidence, dict)
                else None
            )
            snippet = (
                evidence_payload.get("snippet")
                if isinstance(evidence_payload, dict)
                else None
            )
            if isinstance(snippet, str) and snippet.strip():
                line_number = _find_line_number_for_snippet(raw_text, snippet)

        summary[key] = {
            "status": "accepted" if accepted else "missing",
            "top1": top1_value,
            "confidence": round(top1_conf, 2) if isinstance(top1_conf, float) else None,
            "line_number": line_number,
        }

    return summary


def _find_line_number_for_snippet(raw_text: str, snippet: str) -> int | None:
    lines = raw_text.splitlines()
    compact_snippet = _WHITESPACE_PATTERN.sub(" ", snippet).strip().casefold()
    if not compact_snippet:
        return None

    for index, line in enumerate(lines, start=1):
        compact_line = _WHITESPACE_PATTERN.sub(" ", line).strip().casefold()
        if not compact_line:
            continue
        if compact_snippet in compact_line or compact_line in compact_snippet:
            return index

    return None


def _build_structured_fields_from_global_schema(
    *,
    normalized_values: Mapping[str, object],
    evidence_map: Mapping[str, list[dict[str, object]]],
) -> list[dict[str, object]]:
    fields: list[dict[str, object]] = []

    for key in GLOBAL_SCHEMA_V0_KEYS:
        value = normalized_values.get(key)
        key_evidence = evidence_map.get(key, [])

        if key in REPEATABLE_KEYS_V0:
            if not isinstance(value, list):
                continue
            for index, item in enumerate(value):
                if not isinstance(item, str) or not item:
                    continue
                candidate = key_evidence[index] if index < len(key_evidence) else None
                evidence = (
                    candidate.get("evidence") if isinstance(candidate, dict) else None
                )
                confidence = (
                    float(candidate.get("confidence", 0.65))
                    if isinstance(candidate, dict)
                    else 0.65
                )
                fields.append(
                    _build_structured_field(
                        key=key,
                        value=item,
                        confidence=confidence,
                        snippet=(
                            evidence.get("snippet")
                            if isinstance(evidence, dict)
                            else item
                        ),
                        value_type=VALUE_TYPE_BY_KEY_V0.get(key, "string"),
                        page=(
                            evidence.get("page") if isinstance(evidence, dict) else None
                        ),
                    )
                )
            continue

        if not isinstance(value, str) or not value:
            continue
        candidate = key_evidence[0] if key_evidence else None
        evidence = candidate.get("evidence") if isinstance(candidate, dict) else None
        confidence = (
            float(candidate.get("confidence", 0.65))
            if isinstance(candidate, dict)
            else 0.65
        )
        fields.append(
            _build_structured_field(
                key=key,
                value=value,
                confidence=confidence,
                snippet=(
                    evidence.get("snippet") if isinstance(evidence, dict) else value
                ),
                value_type=VALUE_TYPE_BY_KEY_V0.get(key, "string"),
                page=(evidence.get("page") if isinstance(evidence, dict) else None),
            )
        )

    return fields


def _build_structured_field(
    *,
    key: str,
    value: str,
    confidence: float,
    snippet: str,
    value_type: str,
    page: int | None,
) -> dict[str, object]:
    normalized_snippet = snippet.strip()
    if len(normalized_snippet) > 180:
        normalized_snippet = normalized_snippet[:177].rstrip() + "..."
    return {
        "field_id": str(uuid4()),
        "key": key,
        "value": value,
        "value_type": value_type,
        "confidence": round(min(max(confidence, 0.0), 1.0), 2),
        "is_critical": key in CRITICAL_KEYS_V0,
        "origin": "machine",
        "evidence": {
            "page": page,
            "snippet": normalized_snippet,
        },
    }


def _append_step_status(
    *,
    repository: DocumentRepository,
    run_id: str,
    step_name: StepName,
    step_status: StepStatus,
    attempt: int,
    started_at: str | None,
    ended_at: str | None,
    error_code: str | None,
    details: dict[str, object] | None = None,
) -> None:
    """Persist an append-only STEP_STATUS artifact for a run."""

    repository.append_artifact(
        run_id=run_id,
        artifact_type="STEP_STATUS",
        payload={
            "step_name": step_name.value,
            "step_status": step_status.value,
            "attempt": attempt,
            "started_at": started_at,
            "ended_at": ended_at,
            "error_code": error_code,
            "details": details,
        },
        created_at=_default_now_iso(),
    )


def _extract_pdf_text(file_path: Path) -> str:
    text, _ = _extract_pdf_text_with_extractor(file_path)
    return text


def _extract_pdf_text_with_extractor(file_path: Path) -> tuple[str, str]:
    forced = os.getenv(PDF_EXTRACTOR_FORCE_ENV, "").strip().lower()
    if forced not in ("", "auto", "fitz", "fallback"):
        logger.warning(
            "Unknown %s value '%s'; using auto mode",
            PDF_EXTRACTOR_FORCE_ENV,
            forced,
        )
        forced = "auto"

    if forced == "fallback":
        return _extract_pdf_text_without_external_dependencies(file_path), "fallback"

    if forced == "fitz":
        try:
            return _extract_pdf_text_with_fitz(file_path), "fitz"
        except ImportError as exc:
            raise ProcessingError("EXTRACTION_FAILED") from exc

    try:
        return _extract_pdf_text_with_fitz(file_path), "fitz"
    except ImportError:
        return _extract_pdf_text_without_external_dependencies(file_path), "fallback"


def _extract_pdf_text_with_fitz(file_path: Path) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise ImportError("PyMuPDF is not installed") from exc

    try:
        with fitz.open(file_path) as document:
            parts = [page.get_text("text") for page in document]
    except Exception as exc:  # pragma: no cover - defensive
        raise ProcessingError("EXTRACTION_FAILED") from exc

    return "\n".join(parts)


_PDF_STREAM_PATTERN = re.compile(rb"stream\r?\n(.*?)\r?\nendstream", re.DOTALL)
_WHITESPACE_PATTERN = re.compile(r"\s+")
_OBJECT_PATTERN = re.compile(rb"(\d+)\s+(\d+)\s+obj(.*?)endobj", re.DOTALL)
_HEX_STRING_PATTERN = re.compile(rb"<([0-9A-Fa-f\s]+)>")
_HEX_PAIR_PATTERN = re.compile(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>")
_BFRANGE_ARRAY_ENTRY_PATTERN = re.compile(rb"<([0-9A-Fa-f]+)>")
_FONT_SELECTION_PATTERN = re.compile(rb"/([^\s/<>\[\]()]+)\s+[-+]?\d+(?:\.\d+)?\s+Tf")
_FONT_DICT_INLINE_PATTERN = re.compile(rb"/Font\s*<<(.*?)>>", re.DOTALL)
_FONT_DICT_REF_PATTERN = re.compile(rb"/Font\s+(\d+)\s+0\s+R")
_FONT_ENTRY_PATTERN = re.compile(rb"/([^\s/<>\[\]()]+)\s+(\d+)\s+0\s+R")
_TOUNICODE_REF_PATTERN = re.compile(rb"/ToUnicode\s+(\d+)\s+0\s+R")
_PAGE_TYPE_PATTERN = re.compile(rb"/Type\s*/Page\b")
_PAGE_CONTENTS_ARRAY_PATTERN = re.compile(rb"/Contents\s*\[(.*?)\]", re.DOTALL)
_PAGE_CONTENTS_SINGLE_PATTERN = re.compile(rb"/Contents\s+(\d+)\s+\d+\s+R")
_PAGE_RESOURCES_REF_PATTERN = re.compile(rb"/Resources\s+(\d+)\s+\d+\s+R")
_PAGE_RESOURCES_INLINE_PATTERN = re.compile(rb"/Resources\s*<<(.*?)>>", re.DOTALL)
_OBJECT_REF_PATTERN = re.compile(rb"(\d+)\s+\d+\s+R")

MAX_CONTENT_STREAM_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHUNKS = 20000
MAX_TOKENS_PER_STREAM = 25000
MAX_ARRAY_ITEMS = 3000
MAX_SINGLE_STREAM_BYTES = 1 * 1024 * 1024
MAX_EXTRACTION_SECONDS = 20.0
MAX_CMAP_STREAM_BYTES = 256 * 1024
_ACTIVE_EXTRACTION_DEADLINE: float | None = None


@dataclass(frozen=True, slots=True)
class PdfCMap:
    codepoints: dict[int, str]
    code_lengths: tuple[int, ...]


def _extract_pdf_text_without_external_dependencies(file_path: Path) -> str:
    started_at = time.monotonic()
    global _ACTIVE_EXTRACTION_DEADLINE
    _ACTIVE_EXTRACTION_DEADLINE = started_at + MAX_EXTRACTION_SECONDS

    def _timed_out() -> bool:
        return (time.monotonic() - started_at) > MAX_EXTRACTION_SECONDS

    try:
        try:
            pdf_bytes = file_path.read_bytes()
        except OSError as exc:  # pragma: no cover - defensive
            raise ProcessingError("EXTRACTION_FAILED") from exc

        objects = _parse_pdf_objects(pdf_bytes)
        cmap_by_object = _extract_cmaps_by_object(objects)
        page_streams = _collect_page_content_streams(
            objects=objects, cmap_by_object=cmap_by_object
        )
        text_chunks: list[str] = []
        total_bytes = 0
        for chunk, font_to_cmap in page_streams:
            if _timed_out():
                break
            if not chunk:
                continue
            if len(chunk) > MAX_SINGLE_STREAM_BYTES:
                continue
            total_bytes += len(chunk)
            if total_bytes > MAX_CONTENT_STREAM_BYTES:
                break
            fallback_cmaps = list(font_to_cmap.values())
            text_chunks.extend(
                _extract_text_chunks_from_content_stream(
                    chunk=chunk,
                    font_to_cmap=font_to_cmap,
                    fallback_cmaps=fallback_cmaps,
                )
            )
            if len(text_chunks) > MAX_TEXT_CHUNKS:
                break

        # Last-resort fallback only when page stream discovery fails.
        if not page_streams:
            for match in _PDF_STREAM_PATTERN.finditer(pdf_bytes):
                if _timed_out():
                    break
                stream = match.group(1)
                inflated = _inflate_pdf_stream(stream)
                if inflated is None:
                    continue
                if b"BT" not in inflated or b"ET" not in inflated:
                    continue
                text_chunks.extend(
                    _extract_text_chunks_from_content_stream(
                        chunk=inflated,
                        font_to_cmap={},
                        fallback_cmaps=[],
                    )
                )
                if len(text_chunks) > MAX_TEXT_CHUNKS:
                    break

        sanitized_chunks = _sanitize_text_chunks(text_chunks)
        return _stitch_text_chunks(sanitized_chunks)
    finally:
        _ACTIVE_EXTRACTION_DEADLINE = None


def _deadline_exceeded() -> bool:
    if _ACTIVE_EXTRACTION_DEADLINE is None:
        return False
    return time.monotonic() > _ACTIVE_EXTRACTION_DEADLINE


def _inflate_pdf_stream(stream: bytes) -> bytes | None:
    try:
        return zlib.decompress(stream)
    except zlib.error:
        return None


def _parse_tounicode_cmap(chunk: bytes) -> PdfCMap | None:
    if b"begincmap" not in chunk:
        return None

    code_lengths: set[int] = set()
    for codespace_match in re.finditer(
        rb"\d+\s+begincodespacerange(.*?)endcodespacerange",
        chunk,
        re.DOTALL,
    ):
        for start_hex, _ in _HEX_PAIR_PATTERN.findall(codespace_match.group(1)):
            code_lengths.add(max(1, len(start_hex) // 2))
    if not code_lengths:
        code_lengths.add(1)

    mapping: dict[int, str] = {}

    for bfchar_match in re.finditer(
        rb"\d+\s+beginbfchar(.*?)endbfchar",
        chunk,
        re.DOTALL,
    ):
        for src_hex, dst_hex in _HEX_PAIR_PATTERN.findall(bfchar_match.group(1)):
            src = int(src_hex, 16)
            mapping[src] = _decode_unicode_hex(dst_hex)

    for bfrange_match in re.finditer(
        rb"\d+\s+beginbfrange(.*?)endbfrange",
        chunk,
        re.DOTALL,
    ):
        for line in bfrange_match.group(1).splitlines():
            line = line.strip()
            if not line:
                continue

            pair_match = re.match(
                rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>",
                line,
            )
            if pair_match:
                start_hex, end_hex, dst_start_hex = pair_match.groups()
                start = int(start_hex, 16)
                end = int(end_hex, 16)
                dst_start = int(dst_start_hex, 16)
                for offset, code in enumerate(range(start, end + 1)):
                    mapping[code] = _decode_unicode_hex(
                        f"{dst_start + offset:0{len(dst_start_hex)}X}".encode("ascii")
                    )
                continue

            array_match = re.match(
                rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*)\]",
                line,
            )
            if not array_match:
                continue
            start_hex, end_hex, destinations = array_match.groups()
            start = int(start_hex, 16)
            end = int(end_hex, 16)
            destination_values = _BFRANGE_ARRAY_ENTRY_PATTERN.findall(destinations)
            for offset, code in enumerate(range(start, end + 1)):
                if offset >= len(destination_values):
                    break
                mapping[code] = _decode_unicode_hex(destination_values[offset])

    if not mapping:
        return None
    return PdfCMap(
        codepoints=mapping,
        code_lengths=tuple(sorted(code_lengths, reverse=True)),
    )


def _parse_pdf_objects(pdf_bytes: bytes) -> dict[int, bytes]:
    objects: dict[int, bytes] = {}
    for match in _OBJECT_PATTERN.finditer(pdf_bytes):
        object_id = int(match.group(1))
        objects[object_id] = match.group(3)
    return objects


def _extract_cmaps_by_object(objects: dict[int, bytes]) -> dict[int, PdfCMap]:
    cmaps: dict[int, PdfCMap] = {}
    for object_id, object_payload in objects.items():
        if _deadline_exceeded():
            break
        stream = _extract_object_stream(object_payload, max_bytes=MAX_CMAP_STREAM_BYTES)
        if stream is None:
            continue
        cmap = _parse_tounicode_cmap(stream)
        if cmap is not None:
            cmaps[object_id] = cmap
    return cmaps


def _collect_page_content_streams(
    *,
    objects: dict[int, bytes],
    cmap_by_object: dict[int, PdfCMap],
) -> list[tuple[bytes, dict[str, PdfCMap]]]:
    page_streams: list[tuple[bytes, dict[str, PdfCMap]]] = []
    for page_payload in objects.values():
        if not _PAGE_TYPE_PATTERN.search(page_payload):
            continue

        font_to_cmap = _extract_font_to_cmap_for_page(
            page_payload=page_payload,
            objects=objects,
            cmap_by_object=cmap_by_object,
        )
        for content_object_id in _extract_page_content_object_ids(page_payload):
            content_payload = objects.get(content_object_id)
            if content_payload is None:
                continue
            stream = _extract_object_stream(content_payload)
            if stream is None:
                continue
            page_streams.append((stream, font_to_cmap))
    return page_streams


def _extract_page_content_object_ids(page_payload: bytes) -> list[int]:
    contents_ids: list[int] = []
    array_match = _PAGE_CONTENTS_ARRAY_PATTERN.search(page_payload)
    if array_match:
        refs = _OBJECT_REF_PATTERN.findall(array_match.group(1))
        contents_ids.extend(int(ref) for ref in refs)
        return contents_ids

    single_match = _PAGE_CONTENTS_SINGLE_PATTERN.search(page_payload)
    if single_match:
        contents_ids.append(int(single_match.group(1)))
    return contents_ids


def _extract_font_to_cmap_for_page(
    *,
    page_payload: bytes,
    objects: dict[int, bytes],
    cmap_by_object: dict[int, PdfCMap],
) -> dict[str, PdfCMap]:
    resource_payload = _resolve_page_resources(
        page_payload=page_payload, objects=objects
    )
    if resource_payload is None:
        return {}
    return _build_font_to_cmap_from_page_resources(
        resource_payload=resource_payload,
        objects=objects,
        cmap_by_object=cmap_by_object,
    )


def _resolve_page_resources(
    *,
    page_payload: bytes,
    objects: dict[int, bytes],
) -> bytes | None:
    inline_match = _PAGE_RESOURCES_INLINE_PATTERN.search(page_payload)
    if inline_match:
        return inline_match.group(1)

    ref_match = _PAGE_RESOURCES_REF_PATTERN.search(page_payload)
    if ref_match is None:
        return None
    return objects.get(int(ref_match.group(1)))


def _extract_object_stream(
    object_payload: bytes, max_bytes: int | None = None
) -> bytes | None:
    match = re.search(rb"stream\r?\n(.*?)\r?\nendstream", object_payload, re.DOTALL)
    if match is None:
        return None
    raw_stream = match.group(1)
    if max_bytes is not None and len(raw_stream) > max_bytes:
        return None
    inflated = _inflate_pdf_stream(raw_stream)
    if inflated is not None:
        if max_bytes is not None and len(inflated) > max_bytes:
            return None
        return inflated
    if _looks_textual_bytes(raw_stream) and b"BT" in raw_stream and b"ET" in raw_stream:
        return raw_stream
    return None


def _build_font_to_cmap_from_page_resources(
    *,
    resource_payload: bytes,
    objects: dict[int, bytes],
    cmap_by_object: dict[int, PdfCMap],
) -> dict[str, PdfCMap]:
    font_name_to_font_object = _extract_font_entries_from_resource_payload(
        resource_payload=resource_payload,
        objects=objects,
    )

    mapping: dict[str, PdfCMap] = {}
    for font_name, font_object_id in font_name_to_font_object.items():
        font_payload = objects.get(font_object_id)
        if font_payload is None:
            continue
        to_unicode_ref = _TOUNICODE_REF_PATTERN.search(font_payload)
        if to_unicode_ref is None:
            continue
        cmap = cmap_by_object.get(int(to_unicode_ref.group(1)))
        if cmap is not None:
            mapping[font_name] = cmap
    return mapping


def _extract_font_entries_from_resource_payload(
    *,
    resource_payload: bytes,
    objects: dict[int, bytes],
) -> dict[str, int]:
    font_name_to_font_object: dict[str, int] = {}

    for inline_dict in _FONT_DICT_INLINE_PATTERN.findall(resource_payload):
        for font_name, font_object in _FONT_ENTRY_PATTERN.findall(inline_dict):
            parsed_name = font_name.decode("ascii", "ignore")
            if not parsed_name:
                continue
            font_name_to_font_object[parsed_name] = int(font_object)

    for font_dict_object in _FONT_DICT_REF_PATTERN.findall(resource_payload):
        referenced = objects.get(int(font_dict_object))
        if referenced is None:
            continue
        for font_name, font_object in _FONT_ENTRY_PATTERN.findall(referenced):
            parsed_name = font_name.decode("ascii", "ignore")
            if not parsed_name:
                continue
            font_name_to_font_object[parsed_name] = int(font_object)

    return font_name_to_font_object


def _extract_font_events(chunk: bytes) -> list[tuple[int, str]]:
    events: list[tuple[int, str]] = []
    for match in _FONT_SELECTION_PATTERN.finditer(chunk):
        events.append((match.start(), match.group(1).decode("ascii", "ignore")))
    return events


def _active_font_name(position: int, font_events: list[tuple[int, str]]) -> str | None:
    active: str | None = None
    for event_position, font_name in font_events:
        if event_position > position:
            break
        active = font_name
    return active


def _decode_unicode_hex(hex_value: bytes) -> str:
    if len(hex_value) % 2 == 1:
        hex_value = b"0" + hex_value
    raw = bytes.fromhex(hex_value.decode("ascii"))
    if len(raw) % 2 == 0 and len(raw) >= 2:
        try:
            return raw.decode("utf-16-be")
        except UnicodeDecodeError:
            pass
    return raw.decode("latin-1", errors="ignore")


def _extract_pdf_text_tokens(chunk: bytes) -> list[tuple[int, bytes]]:
    tokens: list[tuple[int, bytes]] = []

    for hex_match in _HEX_STRING_PATTERN.finditer(chunk):
        compact = re.sub(rb"\s+", b"", hex_match.group(1))
        if not compact:
            continue
        if len(compact) % 2 == 1:
            compact = b"0" + compact
        try:
            tokens.append((hex_match.start(), bytes.fromhex(compact.decode("ascii"))))
        except ValueError:
            continue

    index = 0
    length = len(chunk)
    while index < length:
        if chunk[index] != 40:  # "("
            index += 1
            continue
        start_index = index
        parsed, next_index = _parse_pdf_literal_string_bytes(chunk, index + 1)
        if parsed:
            tokens.append((start_index, parsed))
        index = next_index

    tokens.sort(key=lambda item: item[0])
    return tokens


def _extract_text_chunks_from_content_stream(
    *,
    chunk: bytes,
    font_to_cmap: dict[str, PdfCMap],
    fallback_cmaps: list[PdfCMap],
) -> list[str]:
    extracted: list[str] = []
    in_text_object = False
    active_font: str | None = None
    active_cmap: PdfCMap | None = None
    operand_stack: list[object] = []

    for token in _tokenize_pdf_content(chunk):
        if isinstance(token, str):
            if token.startswith("/"):
                operand_stack.append(token)
                continue
            if token == "BT":
                in_text_object = True
                operand_stack.clear()
                continue
            if token == "ET":
                in_text_object = False
                active_font = None
                operand_stack.clear()
                continue

            if not in_text_object:
                operand_stack.clear()
                continue

            if token == "Tf":
                if len(operand_stack) >= 2 and isinstance(operand_stack[-2], str):
                    font_name = operand_stack[-2]
                    if font_name.startswith("/"):
                        active_font = font_name[1:]
                        active_cmap = font_to_cmap.get(active_font)
                operand_stack.clear()
                continue

            if token == "Tj":
                if operand_stack and isinstance(operand_stack[-1], bytes):
                    extracted_token, selected_cmap = _decode_token_for_font(
                        token_bytes=operand_stack[-1],
                        active_cmap=active_cmap,
                        active_font=active_font,
                        font_to_cmap=font_to_cmap,
                        fallback_cmaps=fallback_cmaps,
                    )
                    if selected_cmap is not None and active_cmap is None:
                        active_cmap = selected_cmap
                    if extracted_token:
                        extracted.append(extracted_token)
                operand_stack.clear()
                continue

            if token == "TJ":
                if operand_stack and isinstance(operand_stack[-1], list):
                    decoded_array, selected_cmap = _decode_tj_array_for_font(
                        array_items=operand_stack[-1],
                        active_cmap=active_cmap,
                        active_font=active_font,
                        font_to_cmap=font_to_cmap,
                        fallback_cmaps=fallback_cmaps,
                    )
                    if selected_cmap is not None:
                        active_cmap = selected_cmap
                    if decoded_array:
                        extracted.append(decoded_array)
                operand_stack.clear()
                continue

            # Unknown operator inside a text object.
            operand_stack.clear()
            continue

        operand_stack.append(token)

    return extracted


def _decode_token_for_font(
    *,
    token_bytes: bytes,
    active_cmap: PdfCMap | None,
    active_font: str | None,
    font_to_cmap: dict[str, PdfCMap],
    fallback_cmaps: list[PdfCMap],
) -> tuple[str, PdfCMap | None]:
    if active_cmap is not None:
        return _decode_pdf_text_token(token_bytes, [active_cmap]), active_cmap

    primary = font_to_cmap.get(active_font) if active_font else None
    if primary is not None:
        return _decode_pdf_text_token(token_bytes, [primary]), primary

    if not fallback_cmaps:
        return _decode_pdf_text_token(token_bytes, []), None

    best_text = ""
    best_cmap: PdfCMap | None = None
    best_score = float("-inf")
    for cmap in fallback_cmaps[:4]:
        decoded = _decode_pdf_text_token(token_bytes, [cmap])
        score = _decoded_text_score(_normalize_candidate_text(decoded))
        if score > best_score:
            best_score = score
            best_text = decoded
            best_cmap = cmap
    return best_text, best_cmap


def _decode_tj_array_for_font(
    *,
    array_items: list[object],
    active_cmap: PdfCMap | None,
    active_font: str | None,
    font_to_cmap: dict[str, PdfCMap],
    fallback_cmaps: list[PdfCMap],
) -> tuple[str, PdfCMap | None]:
    candidate_cmaps: list[PdfCMap]
    if active_cmap is not None:
        candidate_cmaps = [active_cmap]
    else:
        primary = font_to_cmap.get(active_font) if active_font else None
        if primary is not None:
            candidate_cmaps = [primary]
        else:
            candidate_cmaps = fallback_cmaps[:4]

    if not candidate_cmaps:
        return "", None

    best_text = ""
    best_cmap: PdfCMap | None = None
    best_score = float("-inf")
    for cmap in candidate_cmaps:
        parts: list[str] = []
        for item in array_items:
            if isinstance(item, bytes):
                decoded = _decode_pdf_text_token(item, [cmap])
                if decoded:
                    parts.append(decoded)
                continue
            # In TJ arrays, strongly negative spacing often indicates a visual gap.
            if isinstance(item, int | float) and item < -180:
                parts.append(" ")
        candidate_text = "".join(parts)
        score = _decoded_text_score(_normalize_candidate_text(candidate_text))
        if score > best_score:
            best_score = score
            best_text = candidate_text
            best_cmap = cmap

    return best_text, best_cmap


def _tokenize_pdf_content(content: bytes) -> list[object]:
    tokens: list[object] = []
    index = 0
    length = len(content)
    while index < length:
        if _deadline_exceeded():
            return tokens
        byte = content[index]

        if byte in b" \t\r\n\x00":
            index += 1
            continue
        if byte == 37:  # "%"
            while index < length and content[index] not in b"\r\n":
                index += 1
            continue
        if byte == 40:  # "("
            parsed, next_index = _parse_pdf_literal_string_bytes(content, index + 1)
            tokens.append(parsed)
            if len(tokens) >= MAX_TOKENS_PER_STREAM:
                return tokens
            index = next_index
            continue
        if byte == 91:  # "["
            parsed_array, next_index = _parse_pdf_array(content, index + 1)
            tokens.append(parsed_array)
            if len(tokens) >= MAX_TOKENS_PER_STREAM:
                return tokens
            index = next_index
            continue
        if byte == 60 and index + 1 < length and content[index + 1] != 60:  # "<...>"
            hex_end = content.find(b">", index + 1)
            if hex_end == -1:
                break
            compact = re.sub(rb"\s+", b"", content[index + 1 : hex_end])
            if compact:
                if len(compact) % 2 == 1:
                    compact = b"0" + compact
                try:
                    tokens.append(bytes.fromhex(compact.decode("ascii")))
                    if len(tokens) >= MAX_TOKENS_PER_STREAM:
                        return tokens
                except ValueError:
                    pass
            index = hex_end + 1
            continue

        start = index
        if byte == 47:  # "/"
            index += 1
            while index < length and content[index] not in b" \t\r\n[]()<>\x00":
                index += 1
            tokens.append(content[start:index].decode("latin-1", errors="ignore"))
            if len(tokens) >= MAX_TOKENS_PER_STREAM:
                return tokens
            continue

        while index < length and content[index] not in b" \t\r\n[]()<>/\x00":
            index += 1
        if start == index:
            index += 1
            continue
        word = content[start:index].decode("latin-1", errors="ignore")
        numeric = _parse_number_token(word)
        if numeric is not None:
            tokens.append(numeric)
        else:
            tokens.append(word)
        if len(tokens) >= MAX_TOKENS_PER_STREAM:
            return tokens

    return tokens


def _parse_pdf_array(content: bytes, index: int) -> tuple[list[object], int]:
    values: list[object] = []
    length = len(content)
    while index < length:
        if _deadline_exceeded():
            return values, length
        if len(values) >= MAX_ARRAY_ITEMS:
            return values, length
        byte = content[index]
        if byte in b" \t\r\n\x00":
            index += 1
            continue
        if byte == 93:  # "]"
            return values, index + 1
        if byte == 40:
            parsed, next_index = _parse_pdf_literal_string_bytes(content, index + 1)
            values.append(parsed)
            index = next_index
            continue
        if byte == 91:
            nested, next_index = _parse_pdf_array(content, index + 1)
            values.append(nested)
            index = next_index
            continue
        if byte == 60 and index + 1 < length and content[index + 1] != 60:
            hex_end = content.find(b">", index + 1)
            if hex_end == -1:
                return values, length
            compact = re.sub(rb"\s+", b"", content[index + 1 : hex_end])
            if compact:
                if len(compact) % 2 == 1:
                    compact = b"0" + compact
                try:
                    values.append(bytes.fromhex(compact.decode("ascii")))
                except ValueError:
                    pass
            index = hex_end + 1
            continue
        if byte == 47:
            start = index
            index += 1
            while index < length and content[index] not in b" \t\r\n[]()<>\x00":
                index += 1
            values.append(content[start:index].decode("latin-1", errors="ignore"))
            continue

        start = index
        while index < length and content[index] not in b" \t\r\n[]()<>/\x00":
            index += 1
        if start == index:
            index += 1
            continue
        word = content[start:index].decode("latin-1", errors="ignore")
        numeric = _parse_number_token(word)
        if numeric is not None:
            values.append(numeric)
        else:
            values.append(word)

    return values, length


def _parse_number_token(token: str) -> int | float | None:
    if not token:
        return None
    try:
        if "." in token:
            return float(token)
        return int(token)
    except ValueError:
        return None


def _decode_pdf_text_token(token: bytes, cmaps: list[PdfCMap | None]) -> str:
    # Keep a raw-byte fallback candidate to avoid forcing a bad cmap decode.
    candidates: list[str] = [token.decode("latin-1", errors="ignore")]
    for cmap in cmaps:
        if cmap is None:
            continue
        decoded = _decode_bytes_with_cmap(token, cmap)
        if decoded:
            candidates.append(decoded)

    best_text = ""
    best_score = float("-inf")
    for candidate in candidates:
        normalized = _normalize_candidate_text(candidate)
        if not normalized:
            continue
        score = _decoded_text_score(normalized)
        if score > best_score:
            best_score = score
            best_text = candidate
    return best_text


def _decode_bytes_with_cmap(token: bytes, cmap: PdfCMap) -> str:
    chars: list[str] = []
    index = 0
    length = len(token)
    while index < length:
        matched = False
        for code_length in cmap.code_lengths:
            if index + code_length > length:
                continue
            code = int.from_bytes(token[index : index + code_length], byteorder="big")
            mapped = cmap.codepoints.get(code)
            if mapped is None:
                continue
            chars.append(mapped)
            index += code_length
            matched = True
            break
        if matched:
            continue

        chars.append(bytes([token[index]]).decode("latin-1", errors="ignore"))
        index += 1

    return "".join(chars)


def _decoded_text_score(text: str) -> float:
    letters = sum(char.isalpha() for char in text)
    if letters == 0:
        return -100.0
    spaces = sum(char.isspace() for char in text)
    punctuation = sum((not char.isalnum()) and (not char.isspace()) for char in text)
    vowels = sum(char.lower() in "aeiouáéíóúü" for char in text if char.isalpha())
    length = len(text)
    vowel_ratio = vowels / letters
    punctuation_ratio = punctuation / length
    space_ratio = spaces / length
    return letters / length + vowel_ratio + space_ratio * 0.5 - punctuation_ratio * 1.5


def _sanitize_text_chunks(chunks: list[str]) -> list[str]:
    sanitized: list[str] = []
    for chunk in chunks:
        cleaned = chunk.replace("\x00", "").replace("\ufeff", "")
        normalized = _normalize_candidate_text(cleaned)
        if not normalized:
            continue
        if sanitized and normalized == sanitized[-1]:
            continue
        if len(normalized) <= 2 and normalized.isalpha():
            sanitized.append(normalized)
            continue

        if _is_readable_text_chunk(normalized):
            sanitized.append(normalized)
    return sanitized


def _is_readable_text_chunk(chunk: str) -> bool:
    if len(chunk) < 3:
        return False

    letters = sum(char.isalpha() for char in chunk)
    digits = sum(char.isdigit() for char in chunk)
    punctuation = sum((not char.isalnum()) and (not char.isspace()) for char in chunk)
    if letters == 0:
        return False

    length = len(chunk)
    letter_ratio = letters / length
    digit_ratio = digits / length
    punctuation_ratio = punctuation / length
    vowels = sum(char.lower() in "aeiouáéíóúü" for char in chunk if char.isalpha())
    vowel_ratio = vowels / letters if letters else 0
    uppercase_letters = sum(char.isupper() for char in chunk if char.isalpha())
    uppercase_ratio = uppercase_letters / letters if letters else 0
    score = _decoded_text_score(chunk)

    if score < 1.1:
        return False
    if letter_ratio < 0.45:
        return False
    if digit_ratio > 0.15:
        return False
    if punctuation_ratio > 0.25:
        return False
    if vowel_ratio < 0.25:
        return False
    if len(chunk) > 12 and uppercase_ratio > 0.8 and vowel_ratio < 0.4:
        return False
    if "'" in chunk and chunk.count("'") > max(1, len(chunk) // 60):
        return False
    if _max_consonant_run(chunk) > 5:
        return False
    return True


def _max_consonant_run(text: str) -> int:
    max_run = 0
    current_run = 0
    vowels = set("aeiouáéíóúüAEIOUÁÉÍÓÚÜ")
    for char in text:
        if not char.isalpha():
            current_run = 0
            continue
        if char in vowels:
            current_run = 0
            continue
        current_run += 1
        if current_run > max_run:
            max_run = current_run
    return max_run


def _stitch_text_chunks(chunks: list[str]) -> str:
    if not chunks:
        return ""

    first = chunks[0].strip()
    if not first:
        return ""

    pieces: list[str] = [first]
    tail = first[-80:]
    for chunk in chunks[1:]:
        current = chunk.strip()
        if not current:
            continue

        if _should_join_without_space(tail, current):
            pieces.append(current)
            tail = (tail + current)[-80:]
        else:
            if tail.endswith((" ", "\n")):
                pieces.append(current)
                tail = (tail + current)[-80:]
            else:
                pieces.append(" ")
                pieces.append(current)
                tail = (tail + " " + current)[-80:]

    stitched = "".join(pieces)
    stitched = re.sub(r"\s+([,.;:!?])", r"\1", stitched)
    stitched = re.sub(r"\(\s+", "(", stitched)
    stitched = re.sub(r"\s+\)", ")", stitched)
    stitched = _WHITESPACE_PATTERN.sub(" ", stitched).strip()
    return stitched


def _should_join_without_space(previous: str, current: str) -> bool:
    if not previous:
        return True
    prev_char = previous[-1]
    cur_char = current[0]

    if cur_char in ",.;:!?)]}":
        return True
    if prev_char in "([{":
        return True
    if prev_char == "-" or cur_char == "-":
        return True

    if prev_char.isalpha() and cur_char.isalpha():
        prev_word_match = re.search(r"([A-Za-zÀ-ÿ]+)$", previous)
        cur_word_match = re.match(r"([A-Za-zÀ-ÿ]+)", current)
        if prev_word_match and cur_word_match:
            prev_word = prev_word_match.group(1)
            cur_word = cur_word_match.group(1)
            if len(prev_word) <= 3 or len(cur_word) <= 2:
                return True
            if prev_word.isupper() and cur_word.isupper():
                return True
    return False


def _parse_pdf_literal_string(blob: bytes, index: int) -> tuple[str, int]:
    raw, next_index = _parse_pdf_literal_string_bytes(blob, index)
    return raw.decode("utf-8", errors="ignore"), next_index


def _parse_pdf_literal_string_bytes(blob: bytes, index: int) -> tuple[bytes, int]:
    result = bytearray()
    depth = 1
    length = len(blob)

    while index < length:
        if _deadline_exceeded():
            return bytes(result), length
        byte = blob[index]
        index += 1

        if byte == 92:  # "\"
            if index >= length:
                break
            escaped = blob[index]
            index += 1
            if escaped in (40, 41, 92):  # "(", ")", "\"
                result.append(escaped)
                continue
            if escaped == 110:  # n
                result.append(10)
                continue
            if escaped == 114:  # r
                result.append(13)
                continue
            if escaped == 116:  # t
                result.append(9)
                continue
            if escaped == 98:  # b
                result.append(8)
                continue
            if escaped == 102:  # f
                result.append(12)
                continue
            if 48 <= escaped <= 55:  # octal sequence
                oct_digits = bytearray([escaped])
                for _ in range(2):
                    if index < length and 48 <= blob[index] <= 55:
                        oct_digits.append(blob[index])
                        index += 1
                    else:
                        break
                result.append(int(oct_digits.decode("ascii"), 8))
                continue
            result.append(escaped)
            continue

        if byte == 40:  # "("
            depth += 1
            result.append(byte)
            continue
        if byte == 41:  # ")"
            depth -= 1
            if depth == 0:
                break
            result.append(byte)
            continue
        result.append(byte)

    return bytes(result), index


def _looks_textual_bytes(payload: bytes) -> bool:
    if not payload:
        return False
    printable = sum((32 <= byte <= 126) or byte in (9, 10, 13) for byte in payload)
    return printable / len(payload) >= 0.75


def _normalize_candidate_text(text: str) -> str:
    normalized = _WHITESPACE_PATTERN.sub(" ", text).strip()
    return normalized
