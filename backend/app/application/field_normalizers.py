"""Deterministic canonical normalization for Global Schema v0 fields."""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import datetime

_WHITESPACE_PATTERN = re.compile(r"\s+")
_DATE_PATTERN = re.compile(
    r"\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b"
)

_SPECIES_TOKEN_TO_CANONICAL: dict[str, str] = {
    "canina": "canino",
    "canino": "canino",
    "perro": "canino",
    "perra": "canino",
    "felina": "felino",
    "felino": "felino",
    "gato": "felino",
    "gata": "felino",
}


def normalize_canonical_fields(
    values: Mapping[str, object],
    evidence_map: Mapping[str, list[dict[str, object]]] | None = None,
) -> dict[str, object]:
    """Normalize selected canonical fields without changing semantics."""

    normalized = dict(values)

    normalized["species"] = _normalize_species_value(normalized.get("species"))
    normalized["breed"] = _normalize_scalar_with_labels(
        normalized.get("breed"), ("raza", "breed")
    )
    normalized = _normalize_species_and_breed_pair(normalized, evidence_map)

    normalized["sex"] = _normalize_sex_value(normalized.get("sex"))
    normalized["microchip_id"] = _normalize_microchip_id(
        value=normalized.get("microchip_id"),
        evidence=(evidence_map.get("microchip_id") if evidence_map else None),
    )
    normalized["visit_date"] = _normalize_date_value(normalized.get("visit_date"))
    normalized["document_date"] = _normalize_date_value(normalized.get("document_date"))
    normalized["admission_date"] = _normalize_date_value(normalized.get("admission_date"))
    normalized["discharge_date"] = _normalize_date_value(normalized.get("discharge_date"))

    return normalized


def _normalize_whitespace(value: str) -> str:
    return _WHITESPACE_PATTERN.sub(" ", value).strip()


def _normalize_scalar_with_labels(value: object, labels: tuple[str, ...]) -> str | None:
    if not isinstance(value, str):
        return None

    cleaned = _normalize_whitespace(value)
    if not cleaned:
        return None

    for label in labels:
        cleaned = re.sub(
            rf"(?i)\b{re.escape(label)}\b\s*[:\-]?\s*",
            "",
            cleaned,
        )

    cleaned = _normalize_whitespace(cleaned.strip(" -:;,."))
    return cleaned or None


def _normalize_species_value(value: object) -> str | None:
    cleaned = _normalize_scalar_with_labels(value, ("especie", "species"))
    if not cleaned:
        return None

    lower_cleaned = cleaned.casefold()
    for token, canonical in _SPECIES_TOKEN_TO_CANONICAL.items():
        if re.search(rf"\b{re.escape(token)}\b", lower_cleaned):
            return canonical
    return cleaned


def _pretty_breed_case(value: str) -> str:
    words = value.split(" ")
    return " ".join(word.capitalize() if word.islower() else word for word in words)


def _remove_species_tokens(value: str) -> str:
    cleaned = value
    for token in _SPECIES_TOKEN_TO_CANONICAL:
        cleaned = re.sub(rf"(?i)\b{re.escape(token)}\b", " ", cleaned)
    cleaned = re.sub(r"[\-_/|]+", " ", cleaned)
    return _normalize_whitespace(cleaned)


def _normalize_species_and_breed_pair(
    values: dict[str, object],
    evidence_map: Mapping[str, list[dict[str, object]]] | None,
) -> dict[str, object]:
    species = values.get("species") if isinstance(values.get("species"), str) else None
    breed = values.get("breed") if isinstance(values.get("breed"), str) else None

    combined_sources = [value for value in (species, breed) if isinstance(value, str)]
    combined_sources.extend(_species_breed_sources_from_evidence(evidence_map))
    for source in combined_sources:
        lower_source = source.casefold()
        matched_token = next(
            (
                token
                for token in _SPECIES_TOKEN_TO_CANONICAL
                if re.search(rf"\b{re.escape(token)}\b", lower_source)
            ),
            None,
        )
        if matched_token is None:
            continue

        canonical_species = _SPECIES_TOKEN_TO_CANONICAL[matched_token]
        if not species:
            species = canonical_species

        remainder = _remove_species_tokens(source)
        if remainder and (not breed or source == species):
            breed = remainder

    if isinstance(breed, str):
        cleaned_breed = _remove_species_tokens(
            _normalize_scalar_with_labels(breed, ("raza", "breed")) or ""
        )
        breed = _pretty_breed_case(cleaned_breed) if cleaned_breed else None

    values["species"] = species
    values["breed"] = breed
    return values


def _species_breed_sources_from_evidence(
    evidence_map: Mapping[str, list[dict[str, object]]] | None,
) -> list[str]:
    if evidence_map is None:
        return []

    sources: list[str] = []
    for key in ("species", "breed"):
        for item in evidence_map.get(key, []):
            if not isinstance(item, dict):
                continue
            evidence = item.get("evidence")
            if not isinstance(evidence, dict):
                continue
            snippet = evidence.get("snippet")
            if not isinstance(snippet, str):
                continue

            compact = _normalize_whitespace(snippet)
            direct_match = re.search(
                r"(?i)(?:especie\s*/\s*raza|raza\s*/\s*especie)\s*[:\-]\s*([^\n;]{2,120})",
                compact,
            )
            if direct_match:
                sources.append(_normalize_whitespace(direct_match.group(1)))
                continue
            sources.append(compact)
    return sources


def _normalize_sex_value(value: object) -> str | None:
    cleaned = _normalize_scalar_with_labels(value, ("sexo", "sex"))
    if not cleaned:
        return None

    match = re.search(r"(?i)\b(hembra|macho|female|male)\b", cleaned)
    if not match:
        return None
    token = match.group(1).casefold()
    if token in {"female", "hembra"}:
        return "hembra"
    return "macho"


def _normalize_microchip_id(
    *,
    value: object,
    evidence: list[dict[str, object]] | None,
) -> str | None:
    labels = ("microchip", "chip", "nº chip", "n.o chip", "n° chip", "id")
    cleaned = _normalize_scalar_with_labels(value, labels)

    if not cleaned and evidence:
        first_evidence = evidence[0]
        raw_evidence = first_evidence.get("evidence") if isinstance(first_evidence, dict) else None
        snippet = raw_evidence.get("snippet") if isinstance(raw_evidence, dict) else None
        if isinstance(snippet, str):
            match = re.search(
                r"(?i)(?:microchip|chip)\s*(?:n[ºo]\.?|id)?\s*[:\-]?\s*([^\n;]{3,80})",
                _normalize_whitespace(snippet),
            )
            if match:
                cleaned = _normalize_scalar_with_labels(match.group(1), labels)

    if not cleaned:
        return None

    compact = _normalize_whitespace(cleaned.strip(" -:;,."))
    compact = re.sub(r"[^A-Za-z0-9./_\- ]+", " ", compact)
    compact = _normalize_whitespace(compact)
    if not compact:
        return None

    trailing_label_tokens = {
        "paciente",
        "propietario",
        "propietaria",
        "tutor",
        "especie",
        "raza",
        "sexo",
        "edad",
        "fecha",
    }
    parts = compact.split(" ")
    while parts and parts[-1].casefold() in trailing_label_tokens:
        parts.pop()

    normalized = _normalize_whitespace(" ".join(parts))
    return normalized or None


def _normalize_date_value(value: object) -> str | None:
    cleaned = _normalize_scalar_with_labels(value, ("fecha", "date", "visita", "consulta"))
    if not cleaned:
        return None

    match = _DATE_PATTERN.search(cleaned)
    if not match:
        return None

    raw = match.group(1).replace("-", "/").replace(".", "/")
    parts = raw.split("/")
    if len(parts) != 3:
        return None

    if len(parts[0]) == 4:
        year, month, day = parts
        normalized = f"{day.zfill(2)}/{month.zfill(2)}/{year}"
    else:
        day, month, year = parts
        normalized = f"{day.zfill(2)}/{month.zfill(2)}/{year}"

    for date_format in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            datetime.strptime(normalized, date_format)
            return normalized
        except ValueError:
            continue
    return None
