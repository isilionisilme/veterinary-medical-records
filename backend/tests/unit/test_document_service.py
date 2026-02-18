from __future__ import annotations

from pathlib import Path

from backend.app.application.document_service import (
    get_document_original_location,
    get_document_status_details,
    mark_document_reviewed,
    register_document_upload,
    reopen_document_review,
)
from backend.app.domain.models import (
    Document,
    ProcessingRunDetails,
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

    def get_latest_completed_run(self, document_id: str) -> ProcessingRunDetails | None:
        return None

    def get_latest_artifact_payload(
        self, *, run_id: str, artifact_type: str
    ) -> dict[str, object] | None:
        return None

    def append_artifact(
        self,
        *,
        run_id: str,
        artifact_type: str,
        payload: dict[str, object],
        created_at: str,
    ) -> None:
        return None

    def increment_calibration_signal(
        self,
        *,
        context_key: str,
        field_key: str,
        mapping_id: str | None,
        policy_version: str,
        signal_type: str,
        updated_at: str,
    ) -> None:
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


def test_get_document_status_details_does_not_re_evaluate_raw_text_quality() -> None:
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

    result = get_document_status_details(
        document_id="doc-raw-text",
        repository=StubRepository(),
    )

    assert result is not None
    assert result.status_view.status == ProcessingStatus.COMPLETED
    assert result.status_view.failure_type is None


def test_get_document_status_details_keeps_completed_when_raw_text_is_usable() -> None:
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

    result = get_document_status_details(
        document_id="doc-usable-text",
        repository=StubRepository(),
    )

    assert result is not None
    assert result.status_view.status == ProcessingStatus.COMPLETED
    assert result.status_view.failure_type is None


def test_mark_document_reviewed_updates_review_metadata() -> None:
    document = Document(
        document_id="doc-review",
        original_filename="record.pdf",
        content_type="application/pdf",
        file_size=10,
        storage_path="doc-review/original.pdf",
        created_at="2026-02-02T09:00:00+00:00",
        updated_at="2026-02-02T09:00:00+00:00",
        review_status=ReviewStatus.IN_REVIEW,
    )

    class StubRepository(FakeDocumentRepository):
        def __init__(self) -> None:
            super().__init__()
            self.document = document

        def get(self, document_id: str) -> Document | None:
            return self.document if document_id == self.document.document_id else None

        def update_review_status(
            self,
            *,
            document_id: str,
            review_status: str,
            updated_at: str,
            reviewed_at: str | None,
            reviewed_by: str | None,
        ) -> Document | None:
            if document_id != self.document.document_id:
                return None
            self.document = Document(
                document_id=self.document.document_id,
                original_filename=self.document.original_filename,
                content_type=self.document.content_type,
                file_size=self.document.file_size,
                storage_path=self.document.storage_path,
                created_at=self.document.created_at,
                updated_at=updated_at,
                review_status=ReviewStatus(review_status),
                reviewed_at=reviewed_at,
                reviewed_by=reviewed_by,
            )
            return self.document

    repository = StubRepository()
    result = mark_document_reviewed(
        document_id="doc-review",
        repository=repository,
        now_provider=lambda: "2026-02-03T10:00:00+00:00",
        reviewed_by="vet-1",
    )

    assert result is not None
    assert result.review_status == "REVIEWED"
    assert result.reviewed_at == "2026-02-03T10:00:00+00:00"
    assert result.reviewed_by == "vet-1"


def test_reopen_document_review_clears_review_metadata() -> None:
    document = Document(
        document_id="doc-review",
        original_filename="record.pdf",
        content_type="application/pdf",
        file_size=10,
        storage_path="doc-review/original.pdf",
        created_at="2026-02-02T09:00:00+00:00",
        updated_at="2026-02-02T09:00:00+00:00",
        review_status=ReviewStatus.REVIEWED,
        reviewed_at="2026-02-03T10:00:00+00:00",
        reviewed_by="vet-1",
    )

    class StubRepository(FakeDocumentRepository):
        def __init__(self) -> None:
            super().__init__()
            self.document = document

        def get(self, document_id: str) -> Document | None:
            return self.document if document_id == self.document.document_id else None

        def update_review_status(
            self,
            *,
            document_id: str,
            review_status: str,
            updated_at: str,
            reviewed_at: str | None,
            reviewed_by: str | None,
        ) -> Document | None:
            if document_id != self.document.document_id:
                return None
            self.document = Document(
                document_id=self.document.document_id,
                original_filename=self.document.original_filename,
                content_type=self.document.content_type,
                file_size=self.document.file_size,
                storage_path=self.document.storage_path,
                created_at=self.document.created_at,
                updated_at=updated_at,
                review_status=ReviewStatus(review_status),
                reviewed_at=reviewed_at,
                reviewed_by=reviewed_by,
            )
            return self.document

    repository = StubRepository()
    result = reopen_document_review(
        document_id="doc-review",
        repository=repository,
        now_provider=lambda: "2026-02-04T10:00:00+00:00",
    )

    assert result is not None
    assert result.review_status == "IN_REVIEW"
    assert result.reviewed_at is None
    assert result.reviewed_by is None

