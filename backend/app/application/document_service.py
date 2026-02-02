"""Document use-cases for the veterinary medical records system."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from backend.app.domain.models import Document, ProcessingStatus
from backend.app.ports.document_repository import DocumentRepository


def _default_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _default_id() -> str:
    return str(uuid4())


@dataclass(frozen=True, slots=True)
class DocumentUploadResult:
    """Result returned after registering an uploaded document."""

    document_id: str
    state: str
    message: str


def register_document_upload(
    *,
    filename: str,
    content_type: str,
    file_bytes: bytes,
    repository: DocumentRepository,
    id_provider: Callable[[], str] = _default_id,
    now_provider: Callable[[], str] = _default_now_iso,
) -> DocumentUploadResult:
    """Register an uploaded document and set its initial lifecycle state.

    Args:
        filename: Sanitized basename of the uploaded file.
        content_type: MIME type provided at upload time.
        file_bytes: Raw bytes for the uploaded file.
        repository: Persistence port used to store document metadata.
        id_provider: Provider for generating new document ids.
        now_provider: Provider for generating the creation timestamp (UTC ISO).

    Returns:
        A result object suitable for mapping to an HTTP response.
    """

    document_id = id_provider()
    created_at = now_provider()
    state = ProcessingStatus.UPLOADED

    document = Document(
        document_id=document_id,
        filename=filename,
        content_type=content_type,
        created_at=created_at,
        state=state,
    )
    repository.create(document, file_bytes)

    return DocumentUploadResult(
        document_id=document_id,
        state=state.value,
        message="Document registered successfully.",
    )


def get_document(*, document_id: str, repository: DocumentRepository) -> Document | None:
    """Retrieve document metadata for status visibility.

    Args:
        document_id: Unique identifier for the document.
        repository: Persistence port used to fetch the document.

    Returns:
        The document metadata, or None when not found.
    """

    return repository.get(document_id)

