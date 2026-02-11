"""In-process processing scheduler and run execution."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

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

    repository.complete_run(
        run_id=run.run_id,
        state=ProcessingRunState.COMPLETED,
        completed_at=_default_now_iso(),
        failure_type=None,
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

    raw_text = await asyncio.to_thread(_extract_pdf_text, file_path)
    if not raw_text.strip():
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
            "details": None,
        },
        created_at=_default_now_iso(),
    )


def _extract_pdf_text(file_path: Path) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover - environment setup
        raise ProcessingError("EXTRACTION_FAILED") from exc

    try:
        with fitz.open(file_path) as document:
            parts = [page.get_text("text") for page in document]
    except Exception as exc:  # pragma: no cover - defensive
        raise ProcessingError("EXTRACTION_FAILED") from exc

    return "\n".join(parts)
