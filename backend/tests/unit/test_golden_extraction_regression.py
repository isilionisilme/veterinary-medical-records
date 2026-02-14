from __future__ import annotations

import re
from pathlib import Path

from backend.app.application.processing_runner import (
    _build_interpretation_artifact,
    _mine_interpretation_candidates,
)

FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "raw_text"

_DATE_LIKE_PATTERN = re.compile(r"^\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}$")
_DIGIT_LIKE_PATTERN = re.compile(r"\d{9,15}")


def _load_fixture(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")


def _build_with_candidates(monkeypatch, *, doc_id: str, raw_text: str) -> dict[str, object]:
    monkeypatch.setenv("VET_RECORDS_INCLUDE_INTERPRETATION_CANDIDATES", "true")
    payload = _build_interpretation_artifact(
        document_id=doc_id,
        run_id="golden-run",
        raw_text=raw_text,
    )
    data = payload["data"]
    assert isinstance(data, dict)
    return data


def test_doc_a_golden_goal_fields_regression(monkeypatch) -> None:
    data = _build_with_candidates(
        monkeypatch,
        doc_id="golden-doc-a",
        raw_text=_load_fixture("docA.txt"),
    )

    schema = data["global_schema_v0"]
    candidates = data.get("candidate_bundle", {})
    assert isinstance(schema, dict)
    assert isinstance(candidates, dict)

    microchip = schema.get("microchip_id")
    assert isinstance(microchip, str) and _DIGIT_LIKE_PATTERN.search(microchip)

    owner_name = schema.get("owner_name")
    assert owner_name in ("", None)
    owner_candidates = candidates.get("owner_name", [])
    assert owner_candidates == []

    weight = schema.get("weight")
    assert weight in ("", None)

    visit_date = schema.get("visit_date")
    document_date = schema.get("document_date")
    assert (
        (isinstance(visit_date, str) and _DATE_LIKE_PATTERN.search(visit_date))
        or (isinstance(document_date, str) and _DATE_LIKE_PATTERN.search(document_date))
    )

    discharge_date = schema.get("discharge_date")
    assert discharge_date in ("", None)

    vet_name = schema.get("vet_name")
    assert vet_name in ("", None)
    vet_candidates = candidates.get("vet_name", [])
    assert vet_candidates == []


def test_doc_b_golden_goal_fields_regression(monkeypatch) -> None:
    data = _build_with_candidates(
        monkeypatch,
        doc_id="golden-doc-b",
        raw_text=_load_fixture("docB.txt"),
    )

    schema = data["global_schema_v0"]
    candidates = data.get("candidate_bundle", {})
    assert isinstance(schema, dict)
    assert isinstance(candidates, dict)

    microchip = schema.get("microchip_id")
    assert microchip in ("", None)
    microchip_candidates = candidates.get("microchip_id", [])
    assert microchip_candidates == []

    owner_name = schema.get("owner_name")
    assert owner_name in ("", None)
    owner_candidates = candidates.get("owner_name", [])
    assert owner_candidates == []

    weight = schema.get("weight")
    assert weight in ("", None)

    visit_date = schema.get("visit_date")
    document_date = schema.get("document_date")
    assert (
        (isinstance(visit_date, str) and _DATE_LIKE_PATTERN.search(visit_date))
        or (isinstance(document_date, str) and _DATE_LIKE_PATTERN.search(document_date))
    )

    discharge_date = schema.get("discharge_date")
    assert discharge_date in ("", None)

    vet_name = schema.get("vet_name")
    assert vet_name in ("", None)


def test_owner_name_trim_uses_fixture_owner_and_address_lines() -> None:
    raw_text = _load_fixture("docB.txt")
    owner_line = next(line for line in raw_text.splitlines() if "BEATRIZ ABARCA" in line)
    address_line = next(line for line in raw_text.splitlines() if "C/ ORTEGA" in line)

    synthetic = f"Propietario: {owner_line} {address_line}\nPaciente: Luna"
    candidates = _mine_interpretation_candidates(synthetic)

    owner_candidates = candidates.get("owner_name", [])
    assert owner_candidates
    assert owner_candidates[0]["value"] == "BEATRIZ ABARCA"


def test_owner_name_trim_does_not_convert_pure_address_into_owner() -> None:
    raw_text = _load_fixture("docB.txt")
    address_line = next(line for line in raw_text.splitlines() if "C/ ORTEGA" in line)

    synthetic = f"Propietario: {address_line}\nPaciente: Luna"
    candidates = _mine_interpretation_candidates(synthetic)

    assert candidates.get("owner_name", []) == []