"""Integration tests covering document review endpoint behavior."""

from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient

from backend.app.domain import models as app_models
from backend.app.infra import database
from backend.app.infra.file_storage import get_storage_root


@pytest.fixture
def test_db(tmp_path, monkeypatch):
    db_path = tmp_path / "documents.db"
    monkeypatch.setenv("VET_RECORDS_DB_PATH", str(db_path))
    monkeypatch.setenv("VET_RECORDS_STORAGE_PATH", str(tmp_path / "storage"))
    monkeypatch.setenv("VET_RECORDS_DISABLE_PROCESSING", "true")
    database.ensure_schema()
    return db_path


@pytest.fixture
def test_client(test_db):
    from backend.app.main import app

    with TestClient(app) as client:
        yield client


def _upload_sample_document(test_client: TestClient) -> str:
    content = b"%PDF-1.5 sample"
    files = {"file": ("record.pdf", io.BytesIO(content), "application/pdf")}
    response = test_client.post("/documents/upload", files=files)
    assert response.status_code == 201
    return response.json()["document_id"]


def _insert_run(
    *, document_id: str, run_id: str, state: app_models.ProcessingRunState, failure_type: str | None
) -> None:
    with database.get_connection() as conn:
        conn.execute(
            """
            INSERT INTO processing_runs (
                run_id, document_id, state, created_at, started_at, completed_at, failure_type
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                document_id,
                state.value,
                "2026-02-10T10:00:00+00:00",
                "2026-02-10T10:00:01+00:00",
                (
                    "2026-02-10T10:00:05+00:00"
                    if state == app_models.ProcessingRunState.COMPLETED
                    else None
                ),
                failure_type,
            ),
        )
        conn.commit()


def _insert_structured_interpretation(
    *,
    run_id: str,
    data: dict[str, object] | None = None,
) -> None:
    payload_data = data or {
        "schema_version": "v0",
        "document_id": "doc",
        "processing_run_id": run_id,
        "created_at": "2026-02-10T10:00:05+00:00",
        "fields": [
            {
                "field_id": "field-1",
                "key": "pet_name",
                "value": "Luna",
                "value_type": "string",
                "confidence": 0.82,
                "is_critical": False,
                "origin": "machine",
                "evidence": {"page": 1, "snippet": "Paciente: Luna"},
            }
        ],
    }

    payload = {
        "interpretation_id": "interp-1",
        "version_number": 1,
        "data": payload_data,
    }

    with database.get_connection() as conn:
        conn.execute(
            """
            INSERT INTO artifacts (artifact_id, run_id, artifact_type, payload, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                "artifact-review-1",
                run_id,
                "STRUCTURED_INTERPRETATION",
                json.dumps(payload, separators=(",", ":")),
                "2026-02-10T10:00:06+00:00",
            ),
        )
        conn.commit()


def test_document_review_returns_latest_completed_run_context(test_client):
    document_id = _upload_sample_document(test_client)
    run_id = "run-review-1"
    _insert_run(
        document_id=document_id,
        run_id=run_id,
        state=app_models.ProcessingRunState.COMPLETED,
        failure_type=None,
    )
    _insert_structured_interpretation(run_id=run_id)

    raw_text_path = get_storage_root() / document_id / "runs" / run_id / "raw-text.txt"
    raw_text_path.parent.mkdir(parents=True, exist_ok=True)
    raw_text_path.write_text("Paciente: Luna", encoding="utf-8")

    response = test_client.get(f"/documents/{document_id}/review")
    assert response.status_code == 200
    payload = response.json()
    assert payload["document_id"] == document_id
    assert payload["latest_completed_run"]["run_id"] == run_id
    assert payload["active_interpretation"]["version_number"] == 1
    assert payload["active_interpretation"]["data"]["schema_version"] == "v0"
    assert payload["raw_text_artifact"]["available"] is True


def test_document_review_returns_conflict_when_no_completed_run(test_client):
    document_id = _upload_sample_document(test_client)
    _insert_run(
        document_id=document_id,
        run_id="run-review-running",
        state=app_models.ProcessingRunState.RUNNING,
        failure_type=None,
    )

    response = test_client.get(f"/documents/{document_id}/review")
    assert response.status_code == 409
    payload = response.json()
    assert payload["error_code"] == "CONFLICT"
    assert payload["details"]["reason"] == "NO_COMPLETED_RUN"


def test_document_review_returns_conflict_when_interpretation_is_missing(test_client):
    document_id = _upload_sample_document(test_client)
    _insert_run(
        document_id=document_id,
        run_id="run-review-completed",
        state=app_models.ProcessingRunState.COMPLETED,
        failure_type=None,
    )

    response = test_client.get(f"/documents/{document_id}/review")
    assert response.status_code == 409
    payload = response.json()
    assert payload["error_code"] == "CONFLICT"
    assert payload["details"]["reason"] == "INTERPRETATION_MISSING"


def test_document_review_normalizes_legacy_microchip_suffix_to_digits_only(test_client):
    document_id = _upload_sample_document(test_client)
    run_id = "run-review-microchip-suffix"
    _insert_run(
        document_id=document_id,
        run_id=run_id,
        state=app_models.ProcessingRunState.COMPLETED,
        failure_type=None,
    )
    _insert_structured_interpretation(
        run_id=run_id,
        data={
            "schema_version": "v0",
            "global_schema_v0": {"microchip_id": "00023035139 NHC"},
        },
    )

    response = test_client.get(f"/documents/{document_id}/review")
    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["active_interpretation"]["data"]["global_schema_v0"]["microchip_id"]
        == "00023035139"
    )


def test_document_review_drops_legacy_non_digit_microchip_value(test_client):
    document_id = _upload_sample_document(test_client)
    run_id = "run-review-microchip-non-digit"
    _insert_run(
        document_id=document_id,
        run_id=run_id,
        state=app_models.ProcessingRunState.COMPLETED,
        failure_type=None,
    )
    _insert_structured_interpretation(
        run_id=run_id,
        data={
            "schema_version": "v0",
            "global_schema_v0": {"microchip_id": "BEATRIZ ABARCA C/ ORTEGA"},
        },
    )

    response = test_client.get(f"/documents/{document_id}/review")
    assert response.status_code == 200
    payload = response.json()
    assert payload["active_interpretation"]["data"]["global_schema_v0"]["microchip_id"] is None


def test_document_review_keeps_canonical_microchip_digits_unchanged(test_client):
    document_id = _upload_sample_document(test_client)
    run_id = "run-review-microchip-canonical"
    _insert_run(
        document_id=document_id,
        run_id=run_id,
        state=app_models.ProcessingRunState.COMPLETED,
        failure_type=None,
    )
    _insert_structured_interpretation(
        run_id=run_id,
        data={
            "schema_version": "v0",
            "global_schema_v0": {"microchip_id": "00023035139"},
        },
    )

    response = test_client.get(f"/documents/{document_id}/review")
    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["active_interpretation"]["data"]["global_schema_v0"]["microchip_id"]
        == "00023035139"
    )
