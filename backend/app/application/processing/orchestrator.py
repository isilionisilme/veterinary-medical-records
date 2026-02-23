"""Processing subsystem modules extracted from processing_runner."""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import UTC, datetime

from backend.app.application.extraction_observability import (
    build_extraction_snapshot_from_interpretation,
    persist_extraction_run_snapshot,
)
from backend.app.application.extraction_quality import evaluate_extracted_text_quality
from backend.app.config import (
    extraction_observability_enabled,
)
from backend.app.domain.models import (
    ProcessingRun,
    ProcessingRunState,
    StepName,
    StepStatus,
)
from backend.app.ports.document_repository import DocumentRepository
from backend.app.ports.file_storage import FileStorage

from . import pdf_extraction
from .interpretation import _build_interpretation_artifact

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
NUMERIC_TYPES = (int, float)
REVIEW_SCHEMA_CONTRACT = "visit-grouped-canonical"


def _default_now_iso() -> str:
    return datetime.now(UTC).isoformat()

class ProcessingError(Exception):
    """Processing failure with a failure_type mapping."""

    def __init__(self, failure_type: str) -> None:
        super().__init__(failure_type)
        self.failure_type = failure_type

class InterpretationBuildError(Exception):
    """Raised when interpretation cannot be built into the canonical schema shape."""

    def __init__(
        self, *, error_code: str, details: dict[str, object] | None = None
    ) -> None:
        super().__init__(error_code)
        self.error_code = error_code
        self.details = details

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
        pdf_extraction._extract_pdf_text_with_extractor, file_path
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
            repository=repository,
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
