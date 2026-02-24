from __future__ import annotations

import re
from datetime import datetime

NUMERIC_TYPES = (int, float)
_REVIEW_SCHEMA_CONTRACT_CANONICAL = "visit-grouped-canonical"

_MEDICAL_RECORD_CANONICAL_SECTIONS: tuple[str, ...] = (
    "clinic",
    "patient",
    "owner",
    "visits",
    "notes",
    "other",
    "report_info",
)

_MEDICAL_RECORD_CANONICAL_FIELD_SLOTS: tuple[dict[str, object], ...] = (
    {
        "concept_id": "clinic.name",
        "section": "clinic",
        "scope": "document",
        "canonical_key": "clinic_name",
        "label_key": "clinic_name",
    },
    {
        "concept_id": "clinic.address",
        "section": "clinic",
        "scope": "document",
        "canonical_key": "clinic_address",
        "label_key": "clinic_address",
    },
    {
        "concept_id": "clinic.vet_name",
        "section": "clinic",
        "scope": "document",
        "canonical_key": "vet_name",
        "label_key": "vet_name",
    },
    {
        "concept_id": "clinic.nhc",
        "section": "clinic",
        "scope": "document",
        "canonical_key": "nhc",
        "aliases": ["medical_record_number"],
        "label_key": "nhc",
    },
    {
        "concept_id": "patient.pet_name",
        "section": "patient",
        "scope": "document",
        "canonical_key": "pet_name",
        "label_key": "pet_name",
    },
    {
        "concept_id": "patient.species",
        "section": "patient",
        "scope": "document",
        "canonical_key": "species",
        "label_key": "species",
    },
    {
        "concept_id": "patient.breed",
        "section": "patient",
        "scope": "document",
        "canonical_key": "breed",
        "label_key": "breed",
    },
    {
        "concept_id": "patient.sex",
        "section": "patient",
        "scope": "document",
        "canonical_key": "sex",
        "label_key": "sex",
    },
    {
        "concept_id": "patient.age",
        "section": "patient",
        "scope": "document",
        "canonical_key": "age",
        "label_key": "age",
    },
    {
        "concept_id": "patient.dob",
        "section": "patient",
        "scope": "document",
        "canonical_key": "dob",
        "label_key": "dob",
    },
    {
        "concept_id": "patient.microchip_id",
        "section": "patient",
        "scope": "document",
        "canonical_key": "microchip_id",
        "label_key": "microchip_id",
    },
    {
        "concept_id": "patient.weight",
        "section": "patient",
        "scope": "document",
        "canonical_key": "weight",
        "label_key": "weight",
    },
    {
        "concept_id": "patient.reproductive_status",
        "section": "patient",
        "scope": "document",
        "canonical_key": "reproductive_status",
        "aliases": ["repro_status"],
        "label_key": "reproductive_status",
    },
    {
        "concept_id": "owner.name",
        "section": "owner",
        "scope": "document",
        "canonical_key": "owner_name",
        "label_key": "owner_name",
    },
    {
        "concept_id": "owner.address",
        "section": "owner",
        "scope": "document",
        "canonical_key": "owner_address",
        "aliases": ["owner_id"],
        "label_key": "owner_address",
    },
    {
        "concept_id": "notes.main",
        "section": "notes",
        "scope": "document",
        "canonical_key": "notes",
        "label_key": "notes",
    },
    {
        "concept_id": "report.language",
        "section": "report_info",
        "scope": "document",
        "canonical_key": "language",
        "label_key": "language",
    },
)

_VISIT_GROUP_METADATA_KEYS: tuple[str, ...] = (
    "visit_date",
    "admission_date",
    "discharge_date",
    "reason_for_visit",
)

_VISIT_SCOPED_KEYS: tuple[str, ...] = (
    "symptoms",
    "diagnosis",
    "procedure",
    "medication",
    "treatment_plan",
    "allergies",
    "vaccinations",
    "lab_result",
    "imaging",
)

_VISIT_GROUP_METADATA_KEY_SET = set(_VISIT_GROUP_METADATA_KEYS)
_VISIT_SCOPED_KEY_SET = set(_VISIT_SCOPED_KEYS)
_VISIT_DATE_TOKEN_PATTERN = re.compile(
    r"(?P<iso>\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b)|"
    r"(?P<dmy>\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b)",
    re.IGNORECASE,
)
_VISIT_CONTEXT_PATTERN = re.compile(
    r"\b(visita|consulta|control|revisi[oó]n|seguimiento|ingreso|alta)\b",
    re.IGNORECASE,
)
_NON_VISIT_DATE_CONTEXT_PATTERN = re.compile(
    r"\b(nacimiento|dob|microchip|chip|factura|invoice|informe|emisi[oó]n|documento)\b",
    re.IGNORECASE,
)


def _normalize_visit_date_candidate(value: object) -> str | None:
    if not isinstance(value, str):
        return None

    raw_value = value.strip()
    if not raw_value:
        return None

    candidates = [raw_value]
    for match in _VISIT_DATE_TOKEN_PATTERN.finditer(raw_value):
        token = match.group(0)
        if token:
            candidates.append(token)

    seen_tokens: set[str] = set()
    for candidate in candidates:
        token = candidate.strip()
        if not token:
            continue
        token_key = token.casefold()
        if token_key in seen_tokens:
            continue
        seen_tokens.add(token_key)

        normalized_token = token.replace("/", "-").replace(".", "-")
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d-%m-%y"):
            try:
                parsed = datetime.strptime(normalized_token, fmt)
            except ValueError:
                continue
            if fmt == "%d-%m-%y" and (parsed.year < 2000 or parsed.year > 2100):
                continue
            if parsed.year < 1900 or parsed.year > 2100:
                continue
            return parsed.date().isoformat()

    return None


def _extract_visit_date_candidates_from_text(*, text: object) -> list[str]:
    if not isinstance(text, str):
        return []

    snippet = text.strip()
    if not snippet:
        return []

    has_visit_context = _VISIT_CONTEXT_PATTERN.search(snippet) is not None
    has_non_visit_context = _NON_VISIT_DATE_CONTEXT_PATTERN.search(snippet) is not None
    if not has_visit_context or has_non_visit_context:
        return []

    dates: list[str] = []
    seen_dates: set[str] = set()
    for match in _VISIT_DATE_TOKEN_PATTERN.finditer(snippet):
        normalized_date = _normalize_visit_date_candidate(match.group(0))
        if normalized_date is None or normalized_date in seen_dates:
            continue
        seen_dates.add(normalized_date)
        dates.append(normalized_date)
    return dates


def _contains_any_date_token(*, text: object) -> bool:
    if not isinstance(text, str):
        return False
    return _VISIT_DATE_TOKEN_PATTERN.search(text) is not None


def _extract_evidence_snippet(field: dict[str, object]) -> str | None:
    evidence = field.get("evidence")
    if not isinstance(evidence, dict):
        return None
    snippet = evidence.get("snippet")
    return snippet if isinstance(snippet, str) else None
