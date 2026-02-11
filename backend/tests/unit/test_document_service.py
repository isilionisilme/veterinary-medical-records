from __future__ import annotations

from pathlib import Path

from backend.app.application.document_service import (
    get_document_original_location,
    get_document_status_details,
    register_document_upload,
)
from backend.app.domain.models import (
    Document,
    ProcessingRunState,
    ProcessingRunSummary,
    ProcessingStatus,
    ReviewStatus,
)
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

    def resolve(self, *, storage_path: str) -> Path:
        return Path("/tmp") / storage_path

    def exists(self, *, storage_path: str) -> bool:
        return True

    def save_raw_text(
        self, *, document_id: str, run_id: str, text: str
    ) -> StoredFile:
        return StoredFile(
            storage_path=f"{document_id}/runs/{run_id}/raw-text.txt",
            file_size=len(text),
        )

    def resolve_raw_text(self, *, document_id: str, run_id: str) -> Path:
        return Path("/tmp") / document_id / "runs" / run_id / "raw-text.txt"

    def exists_raw_text(self, *, document_id: str, run_id: str) -> bool:
        return False


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


def test_get_document_original_location_returns_none_when_missing() -> None:
    repository = FakeDocumentRepository()
    storage = FakeFileStorage()

    result = get_document_original_location(
        document_id="missing",
        repository=repository,
        storage=storage,
    )

    assert result is None


def test_get_document_original_location_resolves_path_and_existence() -> None:
    document = Document(
        document_id="doc-123",
        original_filename="record.pdf",
        content_type="application/pdf",
        file_size=10,
        storage_path="doc-123/original.pdf",
        created_at="2026-02-02T09:00:00+00:00",
        updated_at="2026-02-02T09:00:00+00:00",
        review_status=ReviewStatus.IN_REVIEW,
    )

    class StubRepository(FakeDocumentRepository):
        def get(self, document_id: str) -> Document | None:
            return document

    class StubStorage(FakeFileStorage):
        def exists(self, *, storage_path: str) -> bool:
            return False

    result = get_document_original_location(
        document_id="doc-123",
        repository=StubRepository(),
        storage=StubStorage(),
    )

    assert result is not None
    assert result.document.document_id == "doc-123"
    assert result.file_path == Path("/tmp/doc-123/original.pdf")
    assert result.exists is False


def test_get_document_status_details_marks_failed_when_raw_text_is_unusable(tmp_path) -> None:
    document = Document(
        document_id="doc-raw-text",
        original_filename="record.pdf",
        content_type="application/pdf",
        file_size=10,
        storage_path="doc-raw-text/original.pdf",
        created_at="2026-02-02T09:00:00+00:00",
        updated_at="2026-02-02T09:00:00+00:00",
        review_status=ReviewStatus.IN_REVIEW,
    )
    latest_run = ProcessingRunSummary(
        run_id="run-123",
        state=ProcessingRunState.COMPLETED,
        failure_type=None,
    )

    class StubRepository(FakeDocumentRepository):
        def get(self, document_id: str) -> Document | None:
            return document

        def get_latest_run(self, document_id: str) -> ProcessingRunSummary | None:
            return latest_run

    class StubStorage(FakeFileStorage):
        def exists_raw_text(self, *, document_id: str, run_id: str) -> bool:
            return True

        def resolve_raw_text(self, *, document_id: str, run_id: str) -> Path:
            raw_path = tmp_path / "raw-text-gibberish.txt"
            raw_path.write_text(
                "D%G! $G!II%D /T?UL Da$-N;.8Q- /T/UL /T@UL ?'BCADEF?",
                encoding="utf-8",
            )
            return raw_path

    result = get_document_status_details(
        document_id="doc-raw-text",
        repository=StubRepository(),
        storage=StubStorage(),
    )

    assert result is not None
    assert result.status_view.status == ProcessingStatus.FAILED
    assert result.status_view.failure_type == "EXTRACTION_LOW_QUALITY"


def test_get_document_status_details_keeps_completed_when_raw_text_is_usable(tmp_path) -> None:
    document = Document(
        document_id="doc-usable-text",
        original_filename="record.pdf",
        content_type="application/pdf",
        file_size=10,
        storage_path="doc-usable-text/original.pdf",
        created_at="2026-02-02T09:00:00+00:00",
        updated_at="2026-02-02T09:00:00+00:00",
        review_status=ReviewStatus.IN_REVIEW,
    )
    latest_run = ProcessingRunSummary(
        run_id="run-usable",
        state=ProcessingRunState.COMPLETED,
        failure_type=None,
    )

    class StubRepository(FakeDocumentRepository):
        def get(self, document_id: str) -> Document | None:
            return document

        def get_latest_run(self, document_id: str) -> ProcessingRunSummary | None:
            return latest_run

    class StubStorage(FakeFileStorage):
        def exists_raw_text(self, *, document_id: str, run_id: str) -> bool:
            return True

        def resolve_raw_text(self, *, document_id: str, run_id: str) -> Path:
            raw_path = tmp_path / "raw-text-usable.txt"
            raw_path.write_text(
                "Historia clinica: perro con fiebre y vomitos. Tratamiento sintomatico.",
                encoding="utf-8",
            )
            return raw_path

    result = get_document_status_details(
        document_id="doc-usable-text",
        repository=StubRepository(),
        storage=StubStorage(),
    )

    assert result is not None
    assert result.status_view.status == ProcessingStatus.COMPLETED
    assert result.status_view.failure_type is None

