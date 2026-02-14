"""Global Schema v0 constants and normalization helpers."""

from __future__ import annotations

from collections.abc import Mapping

GLOBAL_SCHEMA_V0_KEYS: tuple[str, ...] = (
    "clinic_name",
    "clinic_address",
    "clinical_record_number",
    "vet_name",
    "pet_name",
    "species",
    "breed",
    "sex",
    "age",
    "dob",
    "microchip_id",
    "weight",
    "coat_color",
    "hair_length",
    "repro_status",
    "owner_name",
    "owner_address",
    "visit_date",
    "reason_for_visit",
    "diagnosis",
    "symptoms",
    "procedure",
    "medication",
    "treatment_plan",
    "language",
)

REPEATABLE_KEYS_V0: frozenset[str] = frozenset(
    {
        "medication",
        "diagnosis",
        "procedure",
        "symptoms",
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
    "clinic_name": "string",
    "clinic_address": "string",
    "clinical_record_number": "string",
    "vet_name": "string",
    "pet_name": "string",
    "species": "string",
    "breed": "string",
    "sex": "string",
    "age": "string",
    "dob": "date",
    "microchip_id": "string",
    "weight": "string",
    "coat_color": "string",
    "hair_length": "string",
    "repro_status": "string",
    "owner_name": "string",
    "owner_address": "string",
    "visit_date": "date",
    "reason_for_visit": "string",
    "diagnosis": "string",
    "symptoms": "string",
    "procedure": "string",
    "medication": "string",
    "treatment_plan": "string",
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
