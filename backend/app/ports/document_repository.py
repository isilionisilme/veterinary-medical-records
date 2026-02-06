"""Repository port for document persistence.

Slice 1 scope: keep the port minimal (only what the application layer needs).
"""

from __future__ import annotations

from typing import Protocol

from backend.app.domain.models import Document, ProcessingStatus


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

