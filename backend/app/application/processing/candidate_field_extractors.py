from __future__ import annotations

import re

from backend.app.application.field_normalizers import SPECIES_TOKEN_TO_CANONICAL

from .candidate_address_extractors import (
    _extract_labeled_address_candidates,
    _extract_owner_address_candidates,
)
from .candidate_collector import CandidateCollector
from .constants import (
    _DATE_CANDIDATE_PATTERN,
    _OWNER_CONTEXT_PATTERN,
    _WHITESPACE_PATTERN,
    COVERAGE_CONFIDENCE_FALLBACK,
    COVERAGE_CONFIDENCE_LABEL,
)
from .date_parsing import (
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
    PetNamePatterns,
    WeightPatterns,
)

_PET_NAME_GUARD_RE = PetNamePatterns.GUARD_RE
_PET_NAME_BIRTHLINE_RE = PetNamePatterns.BIRTHLINE_RE
_CLINIC_CONTEXT_LINE_RE = ClinicPatterns.CONTEXT_LINE_RE
_CLINIC_STANDALONE_LINE_RE = ClinicPatterns.STANDALONE_LINE_RE
_CLINIC_HEADER_ADDRESS_CONTEXT_RE = ClinicPatterns.HEADER_ADDRESS_CONTEXT_RE
_CLINIC_HEADER_SECTION_CONTEXT_RE = ClinicPatterns.HEADER_SECTION_CONTEXT_RE
_CLINIC_HEADER_GENERIC_BLACKLIST = ClinicPatterns.HEADER_GENERIC_BLACKLIST
_CLINIC_ADDRESS_START_RE = ClinicPatterns.ADDRESS_START_RE
_CLINIC_OR_HOSPITAL_CONTEXT_RE = ClinicPatterns.OR_HOSPITAL_CONTEXT_RE
_OWNER_CONTEXT_RE = _OWNER_CONTEXT_PATTERN
_POSTAL_HINT_RE = AddressPatterns.POSTAL_HINT_RE
_SIMPLE_FIELD_LABEL_RE = FieldLabelPatterns.SIMPLE_FIELD_LABEL_RE
_WEIGHT_STANDALONE_LINE_RE = WeightPatterns.STANDALONE_LINE_RE
_VISIT_TIMELINE_CONTEXT_RE = WeightPatterns.VISIT_TIMELINE_CONTEXT_RE
_HEADER_BLOCK_SCAN_WINDOW = ClinicPatterns.HEADER_BLOCK_SCAN_WINDOW
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


def _split_header_value_line(line: str) -> tuple[str, str]:
    if ":" in line:
        return line.split(":", 1)
    if "-" in line:
        return line.split("-", 1)
    return "", ""


def _extract_inline_owner_address_candidate(
    collector: CandidateCollector, line: str, header: str, value: str
) -> None:
    if _OWNER_CONTEXT_RE.search(header.casefold()):
        owner_value = value.strip(" .,:;\t\r\n")
        address_start = _CLINIC_ADDRESS_START_RE.search(owner_value)
        if address_start is not None:
            address_fragment = owner_value[address_start.start() :].strip(" .,:;\t\r\n")
            if address_fragment:
                collector.add_candidate(
                    key="owner_address",
                    value=address_fragment,
                    confidence=COVERAGE_CONFIDENCE_LABEL,
                    snippet=line,
                )


def _extract_header_value_field_candidates(
    collector: CandidateCollector, line: str, header: str, value: str
) -> None:
    add_candidate = collector.add_candidate
    lower_header = header.casefold()
    _extract_inline_owner_address_candidate(collector, line, header, value)
    if any(token in lower_header for token in ("diagn", "impresi")):
        add_candidate(
            key="diagnosis", value=value, confidence=COVERAGE_CONFIDENCE_LABEL, snippet=line
        )
    if any(token in lower_header for token in ("trat", "medic", "prescrip", "receta")):
        add_candidate(
            key="medication", value=value, confidence=COVERAGE_CONFIDENCE_LABEL, snippet=line
        )
        add_candidate(key="treatment_plan", value=value, confidence=0.7, snippet=line)
    if any(token in lower_header for token in ("proced", "interv", "cirug", "quir")):
        add_candidate(
            key="procedure", value=value, confidence=COVERAGE_CONFIDENCE_LABEL, snippet=line
        )
    if any(token in lower_header for token in ("sintom", "symptom")):
        add_candidate(
            key="symptoms", value=value, confidence=COVERAGE_CONFIDENCE_LABEL, snippet=line
        )
    if any(token in lower_header for token in ("vacun", "vaccin")):
        add_candidate(
            key="vaccinations", value=value, confidence=COVERAGE_CONFIDENCE_LABEL, snippet=line
        )
    if any(token in lower_header for token in ("laboratorio", "analit", "lab")):
        add_candidate(
            key="lab_result", value=value, confidence=COVERAGE_CONFIDENCE_LABEL, snippet=line
        )
    if any(token in lower_header for token in ("radiograf", "ecograf", "imagen", "tac", "rm")):
        add_candidate(
            key="imaging", value=value, confidence=COVERAGE_CONFIDENCE_LABEL, snippet=line
        )
    if any(token in lower_header for token in ("linea", "concepto", "item")):
        add_candidate(
            key="line_item", value=value, confidence=COVERAGE_CONFIDENCE_LABEL, snippet=line
        )


def _extract_unlabeled_field_candidates(collector: CandidateCollector, line: str) -> None:
    add_candidate = collector.add_candidate
    lower_line = line.casefold()
    if any(token in lower_line for token in ("diagn", "impresi")) and ":" not in line:
        add_candidate(key="diagnosis", value=line, confidence=0.64, snippet=line)
    if any(
        token in lower_line
        for token in ("amoxic", "clavul", "predni", "omepra", "antibiot", "mg", "cada")
    ):
        add_candidate(
            key="medication", value=line, confidence=COVERAGE_CONFIDENCE_FALLBACK, snippet=line
        )
    if any(
        token in lower_line for token in ("cirug", "proced", "sut", "cura", "ecograf", "radiograf")
    ):
        add_candidate(
            key="procedure", value=line, confidence=COVERAGE_CONFIDENCE_FALLBACK, snippet=line
        )


def _extract_labeled_field_candidates(collector: CandidateCollector, lines: list[str]) -> None:
    for line in lines:
        header, value = _split_header_value_line(line)
        if value:
            _extract_header_value_field_candidates(collector, line, header, value)
        _extract_unlabeled_field_candidates(collector, line)


def _extract_sex_candidates(collector: CandidateCollector, lines: list[str]) -> None:
    add_candidate = collector.add_candidate
    for index, line in enumerate(lines):
        lower_line = line.casefold()
        normalized_single = _WHITESPACE_PATTERN.sub(" ", lower_line).strip()
        if any(token in lower_line for token in ("macho", "hembra", "male", "female")):
            if "macho" in lower_line or "male" in lower_line:
                add_candidate(
                    key="sex", value="macho", confidence=COVERAGE_CONFIDENCE_FALLBACK, snippet=line
                )
            if "hembra" in lower_line or "female" in lower_line:
                add_candidate(
                    key="sex", value="hembra", confidence=COVERAGE_CONFIDENCE_FALLBACK, snippet=line
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


def _extract_species_breed_candidates(collector: CandidateCollector, lines: list[str]) -> None:
    add_candidate = collector.add_candidate
    for line in lines:
        lower_line = line.casefold()
        normalized_single = _WHITESPACE_PATTERN.sub(" ", lower_line).strip()
        if normalized_single in SPECIES_TOKEN_TO_CANONICAL:
            add_candidate(
                key="species",
                value=SPECIES_TOKEN_TO_CANONICAL[normalized_single],
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )
        if any(keyword in lower_line for keyword in _BREED_KEYWORDS) and len(line) <= 80:
            add_candidate(
                key="breed", value=line, confidence=COVERAGE_CONFIDENCE_FALLBACK, snippet=line
            )


def _extract_clinic_header_candidate(collector: CandidateCollector, lines: list[str]) -> None:
    if not lines:
        return
    clinic_header = lines[0]
    clinic_header_folded = clinic_header.casefold()
    header_looks_institutional = (
        clinic_header.isupper()
        and 3 <= len(clinic_header) <= 60
        and ":" not in clinic_header
        and not re.search(r"\d", clinic_header)
        and "-" not in clinic_header
        and clinic_header not in _CLINIC_HEADER_GENERIC_BLACKLIST
        and clinic_header_folded not in _PET_NAME_STOPWORDS_LOWER
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
    collector: CandidateCollector, lines: list[str]
) -> None:
    add_candidate = collector.add_candidate
    max_header_scan = min(len(lines) - 2, _HEADER_BLOCK_SCAN_WINDOW)
    for index in range(max_header_scan):
        first_line, second_line, third_line = lines[index], lines[index + 1], lines[index + 2]
        if _CLINIC_ADDRESS_START_RE.search(first_line) is None:
            continue
        if _SIMPLE_FIELD_LABEL_RE.match(first_line) or _SIMPLE_FIELD_LABEL_RE.match(second_line):
            continue
        if _POSTAL_HINT_RE.search(third_line) is None:
            continue
        if _CLINIC_HEADER_SECTION_CONTEXT_RE.search(
            second_line.casefold()
        ) or _CLINIC_HEADER_SECTION_CONTEXT_RE.search(third_line.casefold()):
            continue
        if not (re.search(r"\d", first_line) or re.search(r"\d", second_line)):
            continue
        if (
            _OWNER_CONTEXT_RE.search(
                " ".join(lines[max(0, index - 1) : min(len(lines), index + 4)]).casefold()
            )
            is not None
        ):
            continue
        add_candidate(
            key="clinic_address",
            value=" ".join(
                part.strip(" .,:;\t\r\n") for part in (first_line, second_line, third_line)
            ),
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet="\n".join(lines[index : min(len(lines), index + 4)]),
        )


def _extract_clinic_context_candidates(collector: CandidateCollector, lines: list[str]) -> None:
    add_candidate = collector.add_candidate
    for index, line in enumerate(lines):
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
            add_candidate(
                key="clinic_name",
                value=f"{canonical_institution} {institution_name}".strip(),
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )

        clinic_standalone_match = _CLINIC_STANDALONE_LINE_RE.match(line)
        if clinic_standalone_match is not None:
            institution_token = clinic_standalone_match.group(1).strip()
            institution_name = clinic_standalone_match.group(2).strip(" .,:;\t\r\n")
            lowered_name = institution_name.casefold()
            if not lowered_name.startswith("de "):
                canonical_institution = (
                    "HV"
                    if re.fullmatch(r"(?i)h\.?\s*v\.?", institution_token)
                    else institution_token
                )
                add_candidate(
                    key="clinic_name",
                    value=f"{canonical_institution} {institution_name}".strip(),
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=line,
                )


def _extract_clinic_candidates(collector: CandidateCollector, lines: list[str]) -> None:
    _extract_clinic_header_candidate(collector, lines)
    _extract_clinic_address_block_candidates(collector, lines)
    _extract_clinic_context_candidates(collector, lines)


def _extract_pet_name_candidates(collector: CandidateCollector, lines: list[str]) -> None:
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


def _extract_weight_candidates(collector: CandidateCollector, lines: list[str]) -> None:
    add_candidate = collector.add_candidate
    for index, line in enumerate(lines):
        standalone_weight_match = _WEIGHT_STANDALONE_LINE_RE.match(line)
        if standalone_weight_match is None:
            continue

        value_raw = standalone_weight_match.group(1)
        unit_raw = standalone_weight_match.group(2).lower()
        candidate_value = f"{value_raw} {'kg' if unit_raw in {'kg', 'kgs'} else unit_raw}".strip()
        context_lines = lines[max(0, index - 3) : min(len(lines), index + 2)]
        context_text = " ".join(context_lines)
        has_date_context = _DATE_CANDIDATE_PATTERN.search(context_text) is not None
        has_visit_context = _VISIT_TIMELINE_CONTEXT_RE.search(context_text) is not None
        if has_date_context or has_visit_context or len(lines) <= 5:
            add_candidate(
                key="weight",
                value=candidate_value,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet="\n".join(context_lines),
            )


def _extract_language_candidates(collector: CandidateCollector, compact_text: str) -> None:
    if (
        compact_text
        and "language" not in collector.candidates
        and any(
            token in compact_text.casefold() for token in ("paciente", "diagnost", "tratamiento")
        )
    ):
        collector.add_candidate(
            key="language",
            value="es",
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet="Heuristic language inference based on Spanish clinical tokens",
            page=None,
        )


def _seed_base_candidates(collector: CandidateCollector, raw_text: str) -> None:
    for payloads in (
        extract_labeled_person_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_owner_nombre_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_regex_labeled_candidates(raw_text),
        extract_microchip_keyword_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_microchip_adjacent_line_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_clinical_record_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_ocr_microchip_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_FALLBACK),
        extract_unlabeled_header_dob_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_FALLBACK),
        extract_unanchored_document_date_candidates(
            raw_text, confidence=COVERAGE_CONFIDENCE_FALLBACK
        ),
    ):
        collector.add_basic_payloads(payloads)


def _extract_classified_date_candidates(collector: CandidateCollector, raw_text: str) -> None:
    for date_candidate in extract_date_candidates_with_classification(raw_text):
        collector.add_candidate(
            key=str(date_candidate["target_key"]),
            value=str(date_candidate["value"]),
            confidence=float(date_candidate["confidence"]),
            snippet=str(date_candidate["snippet"]),
            page=1,
            anchor=(str(date_candidate["anchor"]) if date_candidate.get("anchor") else None),
            anchor_priority=int(date_candidate["anchor_priority"]),
            target_reason=str(date_candidate["target_reason"]),
        )


def _extract_timeline_date_candidates(collector: CandidateCollector, lines: list[str]) -> None:
    for payload in extract_timeline_document_date_candidates(
        lines, confidence=COVERAGE_CONFIDENCE_FALLBACK
    ):
        collector.add_candidate(
            key=str(payload["key"]),
            value=str(payload["value"]),
            confidence=float(payload["confidence"]),
            snippet=str(payload["snippet"]),
            target_reason=str(payload["target_reason"]),
        )


def _run_domain_extractors(collector: CandidateCollector) -> None:
    lines = collector.lines
    _extract_clinic_candidates(collector, lines)
    _extract_labeled_field_candidates(collector, lines)
    _extract_sex_candidates(collector, lines)
    _extract_species_breed_candidates(collector, lines)
    _extract_timeline_date_candidates(collector, lines)
    _extract_owner_address_candidates(collector, lines)
    _extract_labeled_address_candidates(collector, lines)
    _extract_pet_name_candidates(collector, lines)
    _extract_weight_candidates(collector, lines)
    _extract_language_candidates(collector, collector.compact_text)
