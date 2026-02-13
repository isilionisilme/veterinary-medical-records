from __future__ import annotations

from pathlib import Path

import pytest

from backend.app.application.processing_runner import _build_interpretation_artifact

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "interpretation"


@pytest.mark.parametrize(
    ("fixture_name", "field_key", "expected"),
    [
        ("species_breed_case.txt", "species", "canino"),
        ("species_breed_case.txt", "breed", "YORKSHIRE TERRIER"),
        ("sex_case.txt", "sex", "hembra"),
        ("microchip_suffix_case.txt", "microchip_id", "00023035139 NHC 2.c"),
        ("visit_date_anchor_case.txt", "visit_date", "07/03/2024"),
    ],
)
def test_interpretation_fixture_regressions(
    fixture_name: str,
    field_key: str,
    expected: str,
) -> None:
    raw_text = (FIXTURES_DIR / fixture_name).read_text(encoding="utf-8")

    payload = _build_interpretation_artifact(
        document_id="doc-fixture",
        run_id="run-fixture",
        raw_text=raw_text,
    )

    global_schema_v0 = payload["data"]["global_schema_v0"]
    assert global_schema_v0[field_key] == expected


def test_species_token_is_not_kept_inside_breed() -> None:
    raw_text = (FIXTURES_DIR / "species_breed_case.txt").read_text(encoding="utf-8")

    payload = _build_interpretation_artifact(
        document_id="doc-breed-clean",
        run_id="run-breed-clean",
        raw_text=raw_text,
    )

    breed = payload["data"]["global_schema_v0"]["breed"]
    assert isinstance(breed, str)
    assert "canina" not in breed.casefold()
    assert "canino" not in breed.casefold()


def test_visit_date_fixture_exposes_anchor_based_selection_reason() -> None:
    raw_text = (FIXTURES_DIR / "visit_date_anchor_case.txt").read_text(encoding="utf-8")

    payload = _build_interpretation_artifact(
        document_id="doc-visit-anchor",
        run_id="run-visit-anchor",
        raw_text=raw_text,
    )

    date_selection = payload["data"]["summary"]["date_selection"]
    visit_selection = date_selection["visit_date"]
    assert isinstance(visit_selection, dict)
    assert visit_selection["anchor_priority"] >= 4
    assert isinstance(visit_selection["target_reason"], str)
    assert visit_selection["target_reason"].startswith("anchor:")
