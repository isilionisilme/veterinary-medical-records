"""Document use-cases for the veterinary medical records system."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from backend.app.domain.models import Document, ProcessingRunSummary, ProcessingStatus, ReviewStatus
from backend.app.domain.status import DocumentStatusView, derive_document_status
from backend.app.ports.document_repository import DocumentRepository
from backend.app.ports.file_storage import FileStorage


def _default_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _default_id() -> str:
    return str(uuid4())


@dataclass(frozen=True, slots=True)
class DocumentUploadResult:
    """Result returned after registering an uploaded document."""

    document_id: str
    status: str
    created_at: str


def register_document_upload(
    *,
    filename: str,
    content_type: str,
    content: bytes,
    repository: DocumentRepository,
    storage: FileStorage,
    id_provider: Callable[[], str] = _default_id,
    now_provider: Callable[[], str] = _default_now_iso,
) -> DocumentUploadResult:
    """Register an uploaded document and set its initial lifecycle state.

    Args:
        filename: Sanitized basename of the uploaded file.
        content_type: MIME type provided at upload time.
        repository: Persistence port used to store document metadata.
        id_provider: Provider for generating new document ids.
        now_provider: Provider for generating the creation timestamp (UTC ISO).

    Returns:
        A result object suitable for mapping to an HTTP response.
    """

    document_id = id_provider()
    created_at = now_provider()
    stored_file = storage.save(document_id=document_id, content=content)

    document = Document(
        document_id=document_id,
        original_filename=filename,
        content_type=content_type,
        file_size=stored_file.file_size,
        storage_path=stored_file.storage_path,
        created_at=created_at,
        updated_at=created_at,
        review_status=ReviewStatus.IN_REVIEW,
    )

    try:
        repository.create(document, ProcessingStatus.UPLOADED)
    except Exception:
        storage.delete(storage_path=stored_file.storage_path)
        raise

    return DocumentUploadResult(
        document_id=document_id,
        status=ProcessingStatus.UPLOADED.value,
        created_at=created_at,
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


@dataclass(frozen=True, slots=True)
class DocumentStatusDetails:
    """Document status details derived from the latest processing run."""

    document: Document
    latest_run: ProcessingRunSummary | None
    status_view: DocumentStatusView


def get_document_status_details(
    *, document_id: str, repository: DocumentRepository
) -> DocumentStatusDetails | None:
    """Return document metadata with derived status details.

    Args:
        document_id: Unique identifier for the document.
        repository: Persistence port used to fetch document and run summaries.

    Returns:
        Document status details or None when the document does not exist.
    """

    document = repository.get(document_id)
    if document is None:
        return None

    latest_run = repository.get_latest_run(document_id)
    status_view = derive_document_status(latest_run)
    return DocumentStatusDetails(document=document, latest_run=latest_run, status_view=status_view)

