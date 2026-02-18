"""Repository port for document persistence.

Slice 1 scope: keep the port minimal (only what the application layer needs).
"""

from __future__ import annotations

from typing import Literal, Protocol

from backend.app.domain.models import (
    Document,
    DocumentWithLatestRun,
    ProcessingRun,
    ProcessingRunDetail,
    ProcessingRunDetails,
    ProcessingRunState,
    ProcessingRunSummary,
    ProcessingStatus,
    StepArtifact,
)


class DocumentRepository(Protocol):
    """Persistence contract for storing documents and their initial state."""

    def create(self, document: Document, status: ProcessingStatus) -> None:
        """Persist a new document and its initial status history entry."""

    def get(self, document_id: str) -> Document | None:
        """Return a document by id, if it exists.

        Args:
            document_id: Unique identifier for the document.

        Returns:
            The stored document metadata, or None when not found.
        """

    def get_latest_run(self, document_id: str) -> ProcessingRunSummary | None:
        """Return the latest processing run summary for a document, if any."""

    def get_run(self, run_id: str) -> ProcessingRunDetails | None:
        """Return processing run details by run id, if it exists."""

    def get_latest_completed_run(self, document_id: str) -> ProcessingRunDetails | None:
        """Return the latest completed run for a document, if any."""

    def create_processing_run(
        self,
        *,
        run_id: str,
        document_id: str,
        state: ProcessingRunState,
        created_at: str,
    ) -> None:
        """Persist a new processing run."""

    def list_queued_runs(self, *, limit: int) -> list[ProcessingRun]:
        """Return queued processing runs in FIFO order."""

    def try_start_run(self, *, run_id: str, document_id: str, started_at: str) -> bool:
        """Attempt to transition a queued run to running.

        Returns True if the run was started, False if the guard failed.
        """

    def complete_run(
        self,
        *,
        run_id: str,
        state: ProcessingRunState,
        completed_at: str,
        failure_type: str | None,
    ) -> None:
        """Finalize a run with a terminal state."""

    def recover_orphaned_runs(self, *, completed_at: str) -> int:
        """Mark any RUNNING runs as FAILED with PROCESS_TERMINATED.

        Returns the number of runs updated.
        """

    def list_documents(self, *, limit: int, offset: int) -> list[DocumentWithLatestRun]:
        """Return documents with their latest processing run summaries."""

    def count_documents(self) -> int:
        """Return total number of documents."""

    def list_processing_runs(self, *, document_id: str) -> list[ProcessingRunDetail]:
        """Return processing runs for a document ordered by creation time."""

    def list_step_artifacts(self, *, run_id: str) -> list[StepArtifact]:
        """Return STEP_STATUS artifacts for a run in chronological order."""

    def append_artifact(
        self,
        *,
        run_id: str,
        artifact_type: str,
        payload: dict[str, object],
        created_at: str,
    ) -> None:
        """Persist a run-scoped artifact record."""

    def get_latest_artifact_payload(
        self, *, run_id: str, artifact_type: str
    ) -> dict[str, object] | None:
        """Return latest artifact payload for a run and artifact type."""

    def update_review_status(
        self,
        *,
        document_id: str,
        review_status: str,
        updated_at: str,
        reviewed_at: str | None,
        reviewed_by: str | None,
    ) -> Document | None:
        """Update review metadata and return the updated document."""

    def increment_calibration_signal(
        self,
        *,
        context_key: str,
        field_key: str,
        mapping_id: str | None,
        policy_version: str,
        signal_type: Literal["edited", "accepted_unchanged"],
        updated_at: str,
    ) -> None:
        """Increment deterministic calibration counters for a scoped signal."""

    def apply_calibration_deltas(
        self,
        *,
        context_key: str,
        field_key: str,
        mapping_id: str | None,
        policy_version: str,
        accept_delta: int,
        edit_delta: int,
        updated_at: str,
    ) -> None:
        """Apply deterministic signed deltas to calibration counters for a scope."""

    def get_calibration_counts(
        self,
        *,
        context_key: str,
        field_key: str,
        mapping_id: str | None,
        policy_version: str,
    ) -> tuple[int, int] | None:
        """Return (accept_count, edit_count) for a calibration scope."""

