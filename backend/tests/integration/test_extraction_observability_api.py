"""Integration tests for extraction observability debug endpoints."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.application import extraction_observability
from backend.app.main import create_app


@pytest.fixture
def test_client(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("VET_RECORDS_DB_PATH", str(tmp_path / "documents.db"))
    monkeypatch.setenv("VET_RECORDS_STORAGE_PATH", str(tmp_path / "storage"))
    monkeypatch.setenv("VET_RECORDS_DISABLE_PROCESSING", "true")
    monkeypatch.delenv("VET_RECORDS_EXTRACTION_OBS", raising=False)
    monkeypatch.setattr(extraction_observability, "_OBSERVABILITY_DIR", tmp_path / "obs")

    app = create_app()
    with TestClient(app) as client:
        yield client


def _snapshot_payload() -> dict[str, object]:
    return {
        "runId": "run-1",
        "documentId": "doc-1",
        "createdAt": "2026-02-13T20:00:00Z",
        "schemaVersion": "v1",
        "fields": {
            "pet_name": {
                "status": "accepted",
                "confidence": "mid",
                "valueNormalized": "Luna",
                "valueRaw": "Luna",
                "reason": None,
            }
        },
        "counts": {
            "totalFields": 1,
            "accepted": 1,
            "rejected": 0,
            "missing": 0,
            "low": 0,
            "mid": 1,
            "high": 0,
        },
    }


def test_debug_extraction_endpoints_return_404_when_disabled(test_client: TestClient) -> None:
    post_response = test_client.post("/debug/extraction-runs", json=_snapshot_payload())
    get_response = test_client.get("/debug/extraction-runs/doc-1")

    assert post_response.status_code == 404
    assert post_response.json()["error_code"] == "NOT_FOUND"
    assert get_response.status_code == 404
    assert get_response.json()["error_code"] == "NOT_FOUND"


def test_debug_extraction_endpoints_persist_and_list_when_enabled(
    test_client: TestClient, monkeypatch
) -> None:
    monkeypatch.setenv("VET_RECORDS_EXTRACTION_OBS", "1")

    first_post_response = test_client.post("/debug/extraction-runs", json=_snapshot_payload())
    assert first_post_response.status_code == 201
    assert first_post_response.json()["document_id"] == "doc-1"

    second_post_response = test_client.post("/debug/extraction-runs", json=_snapshot_payload())
    assert second_post_response.status_code == 200
    assert second_post_response.json()["document_id"] == "doc-1"

    get_response = test_client.get("/debug/extraction-runs/doc-1")
    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["document_id"] == "doc-1"
    assert len(payload["runs"]) == 1
    assert payload["runs"][0]["runId"] == "run-1"
