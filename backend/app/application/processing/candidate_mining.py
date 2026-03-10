"""Candidate mining: text -> structured candidate extraction for interpretation."""

from __future__ import annotations

import re
from collections.abc import Mapping

from backend.app.application.global_schema import GLOBAL_SCHEMA_KEYS, REPEATABLE_KEYS

from .candidate_collector import CandidateCollector
from .candidate_field_extractors import (
    _extract_classified_date_candidates,
    _run_domain_extractors,
    _seed_base_candidates,
)
from .constants import (
    _ADDRESS_LIKE_PATTERN,
    _ADDRESS_SPLIT_PATTERN,
    _DATE_CANDIDATE_PATTERN,
    _MICROCHIP_DIGITS_PATTERN,
    _OWNER_CONTEXT_PATTERN,
    DATE_TARGET_KEYS,
)
from .field_patterns import ClinicPatterns, OwnerPatterns, WeightPatterns

_OWNER_CONTEXT_RE = _OWNER_CONTEXT_PATTERN
_OWNER_ADDRESS_CONTEXT_RE = OwnerPatterns.ADDRESS_CONTEXT_RE
_CLINIC_ADDRESS_CONTEXT_RE = ClinicPatterns.ADDRESS_CONTEXT_RE
_CLINIC_ADDRESS_START_RE = ClinicPatterns.ADDRESS_START_RE
_WEIGHT_MED_OR_LAB_CONTEXT_RE = WeightPatterns.MED_OR_LAB_CONTEXT_RE


def _coerce_float(value: object, default: float = 0.0) -> float:
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return default
    return default


def _mine_interpretation_candidates(raw_text: str) -> dict[str, list[dict[str, object]]]:
    collector = CandidateCollector(raw_text)
    _seed_base_candidates(collector, raw_text)
    _extract_classified_date_candidates(collector, raw_text)
    _run_domain_extractors(collector)
    return dict(collector.candidates)


def _map_candidates_to_global_schema(
    candidate_bundle: Mapping[str, list[dict[str, object]]],
) -> tuple[dict[str, object], dict[str, list[dict[str, object]]]]:
    mapped: dict[str, object] = {}
    evidence_map: dict[str, list[dict[str, object]]] = {}

    for key in GLOBAL_SCHEMA_KEYS:
        key_candidates = sorted(
            candidate_bundle.get(key, []),
            key=lambda item: _candidate_sort_key(item, key),
            reverse=True,
        )

        if key in REPEATABLE_KEYS:
            selected = key_candidates[:3]
            mapped[key] = [
                str(item.get("value", "")).strip()
                for item in selected
                if str(item.get("value", "")).strip()
            ]
            evidence_map[key] = selected
            continue

        if key_candidates:
            top = key_candidates[0]
            mapped[key] = str(top.get("value", "")).strip() or None
            evidence_map[key] = [top]
        else:
            mapped[key] = None
            evidence_map[key] = []

    return mapped, evidence_map


def _microchip_candidate_sort_key(
    item: dict[str, object], confidence: float
) -> tuple[float, float, float]:
    raw_value = str(item.get("value", "")).strip()
    evidence = item.get("evidence")
    snippet = ""
    if isinstance(evidence, dict):
        snippet_value = evidence.get("snippet")
        if isinstance(snippet_value, str):
            snippet = snippet_value
    lowered_snippet = snippet.casefold()

    context_quality = 0.0
    if re.search(
        r"\b(?:microchip|micr0chip|chip|transponder|identificaci[oó]n\s+electr[oó]nica)\b",
        lowered_snippet,
    ):
        context_quality += 0.5
    if re.search(r"\b(?:tel(?:[eé]fono)?|movil|m[oó]vil|nif|dni)\b", lowered_snippet):
        context_quality -= 0.5

    if _MICROCHIP_DIGITS_PATTERN.fullmatch(raw_value):
        return 2.0 + context_quality, confidence, -1.0
    if _MICROCHIP_DIGITS_PATTERN.search(raw_value):
        return 1.0 + context_quality, confidence, -1.0
    return context_quality, confidence, -1.0


def _pet_name_candidate_sort_key(
    item: dict[str, object], confidence: float
) -> tuple[float, float, float]:
    raw_value = str(item.get("value", "")).strip()
    is_clean = bool(
        raw_value
        and not re.search(r"\d", raw_value)
        and not re.search(r"(?i)^(?:especie|raza|sexo|chip|fecha)", raw_value)
        and 2 <= len(raw_value) <= 40
    )
    return (1.0 if is_clean else 0.0), confidence, -1.0


def _clinic_name_candidate_sort_key(
    item: dict[str, object], confidence: float
) -> tuple[float, float, float]:
    raw_value = str(item.get("value", "")).strip()
    lower_value = raw_value.casefold()
    has_hv_abbrev = bool(re.search(r"\bh\.?\s*v\.?\b", lower_value))
    has_clinic_token = bool(
        re.search(r"\b(?:cl[ií]nic|veterinari|hospital|centro|vet|h\.?\s*v\.?)\b", lower_value)
    )
    looks_address_like = bool(_ADDRESS_LIKE_PATTERN.search(lower_value)) and bool(
        re.search(r"\d", lower_value)
    )
    if has_hv_abbrev and not looks_address_like:
        return 3.0, confidence, -1.0
    if has_clinic_token and not looks_address_like:
        return 2.0, confidence, -1.0
    if has_clinic_token:
        return 1.0, confidence, -1.0
    return 0.0, confidence, -1.0


def _clinic_address_candidate_sort_key(
    item: dict[str, object], confidence: float
) -> tuple[float, float, float]:
    raw_value = str(item.get("value", "")).strip()
    evidence = item.get("evidence")
    snippet = ""
    if isinstance(evidence, dict):
        snippet_value = evidence.get("snippet")
        if isinstance(snippet_value, str):
            snippet = snippet_value

    folded_value = raw_value.casefold()
    folded_snippet = snippet.casefold()
    has_owner_context = bool(_OWNER_CONTEXT_RE.search(folded_snippet))
    has_address_token = bool(_CLINIC_ADDRESS_START_RE.search(raw_value))
    has_postal = bool(re.search(r"\b\d{5}\b", raw_value)) or "cp" in folded_value
    is_multiline = "\n" in snippet

    quality = 0.0
    if has_owner_context:
        quality -= 2.0
    if has_address_token:
        quality += 1.0
    if has_postal:
        quality += 1.0
    if is_multiline:
        quality += 0.5
    return quality, confidence, -1.0


def _owner_address_candidate_sort_key(
    item: dict[str, object], confidence: float
) -> tuple[float, float, float]:
    raw_value = str(item.get("value", "")).strip()
    evidence = item.get("evidence")
    snippet = ""
    if isinstance(evidence, dict):
        snippet_value = evidence.get("snippet")
        if isinstance(snippet_value, str):
            snippet = snippet_value

    folded_value = raw_value.casefold()
    folded_snippet = snippet.casefold()
    has_owner_context = bool(_OWNER_ADDRESS_CONTEXT_RE.search(folded_snippet))
    has_clinic_context = bool(_CLINIC_ADDRESS_CONTEXT_RE.search(folded_snippet))
    has_explicit_address_token = bool(_ADDRESS_SPLIT_PATTERN.search(folded_value))
    has_postal = bool(re.search(r"\b\d{5}\b", raw_value)) or "cp" in folded_value
    has_digits = bool(re.search(r"\d", raw_value))
    looks_like_date_only = bool(
        re.fullmatch(r"\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}", raw_value.strip())
    )

    quality = 0.0
    if has_owner_context:
        quality += 2.0
    if has_clinic_context and not has_owner_context:
        quality -= 2.0
    if has_explicit_address_token:
        quality += 1.5
    else:
        quality -= 1.0
    if has_postal:
        quality += 0.5
    if has_digits:
        quality += 0.5
    if looks_like_date_only:
        quality -= 2.0
    return quality, confidence, -1.0


def _weight_candidate_sort_key(
    item: dict[str, object], confidence: float
) -> tuple[float, float, float]:
    evidence = item.get("evidence")
    snippet = ""
    offset = -1.0
    if isinstance(evidence, dict):
        snippet_value = evidence.get("snippet")
        if isinstance(snippet_value, str):
            snippet = snippet_value
        offset_value = evidence.get("offset")
        if isinstance(offset_value, int | float):
            offset = float(offset_value)

    weight_quality = 0.0
    if _DATE_CANDIDATE_PATTERN.search(snippet) is not None:
        weight_quality += 1.0
    if _WEIGHT_MED_OR_LAB_CONTEXT_RE.search(snippet) is not None:
        weight_quality -= 0.5
    return weight_quality, confidence, offset


def _candidate_sort_key(item: dict[str, object], key: str) -> tuple[float, float, float]:
    confidence = _coerce_float(item.get("confidence", 0.0))
    if key in DATE_TARGET_KEYS:
        return _coerce_float(item.get("anchor_priority", 0)), confidence, -1.0
    if key == "microchip_id":
        return _microchip_candidate_sort_key(item, confidence)
    if key == "pet_name":
        return _pet_name_candidate_sort_key(item, confidence)
    if key == "clinic_name":
        return _clinic_name_candidate_sort_key(item, confidence)
    if key == "clinic_address":
        return _clinic_address_candidate_sort_key(item, confidence)
    if key == "owner_address":
        return _owner_address_candidate_sort_key(item, confidence)
    if key == "weight":
        return _weight_candidate_sort_key(item, confidence)
    return 0.0, confidence, -1.0
