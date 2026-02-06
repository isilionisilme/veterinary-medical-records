"""Document use-cases for the veterinary medical records system."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from backend.app.domain.models import (
    Document,
    DocumentWithLatestRun,
    ProcessingRunSummary,
    ProcessingStatus,
    ReviewStatus,
)
from backend.app.domain.status import DocumentStatusView, derive_document_status, map_status_label
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


@dataclass(frozen=True, slots=True)
class DocumentOriginalLocation:
    """Resolved location and metadata for an original stored document file."""

    document: Document
    file_path: Path
    exists: bool


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


def get_document_original_location(
    *, document_id: str, repository: DocumentRepository, storage: FileStorage
) -> DocumentOriginalLocation | None:
    """Resolve the stored location for an original uploaded document.

    Args:
        document_id: Unique identifier for the document.
        repository: Persistence port used to fetch document metadata.
        storage: File storage adapter used to resolve file locations.

    Returns:
        The resolved file location and metadata, or None when the document is missing.
    """

    document = repository.get(document_id)
    if document is None:
        return None

    return DocumentOriginalLocation(
        document=document,
        file_path=storage.resolve(storage_path=document.storage_path),
        exists=storage.exists(storage_path=document.storage_path),
    )


@dataclass(frozen=True, slots=True)
class DocumentListItem:
    """Document list entry with derived status metadata."""

    document_id: str
    original_filename: str
    created_at: str
    status: str
    status_label: str
    failure_type: str | None


@dataclass(frozen=True, slots=True)
class DocumentListResult:
    """Paginated document list result."""

    items: list[DocumentListItem]
    limit: int
    offset: int
    total: int


def list_documents(
    *, repository: DocumentRepository, limit: int, offset: int
) -> DocumentListResult:
    """List documents with derived status for list views.

    Args:
        repository: Persistence port used to fetch documents and run summaries.
        limit: Maximum number of documents to return.
        offset: Pagination offset.

    Returns:
        Paginated list of document entries with derived status.
    """

    rows = repository.list_documents(limit=limit, offset=offset)
    total = repository.count_documents()
    items = [_to_list_item(row) for row in rows]
    return DocumentListResult(items=items, limit=limit, offset=offset, total=total)


def _to_list_item(row: DocumentWithLatestRun) -> DocumentListItem:
    status_view = derive_document_status(row.latest_run)
    return DocumentListItem(
        document_id=row.document.document_id,
        original_filename=row.document.original_filename,
        created_at=row.document.created_at,
        status=status_view.status.value,
        status_label=map_status_label(status_view.status),
        failure_type=status_view.failure_type,
    )

