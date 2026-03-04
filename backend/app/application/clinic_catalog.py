"""Versioned local catalog for on-demand clinic address lookup.

This module provides a local catalog as a fast-path lookup.
It is called on-demand via API (user-initiated), never auto-enriched.
Future: add online geocoder fallback when catalog misses.
"""

from __future__ import annotations

CATALOG_VERSION = "1.0.0"

_CLINIC_CATALOG: list[dict[str, object]] = [
    {
        "names": ["CENTRO COSTA AZAHAR", "HV COSTA AZAHAR"],
        "address": "Rosa Molas 6, Bajo, 12003 Castelló",
    }
]


def _normalize_text(value: str) -> str:
    return value.strip().casefold()


def lookup_address_by_name(name: str) -> dict[str, object]:
    """Look up a clinic address by name.

    Returns a dict with keys:
      - found (bool): whether a unique match was found
      - address (str | None): the matched address, or None
      - source (str): "clinic_catalog"
      - catalog_version (str): version of the catalog used
    """
    result: dict[str, object] = {
        "found": False,
        "address": None,
        "source": "clinic_catalog",
        "catalog_version": CATALOG_VERSION,
    }

    if not isinstance(name, str) or not name.strip():
        return result

    normalized_name = _normalize_text(name)

    matches: list[dict[str, object]] = []
    for entry in _CLINIC_CATALOG:
        raw_names = entry.get("names")
        if not isinstance(raw_names, list):
            continue
        normalized_aliases = [
            _normalize_text(alias)
            for alias in raw_names
            if isinstance(alias, str) and alias.strip()
        ]
        if normalized_name in normalized_aliases:
            matches.append(entry)

    if len(matches) == 1:
        address = matches[0].get("address")
        if isinstance(address, str) and address.strip():
            result["found"] = True
            result["address"] = address

    return result


def lookup_name_by_address(address: str) -> str | None:
    """Look up a canonical clinic name by address (exact match).

    Returns the canonical name if exactly 1 match, None otherwise.
    """
    if not isinstance(address, str):
        return None

    normalized_address = _normalize_text(address)
    if not normalized_address:
        return None

    matches: list[dict[str, object]] = []
    for entry in _CLINIC_CATALOG:
        entry_address = entry.get("address")
        if not isinstance(entry_address, str):
            continue
        if _normalize_text(entry_address) == normalized_address:
            matches.append(entry)

    if len(matches) != 1:
        return None

    raw_names = matches[0].get("names")
    if not isinstance(raw_names, list) or not raw_names:
        return None

    canonical_name = raw_names[0]
    return canonical_name if isinstance(canonical_name, str) and canonical_name.strip() else None
