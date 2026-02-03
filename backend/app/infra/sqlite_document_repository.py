"""SQLite implementation of the DocumentRepository port."""

from __future__ import annotations

from backend.app.domain.models import Document, ProcessingStatus
from backend.app.infra import database, file_storage


class SqliteDocumentRepository:
    """SQLite-backed document repository.

    This adapter persists document metadata and records an append-only status
    history entry for the initial state.
    """

    def create(self, document: Document, file_bytes: bytes) -> None:
        """Store file bytes on disk and persist a new document row.

        Args:
            document: Immutable document metadata to persist.
            file_bytes: Raw bytes for the uploaded file.

        Side Effects:
            - Writes the uploaded file to the configured storage directory.
            - Writes to the `documents` and `document_status_history` tables in
              the configured SQLite database.
        """

        storage_path = file_storage.build_document_path(
            document_id=document.document_id,
            original_filename=document.filename,
        )
        file_storage.write_document_bytes(path=storage_path, file_bytes=file_bytes)

        with database.get_connection() as conn:
            try:
                conn.execute(
                    """
                    INSERT INTO documents (
                        document_id,
                        filename,
                        content_type,
                        created_at,
                        state,
                        file_path
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        document.document_id,
                        document.filename,
                        document.content_type,
                        document.created_at,
                        document.state.value,
                        str(storage_path),
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
            except Exception:
                storage_path.unlink(missing_ok=True)
                raise

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
                SELECT document_id, filename, content_type, created_at, state, file_path
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
            file_path=row["file_path"],
        )

