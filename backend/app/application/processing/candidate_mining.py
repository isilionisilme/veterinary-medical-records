"""Candidate mining: text -> structured candidate extraction for interpretation."""

from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Mapping

from backend.app.application.field_normalizers import SPECIES_TOKEN_TO_CANONICAL
from backend.app.application.global_schema import GLOBAL_SCHEMA_KEYS, REPEATABLE_KEYS

from .constants import (
    _ADDRESS_LIKE_PATTERN,
    _ADDRESS_SPLIT_PATTERN,
    _DATE_CANDIDATE_PATTERN,
    _MICROCHIP_DIGITS_PATTERN,
    _OWNER_CONTEXT_PATTERN,
    _VET_OR_CLINIC_CONTEXT_PATTERN,
    _WHITESPACE_PATTERN,
    COVERAGE_CONFIDENCE_FALLBACK,
    COVERAGE_CONFIDENCE_LABEL,
    DATE_TARGET_KEYS,
)
from .date_parsing import (
    _normalize_person_fragment,
    _split_owner_before_address_tokens,
    extract_clinical_record_candidates,
    extract_date_candidates_with_classification,
    extract_labeled_person_candidates,
    extract_microchip_adjacent_line_candidates,
    extract_microchip_keyword_candidates,
    extract_ocr_microchip_candidates,
    extract_owner_nombre_candidates,
    extract_regex_labeled_candidates,
    extract_timeline_document_date_candidates,
    extract_unanchored_document_date_candidates,
    extract_unlabeled_header_dob_candidates,
)
from .field_patterns import (
    AddressPatterns,
    ClinicPatterns,
    FieldLabelPatterns,
    OwnerPatterns,
    PetNamePatterns,
    WeightPatterns,
)

_OWNER_CONTEXT_RE = _OWNER_CONTEXT_PATTERN
_PET_NAME_GUARD_RE = PetNamePatterns.GUARD_RE
_PET_NAME_BIRTHLINE_RE = PetNamePatterns.BIRTHLINE_RE
_CLINIC_CONTEXT_LINE_RE = ClinicPatterns.CONTEXT_LINE_RE
_CLINIC_STANDALONE_LINE_RE = ClinicPatterns.STANDALONE_LINE_RE
_CLINIC_HEADER_ADDRESS_CONTEXT_RE = ClinicPatterns.HEADER_ADDRESS_CONTEXT_RE
_CLINIC_HEADER_SECTION_CONTEXT_RE = ClinicPatterns.HEADER_SECTION_CONTEXT_RE
_CLINIC_HEADER_GENERIC_BLACKLIST = ClinicPatterns.HEADER_GENERIC_BLACKLIST
_CLINIC_ADDRESS_LABEL_LINE_RE = FieldLabelPatterns.CLINIC_ADDRESS_LABEL_LINE_RE
_AMBIGUOUS_ADDRESS_LABEL_LINE_RE = FieldLabelPatterns.AMBIGUOUS_ADDRESS_LABEL_LINE_RE
_OWNER_ADDRESS_LABEL_LINE_RE = FieldLabelPatterns.OWNER_ADDRESS_LABEL_LINE_RE
_CLINIC_ADDRESS_START_RE = ClinicPatterns.ADDRESS_START_RE
_CLINIC_OR_HOSPITAL_CONTEXT_RE = ClinicPatterns.OR_HOSPITAL_CONTEXT_RE
_OWNER_ADDRESS_CONTEXT_RE = OwnerPatterns.ADDRESS_CONTEXT_RE
_OWNER_HEADER_RE = OwnerPatterns.HEADER_RE
_OWNER_NAME_LIKE_LINE_RE = OwnerPatterns.NAME_LIKE_LINE_RE
_OWNER_LOCALITY_LINE_RE = OwnerPatterns.LOCALITY_LINE_RE
_OWNER_LOCALITY_SECTION_BLACKLIST = OwnerPatterns.LOCALITY_SECTION_BLACKLIST
_OWNER_BLOCK_IDENTIFICATION_CONTEXT_RE = OwnerPatterns.BLOCK_IDENTIFICATION_CONTEXT_RE
_CLINIC_ADDRESS_CONTEXT_RE = ClinicPatterns.ADDRESS_CONTEXT_RE
_POSTAL_HINT_RE = AddressPatterns.POSTAL_HINT_RE
_SIMPLE_FIELD_LABEL_RE = FieldLabelPatterns.SIMPLE_FIELD_LABEL_RE
_HEADER_BLOCK_SCAN_WINDOW = ClinicPatterns.HEADER_BLOCK_SCAN_WINDOW
_AMBIGUOUS_ADDRESS_CONTEXT_WINDOW_LINES = AddressPatterns.AMBIGUOUS_CONTEXT_WINDOW_LINES
_WEIGHT_EXPLICIT_CONTEXT_RE = WeightPatterns.EXPLICIT_CONTEXT_RE
_WEIGHT_DOSAGE_GUARD_RE = WeightPatterns.DOSAGE_GUARD_RE
_WEIGHT_LAB_GUARD_RE = WeightPatterns.LAB_GUARD_RE
_WEIGHT_PRICE_GUARD_RE = WeightPatterns.PRICE_GUARD_RE
_WEIGHT_MED_OR_LAB_CONTEXT_RE = WeightPatterns.MED_OR_LAB_CONTEXT_RE
_WEIGHT_STANDALONE_LINE_RE = WeightPatterns.STANDALONE_LINE_RE
_VISIT_TIMELINE_CONTEXT_RE = WeightPatterns.VISIT_TIMELINE_CONTEXT_RE
_PET_NAME_STOPWORDS_UPPER = {
    "DATOS",
    "CLIENTE",
    "NOMBRE",
    "ESPECIE",
    "RAZA",
    "SEXO",
    "CHIP",
    "HISTORIAL",
    "VISITA",
}
_PET_NAME_STOPWORDS_LOWER = {
    s.casefold()
    for s in (
        *_PET_NAME_STOPWORDS_UPPER,
        "nº chip",
        "n° chip",
        "no chip",
        "nº historial",
        "fecha",
        "paciente",
        "propietario",
        "propietaria",
        "veterinario",
        "veterinaria",
        "diagnóstico",
        "diagnostico",
        "tratamiento",
        "medicación",
        "medicacion",
        "vacunación",
        "vacunacion",
    )
}
_BREED_KEYWORDS = (
    "labrador",
    "retriever",
    "bulldog",
    "pastor",
    "yorkshire",
    "mestiz",
    "beagle",
    "caniche",
)


class CandidateCollector:
    """Accumulates candidate extractions with dedup and per-field validation."""

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

        normalized_value = digit_match.group(1)
        safe_collapsed = re.sub(r"[\s\-.]", "", snippet)
        if normalized_value not in safe_collapsed:
            return None
        return normalized_value

    def _validate_owner_name(self, cleaned_value: str, snippet: str) -> str | None:
        owner_value = _split_owner_before_address_tokens(cleaned_value)
        normalized_person = _normalize_person_fragment(owner_value)
        if normalized_person is None:
            return None
        if _VET_OR_CLINIC_CONTEXT_PATTERN.search(snippet) is not None:
            return None
        return normalized_person

    def _validate_vet_name(self, cleaned_value: str, _: str) -> str | None:
        normalized_person = _normalize_person_fragment(cleaned_value)
        if normalized_person is None:
            return None
        if _ADDRESS_LIKE_PATTERN.search(normalized_person):
            return None
        return normalized_person

    def _validate_clinic_name(self, cleaned_value: str, snippet: str) -> str | None:
        snippet_folded = snippet.casefold()
        if "dirección" in snippet_folded or "direccion" in snippet_folded:
            return None
        if "domicilio" in snippet_folded:
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
        """Return cleaned value if it passes per-field validation, or None to discard."""
        cleaned_value = value.strip(" .,:;\t\r\n")
        if not cleaned_value:
            return None
        validators: dict[str, callable[[str, str], str | None]] = {
            "microchip_id": self._validate_microchip_id,
            "owner_name": self._validate_owner_name,
            "vet_name": self._validate_vet_name,
            "clinic_name": self._validate_clinic_name,
            "clinic_address": self._validate_clinic_address,
            "owner_address": self._validate_owner_address,
            "weight": self._validate_weight,
        }
        validator = validators.get(key)
        return validator(cleaned_value, snippet) if validator is not None else cleaned_value

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


def _extract_labeled_field_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    """Extract candidates from header:value lines and keyword heuristics."""
    add_candidate = collector.add_candidate

    for line in lines:
        header, value = _split_header_value_line(line)
        lower_header = header.casefold()
        if value:
            _extract_inline_owner_address_candidate(add_candidate, lower_header, value, line)
            _extract_header_value_field_candidates(add_candidate, lower_header, value, line)

        lower_line = line.casefold()
        _extract_unlabeled_field_candidates(add_candidate, lower_line, line)


def _extract_sex_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    """Extract sex candidates from direct mentions and sexo-context tokens."""
    add_candidate = collector.add_candidate

    for index, line in enumerate(lines):
        lower_line = line.casefold()
        normalized_single = _WHITESPACE_PATTERN.sub(" ", lower_line).strip()

        if any(token in lower_line for token in ("macho", "hembra", "male", "female")):
            if "macho" in lower_line or "male" in lower_line:
                add_candidate(
                    key="sex",
                    value="macho",
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=line,
                )
            if "hembra" in lower_line or "female" in lower_line:
                add_candidate(
                    key="sex",
                    value="hembra",
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=line,
                )

        if normalized_single in {"m", "macho", "male", "h", "hembra", "female"}:
            window = " ".join(lines[max(0, index - 1) : min(len(lines), index + 2)]).casefold()
            if "sexo" in window:
                sex_value = "macho" if normalized_single in {"m", "macho", "male"} else "hembra"
                add_candidate(
                    key="sex",
                    value=sex_value,
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=" ".join(lines[max(0, index - 1) : min(len(lines), index + 2)]),
                )


def _extract_species_breed_candidates(
    collector: CandidateCollector,
    lines: list[str],
    species_keywords: dict[str, str],
    breed_keywords: tuple[str, ...],
) -> None:
    """Extract species and breed candidates from normalized single-line matches."""
    add_candidate = collector.add_candidate

    for line in lines:
        lower_line = line.casefold()
        normalized_single = _WHITESPACE_PATTERN.sub(" ", lower_line).strip()

        if normalized_single in species_keywords:
            add_candidate(
                key="species",
                value=species_keywords[normalized_single],
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )

        if any(keyword in lower_line for keyword in breed_keywords) and len(line) <= 80:
            add_candidate(
                key="breed",
                value=line,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )


def _extract_clinic_header_candidate(
    collector: CandidateCollector,
    lines: list[str],
    pet_name_stop_lower: set[str],
) -> None:
    """Extract clinic_name from an institutional uppercase first line."""
    if not lines:
        return
    clinic_header = lines[0]
    clinic_header_folded = clinic_header.casefold()
    has_numeric = re.search(r"\d", clinic_header) is not None
    header_looks_institutional = (
        clinic_header.isupper()
        and 3 <= len(clinic_header) <= 60
        and ":" not in clinic_header
        and not has_numeric
        and "-" not in clinic_header
        and clinic_header not in _CLINIC_HEADER_GENERIC_BLACKLIST
        and clinic_header_folded not in pet_name_stop_lower
    )
    if not header_looks_institutional:
        return
    context_lines = lines[1:8]
    context_compact = " ".join(context_lines)
    has_address_context = (
        _CLINIC_HEADER_ADDRESS_CONTEXT_RE.search(context_compact) is not None
        or re.search(r"\b\d{5}\b", context_compact) is not None
    )
    has_section_context = _CLINIC_HEADER_SECTION_CONTEXT_RE.search(context_compact) is not None
    if has_address_context and has_section_context:
        collector.add_candidate(
            key="clinic_name",
            value=clinic_header,
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet="\n".join(lines[:4]),
        )


def _extract_clinic_address_block_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    """Extract clinic_address from 3-line header blocks with address + postal hints."""
    add_candidate = collector.add_candidate
    max_header_scan = min(len(lines) - 2, _HEADER_BLOCK_SCAN_WINDOW)
    for index in range(max_header_scan):
        first_line = lines[index]
        second_line = lines[index + 1]
        third_line = lines[index + 2]
        if _CLINIC_ADDRESS_START_RE.search(first_line) is None:
            continue
        if _SIMPLE_FIELD_LABEL_RE.match(first_line) is not None:
            continue
        if _SIMPLE_FIELD_LABEL_RE.match(second_line) is not None:
            continue
        if _POSTAL_HINT_RE.search(third_line) is None:
            continue
        if _CLINIC_HEADER_SECTION_CONTEXT_RE.search(second_line.casefold()) is not None:
            continue
        if _CLINIC_HEADER_SECTION_CONTEXT_RE.search(third_line.casefold()) is not None:
            continue
        if not (re.search(r"\d", first_line) or re.search(r"\d", second_line)):
            continue
        owner_block_context = " ".join(
            lines[max(0, index - 1) : min(len(lines), index + 4)]
        ).casefold()
        if _OWNER_CONTEXT_RE.search(owner_block_context) is not None:
            continue

        candidate_value = " ".join(
            part.strip(" .,:;\t\r\n") for part in (first_line, second_line, third_line)
        )
        add_candidate(
            key="clinic_address",
            value=candidate_value,
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet="\n".join(lines[index : min(len(lines), index + 4)]),
        )


def _extract_clinic_context_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    """Extract clinic_name and clinic_address from context and standalone patterns."""
    add_candidate = collector.add_candidate
    for index, line in enumerate(lines):
        # Clinic address following clinic context
        if _CLINIC_ADDRESS_START_RE.search(line) is not None and re.search(r"\d", line):
            previous_line = lines[index - 1] if index > 0 else ""
            previous_folded = previous_line.casefold()
            owner_nearby = _OWNER_CONTEXT_RE.search(previous_folded) is not None
            clinic_context_nearby = (
                _CLINIC_OR_HOSPITAL_CONTEXT_RE.search(previous_folded) is not None
            )
            if clinic_context_nearby and not owner_nearby and ":" not in line:
                candidate_value = line.strip(" .,:;\t\r\n")
                if candidate_value:
                    add_candidate(
                        key="clinic_address",
                        value=candidate_value,
                        confidence=COVERAGE_CONFIDENCE_FALLBACK,
                        snippet="\n".join(lines[max(0, index - 1) : min(len(lines), index + 2)]),
                    )

        clinic_context_match = _CLINIC_CONTEXT_LINE_RE.search(line)
        if clinic_context_match is not None:
            institution_token = clinic_context_match.group(1)
            institution_name = clinic_context_match.group(2).strip(" .,:;\t\r\n")
            canonical_institution = (
                "Centro" if institution_token.casefold() == "centr0" else institution_token
            )
            clinic_candidate = f"{canonical_institution} {institution_name}".strip()
            add_candidate(
                key="clinic_name",
                value=clinic_candidate,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )

        clinic_standalone_match = _CLINIC_STANDALONE_LINE_RE.match(line)
        if clinic_standalone_match is not None:
            institution_token = clinic_standalone_match.group(1).strip()
            institution_name = clinic_standalone_match.group(2).strip(" .,:;\t\r\n")
            lowered_name = institution_name.casefold()
            if not lowered_name.startswith("de "):
                canonical_institution = institution_token
                if re.fullmatch(r"(?i)h\.?\s*v\.?", institution_token):
                    canonical_institution = "HV"
                clinic_candidate = f"{canonical_institution} {institution_name}".strip()
                add_candidate(
                    key="clinic_name",
                    value=clinic_candidate,
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=line,
                )


def _extract_clinic_candidates(
    collector: CandidateCollector,
    lines: list[str],
    pet_name_stop_lower: set[str],
) -> None:
    """Extract all clinic_name and clinic_address candidates."""
    _extract_clinic_header_candidate(collector, lines, pet_name_stop_lower)
    _extract_clinic_address_block_candidates(collector, lines)
    _extract_clinic_context_candidates(collector, lines)


def _extract_owner_address_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    """Extract owner_address from name+adjacent address and labeled address patterns."""
    _extract_adjacent_owner_address_candidates(collector, lines)
    _extract_labeled_owner_address_candidates(collector, lines)


def _extract_labeled_address_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    """Extract clinic_address / owner_address from labeled address lines."""
    for index, line in enumerate(lines):
        address_label_match = _CLINIC_ADDRESS_LABEL_LINE_RE.match(line)
        if address_label_match is None:
            continue

        raw_label = address_label_match.group(1).strip().casefold()
        inline_value = (address_label_match.group(2) or "").strip(" .,:;\t\r\n")
        explicit_clinic_label = "cl\u00ednica" in raw_label or "clinica" in raw_label
        address_parts = _collect_multiline_labeled_address_parts(lines, index, inline_value)
        if not address_parts:
            continue

        candidate_value = " ".join(part for part in address_parts if part)
        snippet_block = "\n".join(lines[index : min(len(lines), index + 3)])
        _route_labeled_address_candidate(
            collector,
            line,
            index,
            candidate_value,
            snippet_block,
            explicit_clinic_label,
        )


def _extract_pet_name_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    """Extract pet_name candidates from birthline and unlabeled name heuristics."""
    add_candidate = collector.add_candidate

    for index, line in enumerate(lines):
        birthline_match = _PET_NAME_BIRTHLINE_RE.match(line)
        if birthline_match:
            candidate_name = _WHITESPACE_PATTERN.sub(" ", birthline_match.group(1)).strip()
            token_count = len(candidate_name.split())
            if (
                1 <= token_count <= 3
                and candidate_name.casefold() not in _PET_NAME_STOPWORDS_LOWER
                and not _PET_NAME_GUARD_RE.search(candidate_name)
            ):
                nearby = " ".join(lines[index : min(len(lines), index + 4)]).casefold()
                if any(
                    token in nearby
                    for token in (
                        "canino",
                        "felino",
                        "raza",
                        "chip",
                        "especie",
                        "nacimiento",
                        "nac",
                    )
                ):
                    add_candidate(
                        key="pet_name",
                        value=candidate_name,
                        confidence=COVERAGE_CONFIDENCE_FALLBACK,
                        snippet=line,
                    )

        word_count = len(line.split())
        is_name_like = (
            2 < len(line) <= 40
            and 1 <= word_count <= 3
            and line not in _PET_NAME_STOPWORDS_UPPER
            and line.casefold() not in _PET_NAME_STOPWORDS_LOWER
            and (line.isupper() or line.istitle())
            and ":" not in line
            and not _PET_NAME_GUARD_RE.search(line)
        )
        if is_name_like:
            nearby = " ".join(lines[index : min(len(lines), index + 4)]).casefold()
            if any(token in nearby for token in ("canino", "felino", "raza", "chip", "especie")):
                add_candidate(
                    key="pet_name",
                    value=line.title(),
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=line,
                )


def _extract_weight_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    """Extract weight candidates from standalone weight lines with temporal context."""
    add_candidate = collector.add_candidate

    for index, line in enumerate(lines):
        standalone_weight_match = _WEIGHT_STANDALONE_LINE_RE.match(line)
        if standalone_weight_match is None:
            continue

        value_raw = standalone_weight_match.group(1)
        unit_raw = standalone_weight_match.group(2).lower()
        unit = "kg" if unit_raw in {"kg", "kgs"} else unit_raw
        candidate_value = f"{value_raw} {unit}".strip()

        context_start = max(0, index - 3)
        context_end = min(len(lines), index + 2)
        context_lines = lines[context_start:context_end]
        context_text = " ".join(context_lines)

        has_date_context = _DATE_CANDIDATE_PATTERN.search(context_text) is not None
        has_visit_context = _VISIT_TIMELINE_CONTEXT_RE.search(context_text) is not None
        is_compact_fragment = len(lines) <= 5

        if has_date_context or has_visit_context or is_compact_fragment:
            add_candidate(
                key="weight",
                value=candidate_value,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet="\n".join(context_lines),
            )


def _extract_language_candidates(
    collector: CandidateCollector,
    compact_text: str,
) -> None:
    """Infer language from compact clinical text when no explicit language exists."""
    add_candidate = collector.add_candidate

    if (
        compact_text
        and "language" not in collector.candidates
        and any(
            token in compact_text.casefold() for token in ("paciente", "diagnost", "tratamiento")
        )
    ):
        add_candidate(
            key="language",
            value="es",
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet="Heuristic language inference based on Spanish clinical tokens",
            page=None,
        )


def _seed_base_candidates(collector: CandidateCollector, raw_text: str) -> None:
    """Seed collector payloads from the raw-text helper extractors."""
    add_basic_payloads = collector.add_basic_payloads

    for payloads in (
        extract_labeled_person_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_owner_nombre_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_regex_labeled_candidates(raw_text),
        extract_microchip_keyword_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_microchip_adjacent_line_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_clinical_record_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_ocr_microchip_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_FALLBACK),
        extract_unlabeled_header_dob_candidates(
            raw_text,
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
        ),
        extract_unanchored_document_date_candidates(
            raw_text,
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
        ),
    ):
        add_basic_payloads(payloads)


def _extract_classified_date_candidates(
    collector: CandidateCollector,
    raw_text: str,
) -> None:
    """Add date candidates returned by the classified date extractor."""
    add_candidate = collector.add_candidate

    for date_candidate in extract_date_candidates_with_classification(raw_text):
        add_candidate(
            key=str(date_candidate["target_key"]),
            value=str(date_candidate["value"]),
            confidence=float(date_candidate["confidence"]),
            snippet=str(date_candidate["snippet"]),
            page=1,
            anchor=(str(date_candidate["anchor"]) if date_candidate.get("anchor") else None),
            anchor_priority=int(date_candidate["anchor_priority"]),
            target_reason=str(date_candidate["target_reason"]),
        )


def _extract_timeline_date_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    """Add timeline-derived document date candidates."""
    add_candidate = collector.add_candidate

    for payload in extract_timeline_document_date_candidates(
        lines,
        confidence=COVERAGE_CONFIDENCE_FALLBACK,
    ):
        add_candidate(
            key=str(payload["key"]),
            value=str(payload["value"]),
            confidence=float(payload["confidence"]),
            snippet=str(payload["snippet"]),
            target_reason=str(payload["target_reason"]),
        )


def _run_domain_extractors(collector: CandidateCollector) -> None:
    """Run domain extractors in the same semantic order as the original miner."""
    lines = collector.lines

    _extract_clinic_candidates(collector, lines, _PET_NAME_STOPWORDS_LOWER)
    _extract_labeled_field_candidates(collector, lines)
    _extract_sex_candidates(collector, lines)
    _extract_species_breed_candidates(collector, lines, SPECIES_TOKEN_TO_CANONICAL, _BREED_KEYWORDS)
    _extract_timeline_date_candidates(collector, lines)
    _extract_owner_address_candidates(collector, lines)
    _extract_labeled_address_candidates(collector, lines)
    _extract_pet_name_candidates(collector, lines)
    _extract_weight_candidates(collector, lines)
    _extract_language_candidates(collector, collector.compact_text)


def _split_header_value_line(line: str) -> tuple[str, str]:
    if ":" in line:
        return line.split(":", 1)
    if "-" in line:
        return line.split("-", 1)
    return "", ""


def _extract_inline_owner_address_candidate(
    add_candidate: callable[..., None],
    lower_header: str,
    value: str,
    line: str,
) -> None:
    if _OWNER_HEADER_RE.search(lower_header) is None:
        return

    owner_value = value.strip(" .,:;\t\r\n")
    address_start = _CLINIC_ADDRESS_START_RE.search(owner_value)
    if address_start is None:
        return

    address_fragment = owner_value[address_start.start() :].strip(" .,:;\t\r\n")
    if address_fragment:
        add_candidate(
            key="owner_address",
            value=address_fragment,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )


def _extract_header_value_field_candidates(
    add_candidate: callable[..., None],
    lower_header: str,
    value: str,
    line: str,
) -> None:
    if any(token in lower_header for token in ("diagn", "impresi")):
        add_candidate(
            key="diagnosis",
            value=value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )
    if any(token in lower_header for token in ("trat", "medic", "prescrip", "receta")):
        add_candidate(
            key="medication",
            value=value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )
        add_candidate(key="treatment_plan", value=value, confidence=0.7, snippet=line)
    if any(token in lower_header for token in ("proced", "interv", "cirug", "quir")):
        add_candidate(
            key="procedure",
            value=value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )
    if any(token in lower_header for token in ("sintom", "symptom")):
        add_candidate(
            key="symptoms",
            value=value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )
    if any(token in lower_header for token in ("vacun", "vaccin")):
        add_candidate(
            key="vaccinations",
            value=value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )
    if any(token in lower_header for token in ("laboratorio", "analit", "lab")):
        add_candidate(
            key="lab_result",
            value=value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )
    if any(token in lower_header for token in ("radiograf", "ecograf", "imagen", "tac", "rm")):
        add_candidate(
            key="imaging",
            value=value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )
    if any(token in lower_header for token in ("linea", "concepto", "item")):
        add_candidate(
            key="line_item",
            value=value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )


def _extract_unlabeled_field_candidates(
    add_candidate: callable[..., None],
    lower_line: str,
    line: str,
) -> None:
    if any(token in lower_line for token in ("diagn", "impresi")) and ":" not in line:
        add_candidate(key="diagnosis", value=line, confidence=0.64, snippet=line)
    if any(
        token in lower_line
        for token in ("amoxic", "clavul", "predni", "omepra", "antibiot", "mg", "cada")
    ):
        add_candidate(
            key="medication",
            value=line,
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet=line,
        )
    if any(
        token in lower_line for token in ("cirug", "proced", "sut", "cura", "ecograf", "radiograf")
    ):
        add_candidate(
            key="procedure",
            value=line,
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet=line,
        )


def _collect_multiline_labeled_address_parts(
    lines: list[str],
    index: int,
    inline_value: str,
) -> list[str]:
    address_parts: list[str] = []
    if inline_value:
        address_parts.append(inline_value)
    elif index + 1 < len(lines):
        next_line = lines[index + 1]
        if _SIMPLE_FIELD_LABEL_RE.match(next_line) is None:
            address_parts.append(next_line.strip(" .,:;\t\r\n"))

    if address_parts and index + 2 < len(lines):
        maybe_second_line = lines[index + 2]
        if (
            _SIMPLE_FIELD_LABEL_RE.match(maybe_second_line) is None
            and _POSTAL_HINT_RE.search(maybe_second_line) is not None
        ):
            address_parts.append(maybe_second_line.strip(" .,:;\t\r\n"))

    return address_parts


def _owner_address_pair_matches(lines: list[str], index: int) -> bool:
    owner_line = lines[index]
    address_line = lines[index + 1]
    if _SIMPLE_FIELD_LABEL_RE.match(owner_line) is not None:
        return False
    if _SIMPLE_FIELD_LABEL_RE.match(address_line) is not None:
        return False
    if _OWNER_NAME_LIKE_LINE_RE.match(owner_line) is None:
        return False
    if _ADDRESS_LIKE_PATTERN.search(address_line) is None:
        return False
    return re.search(r"\d", address_line) is not None


def _owner_address_context_is_valid(lines: list[str], index: int) -> bool:
    context_window = lines[max(0, index - 3) : min(len(lines), index + 4)]
    context_text = " ".join(context_window).casefold()
    has_owner_context = _OWNER_ADDRESS_CONTEXT_RE.search(context_text) is not None
    has_identification_context = (
        _OWNER_BLOCK_IDENTIFICATION_CONTEXT_RE.search(context_text) is not None
    )
    has_clinic_context = _CLINIC_ADDRESS_CONTEXT_RE.search(context_text) is not None

    if has_clinic_context and not has_owner_context:
        return False
    return has_owner_context or has_identification_context


def _collect_owner_address_tail_parts(lines: list[str], index: int) -> list[str]:
    address_parts = [lines[index + 1].strip(" .,:;\t\r\n")]
    tail_index = index + 2
    tail_limit = min(len(lines), index + 5)

    while tail_index < tail_limit:
        tail_line = lines[tail_index]
        if _SIMPLE_FIELD_LABEL_RE.match(tail_line) is not None:
            break

        tail_clean = tail_line.strip(" .,:;\t\r\n")
        if not tail_clean:
            break
        if re.match(r"^\s*-\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}", tail_line):
            break
        if _OWNER_NAME_LIKE_LINE_RE.match(tail_clean) is not None:
            break

        is_postal_like = _POSTAL_HINT_RE.search(tail_clean) is not None
        is_locality_like = _OWNER_LOCALITY_LINE_RE.fullmatch(tail_clean) is not None
        locality_tail = tail_clean.casefold().strip(" .,:;\t\r\n")
        if locality_tail in _OWNER_LOCALITY_SECTION_BLACKLIST:
            break
        if not (is_postal_like or is_locality_like):
            break

        address_parts.append(tail_clean)
        tail_index += 1

    return address_parts


def _extract_adjacent_owner_address_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    add_candidate = collector.add_candidate

    for index in range(len(lines) - 1):
        if not _owner_address_pair_matches(lines, index):
            continue
        if not _owner_address_context_is_valid(lines, index):
            continue

        candidate_value = " ".join(
            part for part in _collect_owner_address_tail_parts(lines, index) if part
        )
        if candidate_value:
            add_candidate(
                key="owner_address",
                value=candidate_value,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet="\n".join(lines[index : min(len(lines), index + 3)]),
            )


def _extract_labeled_owner_address_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    add_candidate = collector.add_candidate

    for index, line in enumerate(lines):
        owner_address_label_match = _OWNER_ADDRESS_LABEL_LINE_RE.match(line)
        if owner_address_label_match is None:
            continue

        inline_value = (owner_address_label_match.group(1) or "").strip(" .,:;\t\r\n")
        address_parts = _collect_multiline_labeled_address_parts(lines, index, inline_value)
        if address_parts:
            add_candidate(
                key="owner_address",
                value=" ".join(part for part in address_parts if part),
                confidence=COVERAGE_CONFIDENCE_LABEL,
                snippet="\n".join(lines[index : min(len(lines), index + 3)]),
            )


def _route_labeled_address_candidate(
    collector: CandidateCollector,
    line: str,
    index: int,
    candidate_value: str,
    snippet_block: str,
    explicit_clinic_label: bool,
) -> None:
    add_candidate = collector.add_candidate
    context_decision = collector._classify_address_context(index)
    is_ambiguous_generic_label = (
        not explicit_clinic_label and _AMBIGUOUS_ADDRESS_LABEL_LINE_RE.match(line) is not None
    )

    if explicit_clinic_label:
        add_candidate(
            key="clinic_address",
            value=candidate_value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=snippet_block,
        )
    elif context_decision == "owner" and is_ambiguous_generic_label:
        add_candidate(
            key="owner_address",
            value=candidate_value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=snippet_block,
        )
    elif context_decision == "clinic" and is_ambiguous_generic_label:
        add_candidate(
            key="clinic_address",
            value=candidate_value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=snippet_block,
        )
    else:
        add_candidate(
            key="clinic_address",
            value=candidate_value,
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet=snippet_block,
        )


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
    item: dict[str, object],
    confidence: float,
) -> tuple[float, float, float]:
    raw_value = str(item.get("value", "")).strip()
    lower_value = raw_value.casefold()
    has_hv_abbrev = bool(re.search(r"\bh\.?\s*v\.?\b", lower_value))
    has_clinic_token = bool(
        re.search(
            r"\b(?:cl[ií]nic|veterinari|hospital|centro|vet|h\.?\s*v\.?)\b",
            lower_value,
        )
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
    item: dict[str, object],
    confidence: float,
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
    item: dict[str, object],
    confidence: float,
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
    confidence = float(item.get("confidence", 0.0))
    if key in DATE_TARGET_KEYS:
        return float(item.get("anchor_priority", 0)), confidence, -1.0

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
