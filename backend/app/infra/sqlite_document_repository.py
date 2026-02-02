"""SQLite implementation of the DocumentRepository port."""

from __future__ import annotations

from backend.app.domain.models import Document
from backend.app.infra import database


class SqliteDocumentRepository:
    """SQLite-backed document repository."""

    def create(self, document: Document) -> None:
        """Insert a new document and its initial status history row."""

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

