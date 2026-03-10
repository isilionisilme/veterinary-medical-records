from __future__ import annotations

import re
from collections import defaultdict

from .constants import (
    _ADDRESS_LIKE_PATTERN,
    _MICROCHIP_DIGITS_PATTERN,
    _OWNER_CONTEXT_PATTERN,
    _VET_OR_CLINIC_CONTEXT_PATTERN,
    _WHITESPACE_PATTERN,
    COVERAGE_CONFIDENCE_FALLBACK,
    COVERAGE_CONFIDENCE_LABEL,
)
from .date_parsing import _normalize_person_fragment, _split_owner_before_address_tokens
from .field_patterns import AddressPatterns, ClinicPatterns, OwnerPatterns, WeightPatterns

_OWNER_CONTEXT_RE = _OWNER_CONTEXT_PATTERN
_OWNER_ADDRESS_CONTEXT_RE = OwnerPatterns.ADDRESS_CONTEXT_RE
_CLINIC_ADDRESS_CONTEXT_RE = ClinicPatterns.ADDRESS_CONTEXT_RE
_WEIGHT_EXPLICIT_CONTEXT_RE = WeightPatterns.EXPLICIT_CONTEXT_RE
_WEIGHT_DOSAGE_GUARD_RE = WeightPatterns.DOSAGE_GUARD_RE
_WEIGHT_LAB_GUARD_RE = WeightPatterns.LAB_GUARD_RE
_WEIGHT_PRICE_GUARD_RE = WeightPatterns.PRICE_GUARD_RE
_AMBIGUOUS_ADDRESS_CONTEXT_WINDOW_LINES = AddressPatterns.AMBIGUOUS_CONTEXT_WINDOW_LINES


class CandidateCollector:
    def __init__(self, raw_text: str) -> None:
        self.raw_text = raw_text
        self.compact_text = _WHITESPACE_PATTERN.sub(" ", raw_text).strip()
        self.lines: list[str] = [line.strip() for line in raw_text.splitlines() if line.strip()]
        self.candidates: dict[str, list[dict[str, object]]] = defaultdict(list)
        self.seen_values: dict[str, set[str]] = defaultdict(set)

    def _line_index_for_snippet(self, snippet: str) -> int | None:
        first_line = snippet.splitlines()[0].strip() if snippet else ""
        if not first_line:
            return None
        for idx, line in enumerate(self.lines):
            if line == first_line:
                return idx
        return None

    def _classify_address_context(self, line_index: int) -> str:
        start = max(0, line_index - _AMBIGUOUS_ADDRESS_CONTEXT_WINDOW_LINES)
        end = min(len(self.lines), line_index + _AMBIGUOUS_ADDRESS_CONTEXT_WINDOW_LINES + 1)
        context_lines = self.lines[start:line_index] + self.lines[line_index + 1 : end]
        context_text = " ".join(context_lines).casefold()

        owner_hits = bool(_OWNER_ADDRESS_CONTEXT_RE.search(context_text))
        clinic_hits = bool(_CLINIC_ADDRESS_CONTEXT_RE.search(context_text))
        if owner_hits and not clinic_hits:
            return "owner"
        if clinic_hits and not owner_hits:
            return "clinic"
        return "ambiguous"

    def _validate_microchip_id(self, cleaned_value: str, snippet: str) -> str | None:
        digit_match = _MICROCHIP_DIGITS_PATTERN.search(cleaned_value)
        if digit_match is None:
            return None
        cleaned_value = digit_match.group(1)
        safe_collapsed = re.sub(r"[\s\-.]", "", snippet)
        if cleaned_value not in safe_collapsed:
            return None
        return cleaned_value

    def _validate_owner_name(self, cleaned_value: str, snippet: str) -> str | None:
        cleaned_value = _split_owner_before_address_tokens(cleaned_value)
        normalized_person = _normalize_person_fragment(cleaned_value)
        if normalized_person is None:
            return None
        if _VET_OR_CLINIC_CONTEXT_PATTERN.search(snippet) is not None:
            return None
        return normalized_person

    def _validate_vet_name(self, cleaned_value: str) -> str | None:
        normalized_person = _normalize_person_fragment(cleaned_value)
        if normalized_person is None:
            return None
        if _ADDRESS_LIKE_PATTERN.search(normalized_person):
            return None
        return normalized_person

    def _validate_clinic_name(self, cleaned_value: str, snippet: str) -> str | None:
        snippet_folded = snippet.casefold()
        if (
            "dirección" in snippet_folded
            or "direccion" in snippet_folded
            or "domicilio" in snippet_folded
        ):
            return None
        compact_clinic = cleaned_value.casefold()
        if _ADDRESS_LIKE_PATTERN.search(compact_clinic) and re.search(r"\d", compact_clinic):
            return None
        return cleaned_value

    def _validate_clinic_address(self, cleaned_value: str, snippet: str) -> str | None:
        snippet_folded = snippet.casefold()
        has_owner_context = _OWNER_CONTEXT_RE.search(snippet_folded) is not None
        has_clinic_context = _CLINIC_ADDRESS_CONTEXT_RE.search(snippet_folded) is not None
        if has_owner_context and not has_clinic_context:
            return None
        has_generic_address_label = bool(
            re.search(r"\b(?:direcci[oó]n|domicilio|dir\.?)\s*[:\-]", snippet_folded)
        )
        has_explicit_clinic_label = bool(
            re.search(r"\b(?:direcci[oó]n|domicilio)\s+de\s+la\s+cl[ií]nica\b", snippet_folded)
        )
        if has_generic_address_label and not has_explicit_clinic_label:
            line_index = self._line_index_for_snippet(snippet)
            if line_index is not None:
                prev_context = " ".join(self.lines[max(0, line_index - 2) : line_index]).casefold()
                if _OWNER_CONTEXT_RE.search(prev_context):
                    return None
        return cleaned_value

    def _validate_owner_address(self, cleaned_value: str, snippet: str) -> str | None:
        snippet_folded = snippet.casefold()
        has_owner_context = _OWNER_ADDRESS_CONTEXT_RE.search(snippet_folded) is not None
        has_clinic_context = _CLINIC_ADDRESS_CONTEXT_RE.search(snippet_folded) is not None
        if has_clinic_context and not has_owner_context:
            return None
        return cleaned_value

    def _validate_weight(self, cleaned_value: str, snippet: str) -> str | None:
        explicit_weight_context = _WEIGHT_EXPLICIT_CONTEXT_RE.search(snippet) is not None
        has_dosage_units = _WEIGHT_DOSAGE_GUARD_RE.search(snippet) is not None
        has_lab_units = _WEIGHT_LAB_GUARD_RE.search(snippet) is not None
        has_price_tokens = _WEIGHT_PRICE_GUARD_RE.search(snippet) is not None
        if (has_dosage_units or has_lab_units or has_price_tokens) and not explicit_weight_context:
            return None
        return cleaned_value

    def _validate_and_clean(self, key: str, value: str, snippet: str) -> str | None:
        cleaned_value = value.strip(" .,:;\t\r\n")
        if not cleaned_value:
            return None
        if key == "microchip_id":
            return self._validate_microchip_id(cleaned_value, snippet)
        if key == "owner_name":
            return self._validate_owner_name(cleaned_value, snippet)
        if key == "vet_name":
            return self._validate_vet_name(cleaned_value)
        if key == "clinic_name":
            return self._validate_clinic_name(cleaned_value, snippet)
        if key == "clinic_address":
            return self._validate_clinic_address(cleaned_value, snippet)
        if key == "owner_address":
            return self._validate_owner_address(cleaned_value, snippet)
        if key == "weight":
            return self._validate_weight(cleaned_value, snippet)
        return cleaned_value

    def add_candidate(
        self,
        *,
        key: str,
        value: str,
        confidence: float,
        snippet: str,
        page: int | None = 1,
        anchor: str | None = None,
        anchor_priority: int = 0,
        target_reason: str | None = None,
    ) -> None:
        cleaned_value = self._validate_and_clean(key, value, snippet)
        if cleaned_value is None:
            return

        normalized_key = cleaned_value.casefold()
        if normalized_key in self.seen_values[key]:
            return
        self.seen_values[key].add(normalized_key)

        effective_confidence = (
            COVERAGE_CONFIDENCE_LABEL
            if confidence >= COVERAGE_CONFIDENCE_LABEL
            else COVERAGE_CONFIDENCE_FALLBACK
        )
        normalized_snippet = snippet.strip()
        snippet_offset = self.raw_text.rfind(normalized_snippet) if normalized_snippet else -1
        self.candidates[key].append(
            {
                "value": cleaned_value,
                "confidence": round(min(max(effective_confidence, 0.0), 1.0), 2),
                "anchor": anchor,
                "anchor_priority": anchor_priority,
                "target_reason": target_reason,
                "evidence": {
                    "page": page,
                    "snippet": normalized_snippet[:220],
                    "offset": snippet_offset,
                },
            }
        )

    def add_basic_payloads(self, payloads: list[dict[str, object]]) -> None:
        for payload in payloads:
            self.add_candidate(
                key=str(payload["key"]),
                value=str(payload["value"]),
                confidence=float(payload["confidence"]),
                snippet=str(payload["snippet"]),
            )
