"""Unit tests for clinic_name normalization and ranking."""

from __future__ import annotations

from backend.app.application.field_normalizers import _normalize_clinic_name_value
from backend.app.application.processing.candidate_mining import _candidate_sort_key


def test_normalize_clinic_name_keeps_clean_value() -> None:
    assert _normalize_clinic_name_value("Hospital Vet Costa") == "Hospital Vet Costa"


def test_normalize_clinic_name_strips_leading_label() -> None:
    assert _normalize_clinic_name_value("Clínica: VetSalud Madrid") == "VetSalud Madrid"


def test_normalize_clinic_name_rejects_address_like_value() -> None:
    assert _normalize_clinic_name_value("Av. Norte 99") is None


def test_clinic_name_sort_prefers_institution_like_over_plain_address() -> None:
    clinic_candidate = {"value": "Hospital Vet Costa", "confidence": 0.66}
    address_candidate = {"value": "Av. Norte 99", "confidence": 0.66}

    assert _candidate_sort_key(clinic_candidate, "clinic_name") > _candidate_sort_key(
        address_candidate,
        "clinic_name",
    )
