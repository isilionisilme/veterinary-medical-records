"""SQLite implementation of the DocumentRepository port."""

from __future__ import annotations

from backend.app.domain.models import Document, ProcessingStatus
from backend.app.infra import database


class SqliteDocumentRepository:
    """SQLite-backed document repository.

    This adapter persists document metadata and records an append-only status
    history entry for the initial state.
    """

    def create(self, document: Document) -> None:
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
                INSERT INTO documents (document_id, filename, content_type, created_at, state)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    document.document_id,
                    document.filename,
                    document.content_type,
                    document.created_at,
                    document.state.value,
                ),
            )
            conn.execute(
                """
                INSERT INTO document_status_history (document_id, state, created_at)
                VALUES (?, ?, ?)
                """,
                (document.document_id, document.state.value, document.created_at),
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
                SELECT document_id, filename, content_type, created_at, state
                FROM documents
                WHERE document_id = ?
                """,
                (document_id,),
            ).fetchone()

        if row is None:
            return None

        return Document(
            document_id=row["document_id"],
            filename=row["filename"],
            content_type=row["content_type"],
            created_at=row["created_at"],
            state=ProcessingStatus(row["state"]),
        )

