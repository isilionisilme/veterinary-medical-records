"""Processing subsystem modules extracted from processing_runner."""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from backend.app.domain.models import (
    ProcessingRunState,
)
from backend.app.ports.document_repository import DocumentRepository
from backend.app.ports.file_storage import FileStorage

from .orchestrator import _execute_run

logger = logging.getLogger(__name__)

PROCESSING_TICK_SECONDS = 0.5
PROCESSING_TIMEOUT_SECONDS = 120.0
MAX_RUNS_PER_TICK = 10
PDF_EXTRACTOR_FORCE_ENV = "PDF_EXTRACTOR_FORCE"
INTERPRETATION_DEBUG_INCLUDE_CANDIDATES_ENV = "VET_RECORDS_INCLUDE_INTERPRETATION_CANDIDATES"
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
DATE_TARGET_KEYS = frozenset({"visit_date", "document_date", "admission_date", "discharge_date"})
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
_OWNER_CONTEXT_PATTERN = re.compile(r"(?i)\b(?:propietari(?:o|a)|titular|dueñ(?:o|a)|owner)\b")
_OWNER_PATIENT_LABEL_PATTERN = re.compile(r"(?i)\bpaciente\b\s*[:\-]")
_VET_OR_CLINIC_CONTEXT_PATTERN = re.compile(
    r"(?i)\b(?:veterinari[oa]|vet\b|doctor(?:a)?\b|dra\.?\b|dr\.?\b|cl[ií]nica|hospital|centro\s+veterinario)\b"
)
_CLINICAL_RECORD_GUARD_PATTERN = re.compile(r"(?i)\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b")
NUMERIC_TYPES = (int, float)
REVIEW_SCHEMA_CONTRACT = "visit-grouped-canonical"


def _default_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _default_id() -> str:
    return str(uuid4())


@dataclass(frozen=True, slots=True)
class EnqueuedRun:
    run_id: str
    created_at: str
    state: ProcessingRunState


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
    return EnqueuedRun(run_id=run_id, created_at=created_at, state=ProcessingRunState.QUEUED)


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
        except TimeoutError:
            continue


async def _process_queued_runs(*, repository: DocumentRepository, storage: FileStorage) -> None:
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
