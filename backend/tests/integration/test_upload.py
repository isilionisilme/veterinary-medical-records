"""Integration tests covering the document HTTP endpoints."""

import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.domain import models as app_models
from backend.app.infra import database


@pytest.fixture
def test_db(tmp_path, monkeypatch):
    db_path = tmp_path / "documents.db"
    storage_dir = tmp_path / "uploads"
    monkeypatch.setenv("VET_RECORDS_DB_PATH", str(db_path))
    monkeypatch.setenv("VET_RECORDS_STORAGE_DIR", str(storage_dir))
    database.ensure_schema()
    return db_path


@pytest.fixture
def test_client(test_db):
    from backend.app.main import app

    with TestClient(app) as client:
        yield client


def test_upload_success_creates_document(test_client):
    files = {
        "file": ("record.pdf", io.BytesIO(b"%PDF-1.5 sample"), "application/pdf")
    }
    response = test_client.post("/documents/upload", files=files)
    assert response.status_code == 201
    payload = response.json()
    assert payload["state"] == app_models.ProcessingStatus.UPLOADED.value
    assert payload["message"] == "Document registered successfully."
    document_id = payload["document_id"]

    with database.get_connection() as conn:
        document = conn.execute(
            "SELECT * FROM documents WHERE document_id = ?",
            (document_id,),
        ).fetchone()
        assert document, "Document should exist in the database."
        assert document["state"] == app_models.ProcessingStatus.UPLOADED.value
        assert document["file_path"]
        assert Path(document["file_path"]).exists()
        history = conn.execute(
            "SELECT * FROM document_status_history WHERE document_id = ?",
            (document_id,),
        ).fetchall()
        assert len(history) == 1
        assert history[0]["state"] == app_models.ProcessingStatus.UPLOADED.value


def test_upload_rejects_unsupported_type(test_client):
    files = {
        "file": ("record.txt", io.BytesIO(b"plain text"), "text/plain")
    }
    response = test_client.post("/documents/upload", files=files)
    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_limits_size(test_client):
    from backend.app.main import MAX_UPLOAD_SIZE

    large_content = b"A" * (MAX_UPLOAD_SIZE + 1)
    files = {
        "file": ("record.pdf", io.BytesIO(large_content), "application/pdf")
    }
    response = test_client.post("/documents/upload", files=files)
    assert response.status_code == 413
    assert "maximum allowed size" in response.json()["detail"]


def test_get_document_returns_metadata_and_state(test_client):
    files = {
        "file": ("record.pdf", io.BytesIO(b"%PDF-1.5 sample"), "application/pdf")
    }
    upload_response = test_client.post("/documents/upload", files=files)
    assert upload_response.status_code == 201
    document_id = upload_response.json()["document_id"]

    response = test_client.get(f"/documents/{document_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["document_id"] == document_id
    assert payload["filename"] == "record.pdf"
    assert payload["content_type"] == "application/pdf"
    assert payload["state"] == app_models.ProcessingStatus.UPLOADED.value
    assert isinstance(payload["created_at"], str)
    assert payload["created_at"]


def test_get_document_returns_404_when_missing(test_client):
    response = test_client.get("/documents/does-not-exist")
    assert response.status_code == 404
    assert response.json()["detail"] == "Document not found."
