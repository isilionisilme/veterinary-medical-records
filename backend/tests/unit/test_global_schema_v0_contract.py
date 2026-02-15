from __future__ import annotations

from backend.app.application.global_schema_v0 import (
    CRITICAL_KEYS_V0,
    GLOBAL_SCHEMA_V0_KEYS,
    SCHEMA_VERSION_V0,
)


def test_global_schema_v0_contract_version_and_order() -> None:
    expected_keys = [
        "claim_id",
        "clinic_name",
        "clinic_address",
        "vet_name",
        "document_date",
        "pet_name",
        "species",
        "breed",
        "sex",
        "age",
        "dob",
        "microchip_id",
        "weight",
        "owner_name",
        "owner_id",
        "visit_date",
        "admission_date",
        "discharge_date",
        "reason_for_visit",
        "diagnosis",
        "symptoms",
        "procedure",
        "medication",
        "treatment_plan",
        "allergies",
    ]

    assert SCHEMA_VERSION_V0 == "v0"
    assert list(GLOBAL_SCHEMA_V0_KEYS) == expected_keys
    assert len(GLOBAL_SCHEMA_V0_KEYS) == 25


def test_global_schema_v0_contract_critical_subset() -> None:
    expected_critical = {
        "pet_name",
        "species",
        "breed",
        "sex",
        "age",
        "weight",
        "visit_date",
        "diagnosis",
        "medication",
        "procedure",
    }

    assert CRITICAL_KEYS_V0 == expected_critical
