from __future__ import annotations

from backend.app.application.document_service import register_document_upload
from backend.app.domain.models import Document, ProcessingStatus


class FakeDocumentRepository:
    def __init__(self) -> None:
        self.created: list[Document] = []
        self.file_bytes: list[bytes] = []

    def create(self, document: Document, file_bytes: bytes) -> None:
        self.created.append(document)
        self.file_bytes.append(file_bytes)

    def get(self, document_id: str) -> Document | None:
        return None


def test_register_document_upload_persists_document_and_returns_response_fields() -> None:
    repository = FakeDocumentRepository()

    result = register_document_upload(
        filename="record.pdf",
        content_type="application/pdf",
        file_bytes=b"fake-bytes",
        repository=repository,
        id_provider=lambda: "doc-123",
        now_provider=lambda: "2026-02-02T09:00:00+00:00",
    )

    assert result.document_id == "doc-123"
    assert result.state == ProcessingStatus.UPLOADED.value
    assert result.message == "Document registered successfully."

    assert len(repository.created) == 1
    created = repository.created[0]
    assert created.document_id == "doc-123"
    assert created.filename == "record.pdf"
    assert created.content_type == "application/pdf"
    assert created.created_at == "2026-02-02T09:00:00+00:00"
    assert created.state == ProcessingStatus.UPLOADED
    assert repository.file_bytes == [b"fake-bytes"]


def test_register_document_upload_uses_provided_id_and_time_sources() -> None:
    repository = FakeDocumentRepository()

    result = register_document_upload(
        filename="x.pdf",
        content_type="application/pdf",
        file_bytes=b"x",
        repository=repository,
        id_provider=lambda: "fixed-id",
        now_provider=lambda: "fixed-time",
    )

    assert result.document_id == "fixed-id"
    assert repository.created[0].created_at == "fixed-time"

