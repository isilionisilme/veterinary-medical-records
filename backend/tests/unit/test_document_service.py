from __future__ import annotations

from backend.app.application.document_service import register_document_upload
from backend.app.domain.models import Document, ProcessingRunSummary, ProcessingStatus, ReviewStatus
from backend.app.ports.file_storage import StoredFile


class FakeDocumentRepository:
    def __init__(self) -> None:
        self.created: list[tuple[Document, ProcessingStatus]] = []

    def create(self, document: Document, status: ProcessingStatus) -> None:
        self.created.append((document, status))

    def get(self, document_id: str) -> Document | None:
        return None

    def get_latest_run(self, document_id: str) -> ProcessingRunSummary | None:
        return None


class FakeFileStorage:
    def save(self, *, document_id: str, content: bytes) -> StoredFile:
        return StoredFile(storage_path=f"{document_id}/original.pdf", file_size=len(content))

    def delete(self, *, storage_path: str) -> None:
        return None


def test_register_document_upload_persists_document_and_returns_response_fields() -> None:
    repository = FakeDocumentRepository()
    storage = FakeFileStorage()

    result = register_document_upload(
        filename="record.pdf",
        content_type="application/pdf",
        content=b"%PDF-1.5 sample",
        repository=repository,
        storage=storage,
        id_provider=lambda: "doc-123",
        now_provider=lambda: "2026-02-02T09:00:00+00:00",
    )

    assert result.document_id == "doc-123"
    assert result.status == ProcessingStatus.UPLOADED.value
    assert result.created_at == "2026-02-02T09:00:00+00:00"

    assert len(repository.created) == 1
    created, status = repository.created[0]
    assert created.document_id == "doc-123"
    assert created.original_filename == "record.pdf"
    assert created.content_type == "application/pdf"
    assert created.file_size == len(b"%PDF-1.5 sample")
    assert created.storage_path == "doc-123/original.pdf"
    assert created.created_at == "2026-02-02T09:00:00+00:00"
    assert created.updated_at == "2026-02-02T09:00:00+00:00"
    assert created.review_status == ReviewStatus.IN_REVIEW
    assert status == ProcessingStatus.UPLOADED


def test_register_document_upload_uses_provided_id_and_time_sources() -> None:
    repository = FakeDocumentRepository()
    storage = FakeFileStorage()

    result = register_document_upload(
        filename="x.pdf",
        content_type="application/pdf",
        content=b"data",
        repository=repository,
        storage=storage,
        id_provider=lambda: "fixed-id",
        now_provider=lambda: "fixed-time",
    )

    assert result.document_id == "fixed-id"
    created, _ = repository.created[0]
    assert created.created_at == "fixed-time"



