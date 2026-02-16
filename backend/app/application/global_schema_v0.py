"""Global Schema v0 constants and normalization helpers."""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path

_SCHEMA_CONTRACT_PATH = (
    Path(__file__).resolve().parents[3] / "shared" / "global_schema_v0_contract.json"
)


def _load_schema_contract() -> dict[str, object]:
    try:
        raw_text = _SCHEMA_CONTRACT_PATH.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"Global Schema v0 contract file not found: {_SCHEMA_CONTRACT_PATH}"
        ) from exc

    try:
        raw = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Global Schema v0 contract JSON is invalid: {_SCHEMA_CONTRACT_PATH}"
        ) from exc

    if not isinstance(raw, dict):
        raise RuntimeError("Global Schema v0 contract must be a JSON object")

    schema_version = raw.get("schema_version")
    if not isinstance(schema_version, str) or not schema_version.strip():
        raise RuntimeError("Global Schema v0 contract must define a non-empty schema_version")

    fields = raw.get("fields")
    if not isinstance(fields, list) or not fields:
        raise RuntimeError("Global Schema v0 contract must define a non-empty fields list")

    required_keys = {
        "key",
        "label",
        "section",
        "value_type",
        "repeatable",
        "critical",
        "optional",
    }
    seen_keys: set[str] = set()
    for index, field in enumerate(fields):
        if not isinstance(field, dict):
            raise RuntimeError(f"Global Schema v0 field at index {index} must be an object")

        missing_keys = sorted(required_keys.difference(field.keys()))
        if missing_keys:
            missing_keys_text = ", ".join(missing_keys)
            raise RuntimeError(
                f"Global Schema v0 field at index {index} is missing keys: {missing_keys_text}"
            )

        field_key = str(field.get("key", "")).strip()
        if not field_key:
            raise RuntimeError(
                f"Global Schema v0 field at index {index} must define a non-empty key"
            )
        if field_key in seen_keys:
            raise RuntimeError(f"Global Schema v0 contains duplicate key: {field_key}")
        seen_keys.add(field_key)

        value_type = field.get("value_type")
        if not isinstance(value_type, str) or not value_type.strip():
            raise RuntimeError(
                f"Global Schema v0 field '{field_key}' must define a non-empty string value_type"
            )

        for flag in ("repeatable", "critical", "optional"):
            if not isinstance(field.get(flag), bool):
                raise RuntimeError(
                    f"Global Schema v0 field '{field_key}' must define boolean flag '{flag}'"
                )

    return raw


_SCHEMA_CONTRACT = _load_schema_contract()
SCHEMA_VERSION_V0 = str(_SCHEMA_CONTRACT.get("schema_version", ""))
_FIELD_DEFINITIONS_V0 = list(_SCHEMA_CONTRACT["fields"])

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
