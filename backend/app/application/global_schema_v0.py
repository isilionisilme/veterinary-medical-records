"""Global Schema v0 constants and normalization helpers."""

from __future__ import annotations

from collections.abc import Mapping

GLOBAL_SCHEMA_V0_KEYS: tuple[str, ...] = (
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
    "vaccinations",
    "lab_result",
    "imaging",
    "invoice_total",
    "covered_amount",
    "non_covered_amount",
    "line_item",
    "notes",
    "language",
)

REPEATABLE_KEYS_V0: frozenset[str] = frozenset(
    {
        "medication",
        "diagnosis",
        "procedure",
        "lab_result",
        "line_item",
        "symptoms",
        "vaccinations",
        "imaging",
    }
)

CRITICAL_KEYS_V0: frozenset[str] = frozenset(
    {
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
)

VALUE_TYPE_BY_KEY_V0: dict[str, str] = {
    "claim_id": "string",
    "clinic_name": "string",
    "clinic_address": "string",
    "vet_name": "string",
    "document_date": "date",
    "pet_name": "string",
    "species": "string",
    "breed": "string",
    "sex": "string",
    "age": "string",
    "dob": "date",
    "microchip_id": "string",
    "weight": "string",
    "owner_name": "string",
    "owner_id": "string",
    "visit_date": "date",
    "admission_date": "date",
    "discharge_date": "date",
    "reason_for_visit": "string",
    "diagnosis": "string",
    "symptoms": "string",
    "procedure": "string",
    "medication": "string",
    "treatment_plan": "string",
    "allergies": "string",
    "vaccinations": "string",
    "lab_result": "string",
    "imaging": "string",
    "invoice_total": "string",
    "covered_amount": "string",
    "non_covered_amount": "string",
    "line_item": "string",
    "notes": "string",
    "language": "string",
}


def empty_global_schema_v0_payload() -> dict[str, object]:
    """Return a full v0-shaped payload with empty values."""

    payload: dict[str, object] = {}
    for key in GLOBAL_SCHEMA_V0_KEYS:
        payload[key] = [] if key in REPEATABLE_KEYS_V0 else None
    return payload


def normalize_global_schema_v0(payload: Mapping[str, object] | None) -> dict[str, object]:
    """Normalize arbitrary payload into a full Global Schema v0 shape."""

    normalized = empty_global_schema_v0_payload()
    if payload is None:
        return normalized

    for key in GLOBAL_SCHEMA_V0_KEYS:
        raw_value = payload.get(key)
        if key in REPEATABLE_KEYS_V0:
            if isinstance(raw_value, list):
                normalized[key] = [str(item).strip() for item in raw_value if str(item).strip()]
            elif raw_value is None:
                normalized[key] = []
            else:
                text = str(raw_value).strip()
                normalized[key] = [text] if text else []
            continue

        if raw_value is None:
            normalized[key] = None
            continue

        text_value = str(raw_value).strip()
        normalized[key] = text_value if text_value else None

    visit_date = normalized.get("visit_date")
    if normalized.get("document_date") is None and isinstance(visit_date, str) and visit_date:
        normalized["document_date"] = visit_date

    return normalized


def validate_global_schema_v0_shape(payload: Mapping[str, object]) -> list[str]:
    """Return human-readable validation errors for v0 payload shape."""

    errors: list[str] = []
    missing_keys = [key for key in GLOBAL_SCHEMA_V0_KEYS if key not in payload]
    if missing_keys:
        errors.append(f"Missing keys: {', '.join(missing_keys)}")

    for key in REPEATABLE_KEYS_V0:
        value = payload.get(key)
        if not isinstance(value, list):
            errors.append(f"Repeatable key '{key}' must be a list")

    return errors
