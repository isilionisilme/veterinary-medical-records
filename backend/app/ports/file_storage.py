"""Port for filesystem storage operations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class StoredFile:
    """Result of storing a file in persistent storage."""

    storage_path: str
    file_size: int


class FileStorage(Protocol):
    """Storage contract for saving uploaded files."""

    def save(self, *, document_id: str, content: bytes) -> StoredFile:
        """Persist the uploaded file and return its storage metadata."""

    def delete(self, *, storage_path: str) -> None:
        """Remove a stored file if it exists."""
