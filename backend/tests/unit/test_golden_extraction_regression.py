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
_PERSON_LIKE_PATTERN = re.compile(
    r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\.-]*(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\.-]*){1,4}$"
)
_ADDRESS_TOKEN_PATTERN = re.compile(
    r"(?i)\b(?:c/|calle|av\.?|avenida|cp\b|codigo\s+postal|portal|piso|puerta|n[º°o]|no\.)\b"
)


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


def _assert_owner_or_vet_invariant(
    *,
    schema: dict[str, object],
    candidates: dict[str, object],
    field_key: str,
) -> None:
    value = schema.get(field_key)
    if isinstance(value, str) and value.strip():
        compact = value.strip()
        assert _PERSON_LIKE_PATTERN.search(compact)
        assert _ADDRESS_TOKEN_PATTERN.search(compact) is None
        return

    assert value in ("", None)
    raw_candidates = candidates.get(field_key, [])
    assert isinstance(raw_candidates, list)
    if not raw_candidates:
        return

    top1 = raw_candidates[0]
    assert isinstance(top1, dict)
    top1_value = top1.get("value")
    assert isinstance(top1_value, str) and top1_value.strip()


def test_doc_a_golden_goal_fields_regression(monkeypatch) -> None:
    data = _build_with_candidates(
        monkeypatch,
        doc_id="golden-doc-a",
        raw_text=_load_fixture("docA.txt"),
    )

    schema = data["global_schema"]
    candidates = data.get("candidate_bundle", {})
    assert isinstance(schema, dict)
    assert isinstance(candidates, dict)

    microchip = schema.get("microchip_id")
    assert isinstance(microchip, str) and _DIGIT_LIKE_PATTERN.search(microchip)

    _assert_owner_or_vet_invariant(
        schema=schema,
        candidates=candidates,
        field_key="owner_name",
    )

    weight = schema.get("weight")
    assert weight in ("", None)

    visit_date = schema.get("visit_date")
    assert visit_date is None or (
        isinstance(visit_date, str) and _DATE_LIKE_PATTERN.search(visit_date)
    )

    discharge_date = schema.get("discharge_date")
    assert discharge_date in ("", None)

    _assert_owner_or_vet_invariant(
        schema=schema,
        candidates=candidates,
        field_key="vet_name",
    )


def test_doc_b_golden_goal_fields_regression(monkeypatch) -> None:
    data = _build_with_candidates(
        monkeypatch,
        doc_id="golden-doc-b",
        raw_text=_load_fixture("docB.txt"),
    )

    schema = data["global_schema"]
    candidates = data.get("candidate_bundle", {})
    assert isinstance(schema, dict)
    assert isinstance(candidates, dict)

    microchip = schema.get("microchip_id")
    assert microchip in ("", None)
    microchip_candidates = candidates.get("microchip_id", [])
    assert microchip_candidates == []

    _assert_owner_or_vet_invariant(
        schema=schema,
        candidates=candidates,
        field_key="owner_name",
    )

    weight = schema.get("weight")
    assert weight in ("", None)

    visit_date = schema.get("visit_date")
    assert visit_date is None or (
        isinstance(visit_date, str) and _DATE_LIKE_PATTERN.search(visit_date)
    )

    discharge_date = schema.get("discharge_date")
    assert discharge_date in ("", None)

    _assert_owner_or_vet_invariant(
        schema=schema,
        candidates=candidates,
        field_key="vet_name",
    )


def test_owner_name_trim_uses_fixture_owner_and_address_lines() -> None:
    raw_text = _load_fixture("docB.txt")
    owner_line = next(line for line in raw_text.splitlines() if "NOMBRE DEMO" in line)
    address_line = next(line for line in raw_text.splitlines() if "C/ CALLE DEMO" in line)

    synthetic = f"Propietario: {owner_line} {address_line}\nPaciente: Luna"
    candidates = _mine_interpretation_candidates(synthetic)

    owner_candidates = candidates.get("owner_name", [])
    assert owner_candidates
    assert owner_candidates[0]["value"] == "NOMBRE DEMO"


def test_owner_name_trim_does_not_convert_pure_address_into_owner() -> None:
    raw_text = _load_fixture("docB.txt")
    address_line = next(line for line in raw_text.splitlines() if "C/ CALLE DEMO" in line)

    synthetic = f"Propietario: {address_line}\nPaciente: Luna"
    candidates = _mine_interpretation_candidates(synthetic)

    assert candidates.get("owner_name", []) == []
