"""Global Schema v0 constants and normalization helpers."""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path

_SCHEMA_CONTRACT_PATH = (
    Path(__file__).resolve().parents[3] / "shared" / "global_schema_v0_contract.json"
)


def _load_schema_contract() -> dict[str, object]:
    raw = json.loads(_SCHEMA_CONTRACT_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise RuntimeError("Global Schema v0 contract must be a JSON object")
    fields = raw.get("fields")
    if not isinstance(fields, list) or not fields:
        raise RuntimeError("Global Schema v0 contract must define a non-empty fields list")
    return raw


_SCHEMA_CONTRACT = _load_schema_contract()
SCHEMA_VERSION_V0 = str(_SCHEMA_CONTRACT.get("schema_version", ""))
_FIELD_DEFINITIONS_V0 = [
    field for field in _SCHEMA_CONTRACT["fields"] if isinstance(field, dict)
]

GLOBAL_SCHEMA_V0_KEYS: tuple[str, ...] = tuple(
    str(field["key"]).strip() for field in _FIELD_DEFINITIONS_V0
)

REPEATABLE_KEYS_V0: frozenset[str] = frozenset(
    str(field["key"]).strip()
    for field in _FIELD_DEFINITIONS_V0
    if bool(field.get("repeatable"))
)

CRITICAL_KEYS_V0: frozenset[str] = frozenset(
    str(field["key"]).strip()
    for field in _FIELD_DEFINITIONS_V0
    if bool(field.get("critical"))
)

VALUE_TYPE_BY_KEY_V0: dict[str, str] = {
    str(field["key"]).strip(): str(field.get("value_type", "string"))
    for field in _FIELD_DEFINITIONS_V0
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
