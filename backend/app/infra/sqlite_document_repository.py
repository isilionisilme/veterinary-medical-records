"""SQLite implementation of the DocumentRepository port."""

from __future__ import annotations

from uuid import uuid4

from backend.app.domain.models import (
    Document,
    DocumentWithLatestRun,
    ProcessingRunState,
    ProcessingRunSummary,
    ProcessingStatus,
    ReviewStatus,
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
                    review_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
                    review_status
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

