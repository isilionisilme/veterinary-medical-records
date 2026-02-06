"""SQLite implementation of the DocumentRepository port."""

from __future__ import annotations

from uuid import uuid4

from backend.app.domain.models import Document, ProcessingStatus, ReviewStatus
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

