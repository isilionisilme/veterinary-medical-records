"""Repository port for document persistence.

Slice 1 scope: keep the port minimal (only what the application layer needs).
"""

from __future__ import annotations

from typing import Protocol

from backend.app.domain.models import Document


class DocumentRepository(Protocol):
    """Persistence contract for storing documents and their initial state."""

    def create(self, document: Document) -> None:
        """Persist a new document and its initial status history entry."""

