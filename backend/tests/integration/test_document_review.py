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
    assert payload["review_status"] == "IN_REVIEW"
    assert payload["reviewed_at"] is None


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


def test_mark_document_reviewed_is_idempotent(test_client):
    document_id = _upload_sample_document(test_client)

    first = test_client.post(f"/documents/{document_id}/reviewed")
    assert first.status_code == 200
    first_payload = first.json()
    assert first_payload["document_id"] == document_id
    assert first_payload["review_status"] == "REVIEWED"
    assert isinstance(first_payload["reviewed_at"], str)

    second = test_client.post(f"/documents/{document_id}/reviewed")
    assert second.status_code == 200
    second_payload = second.json()
    assert second_payload["review_status"] == "REVIEWED"
    assert second_payload["reviewed_at"] == first_payload["reviewed_at"]


def test_reopen_document_review_is_idempotent(test_client):
    document_id = _upload_sample_document(test_client)
    marked = test_client.post(f"/documents/{document_id}/reviewed")
    assert marked.status_code == 200

    reopened = test_client.delete(f"/documents/{document_id}/reviewed")
    assert reopened.status_code == 200
    reopened_payload = reopened.json()
    assert reopened_payload["review_status"] == "IN_REVIEW"
    assert reopened_payload["reviewed_at"] is None

    reopened_again = test_client.delete(f"/documents/{document_id}/reviewed")
    assert reopened_again.status_code == 200
    reopened_again_payload = reopened_again.json()
    assert reopened_again_payload["review_status"] == "IN_REVIEW"
    assert reopened_again_payload["reviewed_at"] is None


def test_reviewed_toggle_returns_not_found_for_unknown_document(test_client):
    response = test_client.post("/documents/does-not-exist/reviewed")
    assert response.status_code == 404
    assert response.json()["error_code"] == "NOT_FOUND"

    reopen_response = test_client.delete("/documents/does-not-exist/reviewed")
    assert reopen_response.status_code == 404
    assert reopen_response.json()["error_code"] == "NOT_FOUND"


def test_interpretation_edit_creates_new_version_and_change_logs(test_client):
    document_id = _upload_sample_document(test_client)
    run_id = "run-review-edit-1"
    _insert_run(
        document_id=document_id,
        run_id=run_id,
        state=app_models.ProcessingRunState.COMPLETED,
        failure_type=None,
    )
    _insert_structured_interpretation(run_id=run_id)

    response = test_client.post(
        f"/runs/{run_id}/interpretations",
        json={
            "base_version_number": 1,
            "changes": [
                {
                    "op": "UPDATE",
                    "field_id": "field-1",
                    "value": "Nala",
                    "value_type": "string",
                },
                {
                    "op": "ADD",
                    "key": "new_custom_key",
                    "value": "new-value",
                    "value_type": "string",
                },
            ],
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["run_id"] == run_id
    assert payload["version_number"] == 2
    edited_fields = payload["data"]["fields"]
    assert any(
        field["field_id"] == "field-1"
        and field["value"] == "Nala"
        and field["origin"] == "human"
        for field in edited_fields
    )
    assert any(
        field["key"] == "new_custom_key"
        and field["value"] == "new-value"
        and field["origin"] == "human"
        for field in edited_fields
    )

    with database.get_connection() as conn:
        interpretation_rows = conn.execute(
            """
            SELECT payload
            FROM artifacts
            WHERE run_id = ? AND artifact_type = 'STRUCTURED_INTERPRETATION'
            ORDER BY created_at ASC
            """,
            (run_id,),
        ).fetchall()
        change_log_rows = conn.execute(
            """
            SELECT payload
            FROM artifacts
            WHERE run_id = ? AND artifact_type = 'FIELD_CHANGE_LOG'
            ORDER BY created_at ASC
            """,
            (run_id,),
        ).fetchall()

    assert len(interpretation_rows) == 2
    assert len(change_log_rows) == 2
    parsed_logs = [json.loads(row["payload"]) for row in change_log_rows]
    assert {entry["change_type"] for entry in parsed_logs} == {"ADD", "UPDATE"}
    assert all(str(entry["field_path"]).startswith("fields.") for entry in parsed_logs)


def test_interpretation_edit_returns_conflict_when_active_run_exists(test_client):
    document_id = _upload_sample_document(test_client)
    completed_run_id = "run-review-edit-completed"
    running_run_id = "run-review-edit-running"
    _insert_run(
        document_id=document_id,
        run_id=completed_run_id,
        state=app_models.ProcessingRunState.COMPLETED,
        failure_type=None,
    )
    _insert_structured_interpretation(run_id=completed_run_id)
    _insert_run(
        document_id=document_id,
        run_id=running_run_id,
        state=app_models.ProcessingRunState.RUNNING,
        failure_type=None,
    )

    response = test_client.post(
        f"/runs/{completed_run_id}/interpretations",
        json={
            "base_version_number": 1,
            "changes": [
                {
                    "op": "UPDATE",
                    "field_id": "field-1",
                    "value": "Nala",
                    "value_type": "string",
                }
            ],
        },
    )

    assert response.status_code == 409
    payload = response.json()
    assert payload["error_code"] == "CONFLICT"
    assert payload["details"]["reason"] == "REVIEW_BLOCKED_BY_ACTIVE_RUN"
