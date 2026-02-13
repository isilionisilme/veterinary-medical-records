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


def test_persist_snapshot_is_idempotent_per_document_and_run_id(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(extraction_observability, "_OBSERVABILITY_DIR", tmp_path)

    document_id = "doc-idempotent"
    first = extraction_observability.persist_extraction_run_snapshot(
        _snapshot(run_id="run-1", document_id=document_id, status="missing", confidence=None)
    )
    second = extraction_observability.persist_extraction_run_snapshot(
        _snapshot(run_id="run-1", document_id=document_id, status="accepted", confidence="high")
    )

    runs = extraction_observability.get_extraction_runs(document_id)
    assert len(runs) == 1
    assert runs[0]["runId"] == "run-1"
    assert runs[0]["fields"]["pet_name"]["status"] == "accepted"
    assert first["was_created"] is True
    assert second["was_created"] is False


def test_build_extraction_triage_populates_missing_and_rejected_lists() -> None:
    snapshot = {
        "runId": "run-triage",
        "documentId": "doc-triage",
        "createdAt": "2026-02-13T20:05:00Z",
        "fields": {
            "claim_id": {"status": "missing", "confidence": None},
            "weight": {
                "status": "rejected",
                "confidence": None,
                "valueRaw": "cien kilos",
                "reason": "invalid-format",
                "rawCandidate": "cien kilos",
            },
        },
        "counts": {"accepted": 0, "missing": 1, "rejected": 1, "low": 0, "mid": 0, "high": 0},
    }

    triage = extraction_observability.build_extraction_triage(snapshot)

    assert triage["missing"][0]["field"] == "claim_id"
    assert triage["missing"][0]["reason"] == "missing"
    assert triage["rejected"][0]["field"] == "weight"
    assert triage["rejected"][0]["reason"] == "invalid-format"
    assert triage["rejected"][0]["rawCandidate"] == "cien kilos"


def test_build_extraction_triage_flags_suspicious_accepted_fields() -> None:
    snapshot = {
        "runId": "run-flags",
        "documentId": "doc-flags",
        "createdAt": "2026-02-13T20:06:00Z",
        "fields": {
            "microchip_id": {
                "status": "accepted",
                "confidence": "mid",
                "valueNormalized": "Maria Lopez Calle 123",
            },
            "weight": {
                "status": "accepted",
                "confidence": "mid",
                "valueNormalized": "500 kg",
            },
            "species": {
                "status": "accepted",
                "confidence": "low",
                "valueNormalized": "equino",
            },
            "sex": {
                "status": "accepted",
                "confidence": "low",
                "valueNormalized": "desconocido",
            },
            "notes": {
                "status": "accepted",
                "confidence": "high",
                "valueNormalized": "x" * 120,
            },
        },
        "counts": {"accepted": 5, "missing": 0, "rejected": 0, "low": 2, "mid": 2, "high": 1},
    }

    triage = extraction_observability.build_extraction_triage(snapshot)
    suspicious_by_field = {item["field"]: item for item in triage["suspiciousAccepted"]}

    assert "microchip_non_digit_characters" in suspicious_by_field["microchip_id"]["flags"]
    assert "weight_out_of_range" in suspicious_by_field["weight"]["flags"]
    assert "species_outside_allowed_set" in suspicious_by_field["species"]["flags"]
    assert "sex_outside_allowed_set" in suspicious_by_field["sex"]["flags"]
    assert "value_too_long" in suspicious_by_field["notes"]["flags"]


def test_build_extraction_triage_keeps_top_candidates_shape() -> None:
    snapshot = {
        "runId": "run-top-candidates",
        "documentId": "doc-top-candidates",
        "createdAt": "2026-02-13T20:06:00Z",
        "fields": {
            "microchip_id": {
                "status": "rejected",
                "confidence": None,
                "valueRaw": "00023035139 NHC",
                "reason": "non-digit",
                "rawCandidate": "00023035139 NHC",
                "topCandidates": [
                    {"value": "00023035139 NHC", "confidence": 0.86},
                    {"value": "NHC 2.c", "confidence": 0.42},
                ],
            },
            "owner_id": {
                "status": "missing",
                "confidence": None,
                "topCandidates": [
                    {"value": "DNI 12345678A", "confidence": 0.51},
                ],
            },
        },
        "counts": {"accepted": 0, "missing": 1, "rejected": 1, "low": 0, "mid": 0, "high": 0},
    }

    triage = extraction_observability.build_extraction_triage(snapshot)
    rejected_item = triage["rejected"][0]
    missing_item = triage["missing"][0]

    assert rejected_item["topCandidates"][0]["value"] == "00023035139 NHC"
    assert missing_item["topCandidates"][0]["value"] == "DNI 12345678A"
