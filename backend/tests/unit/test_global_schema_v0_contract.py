from __future__ import annotations

import json

import pytest

import backend.app.application.global_schema_v0 as schema_module
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


def test_load_schema_contract_rejects_missing_required_field_keys(tmp_path, monkeypatch) -> None:
    invalid_contract_path = tmp_path / "invalid_schema_contract.json"
    invalid_contract_path.write_text(
        json.dumps(
            {
                "schema_version": "v0",
                "fields": [
                    {
                        "label": "Missing key",
                        "section": "Test",
                        "value_type": "string",
                        "repeatable": False,
                        "critical": False,
                        "optional": False,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(schema_module, "_SCHEMA_CONTRACT_PATH", invalid_contract_path)

    with pytest.raises(RuntimeError, match="missing keys: key"):
        schema_module._load_schema_contract()


def test_load_schema_contract_rejects_duplicate_keys(tmp_path, monkeypatch) -> None:
    invalid_contract_path = tmp_path / "duplicate_schema_contract.json"
    invalid_contract_path.write_text(
        json.dumps(
            {
                "schema_version": "v0",
                "fields": [
                    {
                        "key": "pet_name",
                        "label": "Nombre",
                        "section": "Paciente",
                        "value_type": "string",
                        "repeatable": False,
                        "critical": True,
                        "optional": False,
                    },
                    {
                        "key": "pet_name",
                        "label": "Nombre duplicado",
                        "section": "Paciente",
                        "value_type": "string",
                        "repeatable": False,
                        "critical": True,
                        "optional": False,
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(schema_module, "_SCHEMA_CONTRACT_PATH", invalid_contract_path)

    with pytest.raises(RuntimeError, match="duplicate key: pet_name"):
        schema_module._load_schema_contract()


def test_load_schema_contract_rejects_missing_file(tmp_path, monkeypatch) -> None:
    missing_contract_path = tmp_path / "missing_schema_contract.json"
    monkeypatch.setattr(schema_module, "_SCHEMA_CONTRACT_PATH", missing_contract_path)

    with pytest.raises(RuntimeError, match="contract file not found"):
        schema_module._load_schema_contract()


def test_load_schema_contract_rejects_invalid_json(tmp_path, monkeypatch) -> None:
    invalid_contract_path = tmp_path / "invalid_json_contract.json"
    invalid_contract_path.write_text("{ invalid json", encoding="utf-8")
    monkeypatch.setattr(schema_module, "_SCHEMA_CONTRACT_PATH", invalid_contract_path)

    with pytest.raises(RuntimeError, match="contract JSON is invalid"):
        schema_module._load_schema_contract()
