from __future__ import annotations

from pathlib import Path

from backend.app.application import extraction_observability


def _snapshot(
    *,
    run_id: str,
    document_id: str,
    status: str,
    confidence: str | None,
) -> dict[str, object]:
    return {
        "runId": run_id,
        "documentId": document_id,
        "createdAt": "2026-02-13T20:00:00Z",
        "schemaVersion": "v1",
        "fields": {
            "pet_name": {
                "status": status,
                "confidence": confidence,
                "valueNormalized": "Luna" if status == "accepted" else None,
                "valueRaw": "Luna" if status == "accepted" else None,
                "reason": "invalid-value" if status == "rejected" else None,
            },
        },
        "counts": {
            "totalFields": 1,
            "accepted": 1 if status == "accepted" else 0,
            "rejected": 1 if status == "rejected" else 0,
            "missing": 1 if status == "missing" else 0,
            "low": 1 if confidence == "low" else 0,
            "mid": 1 if confidence == "mid" else 0,
            "high": 1 if confidence == "high" else 0,
        },
    }


def test_persist_snapshot_keeps_only_latest_20_runs(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(extraction_observability, "_OBSERVABILITY_DIR", tmp_path)

    document_id = "doc-ring"
    for index in range(25):
        extraction_observability.persist_extraction_run_snapshot(
            _snapshot(
                run_id=f"run-{index}",
                document_id=document_id,
                status="accepted",
                confidence="mid",
            )
        )

    runs = extraction_observability.get_extraction_runs(document_id)
    assert len(runs) == 20
    assert runs[0]["runId"] == "run-5"
    assert runs[-1]["runId"] == "run-24"


def test_persist_snapshot_reports_changed_fields_against_previous(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(extraction_observability, "_OBSERVABILITY_DIR", tmp_path)

    document_id = "doc-diff"
    first = extraction_observability.persist_extraction_run_snapshot(
        _snapshot(run_id="run-1", document_id=document_id, status="missing", confidence=None)
    )
    second = extraction_observability.persist_extraction_run_snapshot(
        _snapshot(run_id="run-2", document_id=document_id, status="accepted", confidence="high")
    )

    assert first["changed_fields"] == 0
    assert second["changed_fields"] >= 1
