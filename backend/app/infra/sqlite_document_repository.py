"""SQLite implementation of the DocumentRepository port."""

from __future__ import annotations

import json
from uuid import uuid4

from backend.app.domain.models import (
    Document,
    DocumentWithLatestRun,
    ProcessingRun,
    ProcessingRunDetail,
    ProcessingRunDetails,
    ProcessingRunState,
    ProcessingRunSummary,
    ProcessingStatus,
    ReviewStatus,
    StepArtifact,
    StepName,
    StepStatus,
)
from backend.app.infra import database


class SqliteDocumentRepository:
    """SQLite-backed document repository.

    This adapter persists document metadata and records an append-only status
    history entry for the initial state.
    """

    def create(self, document: Document, status: ProcessingStatus) -> None:
        """Insert a new document and its initial status history row.

        Args:
            document: Immutable document metadata to persist.

        Side Effects:
            Writes to the `documents` and `document_status_history` tables in the
            configured SQLite database.
        """

        with database.get_connection() as conn:
            conn.execute(
                """
                INSERT INTO documents (
                    document_id,
                    original_filename,
                    content_type,
                    file_size,
                    storage_path,
                    created_at,
                    updated_at,
                    review_status,
                    reviewed_at,
                    reviewed_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    document.document_id,
                    document.original_filename,
                    document.content_type,
                    document.file_size,
                    document.storage_path,
                    document.created_at,
                    document.updated_at,
                    document.review_status.value,
                    document.reviewed_at,
                    document.reviewed_by,
                ),
            )
            conn.execute(
                """
                INSERT INTO document_status_history (id, document_id, status, run_id, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(uuid4()), document.document_id, status.value, None, document.created_at),
            )
            conn.commit()

    def get(self, document_id: str) -> Document | None:
        """Fetch a document by its identifier.

        Args:
            document_id: Unique identifier for the document.

        Returns:
            The stored document metadata, or None when the document does not exist.
        """

        with database.get_connection() as conn:
            row = conn.execute(
                """
                SELECT
                    document_id,
                    original_filename,
                    content_type,
                    file_size,
                    storage_path,
                    created_at,
                    updated_at,
                    review_status,
                    reviewed_at,
                    reviewed_by
                FROM documents
                WHERE document_id = ?
                """,
                (document_id,),
            ).fetchone()

        if row is None:
            return None

        return Document(
            document_id=row["document_id"],
            original_filename=row["original_filename"],
            content_type=row["content_type"],
            file_size=row["file_size"],
            storage_path=row["storage_path"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            review_status=ReviewStatus(row["review_status"]),
            reviewed_at=row["reviewed_at"],
            reviewed_by=row["reviewed_by"],
        )

    def get_latest_run(self, document_id: str) -> ProcessingRunSummary | None:
        """Fetch the latest processing run summary for a document."""

        with database.get_connection() as conn:
            row = conn.execute(
                """
                SELECT
                    run_id,
                    state,
                    failure_type
                FROM processing_runs
                WHERE document_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (document_id,),
            ).fetchone()

        if row is None:
            return None

        return ProcessingRunSummary(
            run_id=row["run_id"],
            state=ProcessingRunState(row["state"]),
            failure_type=row["failure_type"],
        )

    def get_run(self, run_id: str) -> ProcessingRunDetails | None:
        """Fetch a processing run by its identifier."""

        with database.get_connection() as conn:
            row = conn.execute(
                """
                SELECT
                    run_id,
                    document_id,
                    state,
                    created_at,
                    started_at,
                    completed_at,
                    failure_type
                FROM processing_runs
                WHERE run_id = ?
                """,
                (run_id,),
            ).fetchone()

        if row is None:
            return None

        return ProcessingRunDetails(
            run_id=row["run_id"],
            document_id=row["document_id"],
            state=ProcessingRunState(row["state"]),
            created_at=row["created_at"],
            started_at=row["started_at"],
            completed_at=row["completed_at"],
            failure_type=row["failure_type"],
        )

    def get_latest_completed_run(self, document_id: str) -> ProcessingRunDetails | None:
        """Fetch the latest completed processing run for a document."""

        with database.get_connection() as conn:
            row = conn.execute(
                """
                SELECT
                    run_id,
                    document_id,
                    state,
                    created_at,
                    started_at,
                    completed_at,
                    failure_type
                FROM processing_runs
                WHERE document_id = ? AND state = ?
                ORDER BY completed_at DESC, created_at DESC
                LIMIT 1
                """,
                (document_id, ProcessingRunState.COMPLETED.value),
            ).fetchone()

        if row is None:
            return None

        return ProcessingRunDetails(
            run_id=row["run_id"],
            document_id=row["document_id"],
            state=ProcessingRunState(row["state"]),
            created_at=row["created_at"],
            started_at=row["started_at"],
            completed_at=row["completed_at"],
            failure_type=row["failure_type"],
        )

    def create_processing_run(
        self,
        *,
        run_id: str,
        document_id: str,
        state: ProcessingRunState,
        created_at: str,
    ) -> None:
        """Insert a new processing run record."""

        with database.get_connection() as conn:
            conn.execute(
                """
                INSERT INTO processing_runs (
                    run_id,
                    document_id,
                    state,
                    created_at
                )
                VALUES (?, ?, ?, ?)
                """,
                (run_id, document_id, state.value, created_at),
            )
            conn.commit()

    def list_queued_runs(self, *, limit: int) -> list[ProcessingRun]:
        """Return queued processing runs in FIFO order."""

        with database.get_connection() as conn:
            rows = conn.execute(
                """
                SELECT
                    run_id,
                    document_id,
                    state,
                    created_at
                FROM processing_runs
                WHERE state = ?
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (ProcessingRunState.QUEUED.value, limit),
            ).fetchall()

        return [
            ProcessingRun(
                run_id=row["run_id"],
                document_id=row["document_id"],
                state=ProcessingRunState(row["state"]),
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def try_start_run(self, *, run_id: str, document_id: str, started_at: str) -> bool:
        """Attempt to transition a queued run to running with guard."""

        with database.get_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE processing_runs
                SET state = ?, started_at = ?
                WHERE run_id = ?
                  AND state = ?
                  AND NOT EXISTS (
                    SELECT 1
                    FROM processing_runs
                    WHERE document_id = ?
                      AND state = ?
                  )
                """,
                (
                    ProcessingRunState.RUNNING.value,
                    started_at,
                    run_id,
                    ProcessingRunState.QUEUED.value,
                    document_id,
                    ProcessingRunState.RUNNING.value,
                ),
            )
            conn.commit()
        return cursor.rowcount == 1

    def complete_run(
        self,
        *,
        run_id: str,
        state: ProcessingRunState,
        completed_at: str,
        failure_type: str | None,
    ) -> None:
        """Finalize a run with a terminal state."""

        with database.get_connection() as conn:
            conn.execute(
                """
                UPDATE processing_runs
                SET state = ?, completed_at = ?, failure_type = ?
                WHERE run_id = ?
                """,
                (state.value, completed_at, failure_type, run_id),
            )
            conn.commit()

    def recover_orphaned_runs(self, *, completed_at: str) -> int:
        """Mark RUNNING runs as FAILED with PROCESS_TERMINATED."""

        with database.get_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE processing_runs
                SET state = ?, completed_at = ?, failure_type = ?
                WHERE state = ?
                """,
                (
                    ProcessingRunState.FAILED.value,
                    completed_at,
                    "PROCESS_TERMINATED",
                    ProcessingRunState.RUNNING.value,
                ),
            )
            conn.commit()
        return cursor.rowcount

    def list_documents(self, *, limit: int, offset: int) -> list[DocumentWithLatestRun]:
        """Return documents with their latest processing runs for list views."""

        with database.get_connection() as conn:
            rows = conn.execute(
                """
                SELECT
                    d.document_id,
                    d.original_filename,
                    d.content_type,
                    d.file_size,
                    d.storage_path,
                    d.created_at,
                    d.updated_at,
                    d.review_status,
                    d.reviewed_at,
                    d.reviewed_by,
                    r.run_id AS latest_run_id,
                    r.state AS latest_run_state,
                    r.failure_type AS latest_run_failure_type
                FROM documents d
                LEFT JOIN processing_runs r
                    ON r.run_id = (
                        SELECT pr.run_id
                        FROM processing_runs pr
                        WHERE pr.document_id = d.document_id
                        ORDER BY pr.created_at DESC
                        LIMIT 1
                    )
                ORDER BY d.created_at DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            ).fetchall()

        results: list[DocumentWithLatestRun] = []
        for row in rows:
            document = Document(
                document_id=row["document_id"],
                original_filename=row["original_filename"],
                content_type=row["content_type"],
                file_size=row["file_size"],
                storage_path=row["storage_path"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                review_status=ReviewStatus(row["review_status"]),
                reviewed_at=row["reviewed_at"],
                reviewed_by=row["reviewed_by"],
            )
            latest_run = None
            if row["latest_run_id"] is not None:
                latest_run = ProcessingRunSummary(
                    run_id=row["latest_run_id"],
                    state=ProcessingRunState(row["latest_run_state"]),
                    failure_type=row["latest_run_failure_type"],
                )
            results.append(DocumentWithLatestRun(document=document, latest_run=latest_run))
        return results

    def count_documents(self) -> int:
        """Return total number of documents."""

        with database.get_connection() as conn:
            row = conn.execute("SELECT COUNT(*) AS total FROM documents").fetchone()
        return int(row["total"]) if row else 0

    def list_processing_runs(self, *, document_id: str) -> list[ProcessingRunDetail]:
        """Return processing runs for a document in chronological order."""

        with database.get_connection() as conn:
            rows = conn.execute(
                """
                SELECT
                    run_id,
                    state,
                    created_at,
                    started_at,
                    completed_at,
                    failure_type
                FROM processing_runs
                WHERE document_id = ?
                ORDER BY created_at ASC
                """,
                (document_id,),
            ).fetchall()

        return [
            ProcessingRunDetail(
                run_id=row["run_id"],
                state=ProcessingRunState(row["state"]),
                created_at=row["created_at"],
                started_at=row["started_at"],
                completed_at=row["completed_at"],
                failure_type=row["failure_type"],
            )
            for row in rows
        ]

    def list_step_artifacts(self, *, run_id: str) -> list[StepArtifact]:
        """Return STEP_STATUS artifacts for a run in chronological order."""

        with database.get_connection() as conn:
            rows = conn.execute(
                """
                SELECT payload, created_at
                FROM artifacts
                WHERE run_id = ? AND artifact_type = ?
                ORDER BY created_at ASC
                """,
                (run_id, "STEP_STATUS"),
            ).fetchall()

        artifacts: list[StepArtifact] = []
        for row in rows:
            payload = json.loads(row["payload"])
            artifacts.append(
                StepArtifact(
                    step_name=StepName(payload["step_name"]),
                    step_status=StepStatus(payload["step_status"]),
                    attempt=int(payload["attempt"]),
                    started_at=payload.get("started_at"),
                    ended_at=payload.get("ended_at"),
                    error_code=payload.get("error_code"),
                    created_at=row["created_at"],
                )
            )
        return artifacts

    def append_artifact(
        self,
        *,
        run_id: str,
        artifact_type: str,
        payload: dict[str, object],
        created_at: str,
    ) -> None:
        """Persist a run-scoped artifact payload."""

        with database.get_connection() as conn:
            conn.execute(
                """
                INSERT INTO artifacts (artifact_id, run_id, artifact_type, payload, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    str(uuid4()),
                    run_id,
                    artifact_type,
                    json.dumps(payload, separators=(",", ":")),
                    created_at,
                ),
            )
            conn.commit()

    def get_latest_artifact_payload(
        self, *, run_id: str, artifact_type: str
    ) -> dict[str, object] | None:
        """Fetch the latest artifact payload for a run and type."""

        with database.get_connection() as conn:
            row = conn.execute(
                """
                SELECT payload
                FROM artifacts
                WHERE run_id = ? AND artifact_type = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (run_id, artifact_type),
            ).fetchone()

        if row is None:
            return None

        payload = json.loads(row["payload"])
        if not isinstance(payload, dict):
            return None
        return payload

    def update_review_status(
        self,
        *,
        document_id: str,
        review_status: str,
        updated_at: str,
        reviewed_at: str | None,
        reviewed_by: str | None,
    ) -> Document | None:
        """Update document review metadata and return the updated record."""

        if review_status == ReviewStatus.REVIEWED.value:
            query = """
                UPDATE documents
                SET
                    review_status = ?,
                    updated_at = CASE
                        WHEN review_status = ? THEN updated_at
                        ELSE ?
                    END,
                    reviewed_at = CASE
                        WHEN review_status = ? THEN reviewed_at
                        ELSE ?
                    END,
                    reviewed_by = CASE
                        WHEN review_status = ? THEN reviewed_by
                        ELSE ?
                    END
                WHERE document_id = ?
            """
            params = (
                review_status,
                ReviewStatus.REVIEWED.value,
                updated_at,
                ReviewStatus.REVIEWED.value,
                reviewed_at,
                ReviewStatus.REVIEWED.value,
                reviewed_by,
                document_id,
            )
        elif review_status == ReviewStatus.IN_REVIEW.value:
            query = """
                UPDATE documents
                SET
                    review_status = ?,
                    updated_at = CASE
                        WHEN review_status = ? THEN updated_at
                        ELSE ?
                    END,
                    reviewed_at = NULL,
                    reviewed_by = NULL
                WHERE document_id = ?
            """
            params = (
                review_status,
                ReviewStatus.IN_REVIEW.value,
                updated_at,
                document_id,
            )
        else:
            query = """
                UPDATE documents
                SET review_status = ?, updated_at = ?, reviewed_at = ?, reviewed_by = ?
                WHERE document_id = ?
            """
            params = (
                review_status,
                updated_at,
                reviewed_at,
                reviewed_by,
                document_id,
            )

        with database.get_connection() as conn:
            cursor = conn.execute(
                query,
                params,
            )
            conn.commit()

        if cursor.rowcount != 1:
            return None
        return self.get(document_id)

