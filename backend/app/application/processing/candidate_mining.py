"""Candidate mining: text -> structured candidate extraction for interpretation."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping

from backend.app.application.field_normalizers import SPECIES_TOKEN_TO_CANONICAL
from backend.app.application.global_schema import GLOBAL_SCHEMA_KEYS, REPEATABLE_KEYS

from .constants import (
    _ADDRESS_LIKE_PATTERN,
    _MICROCHIP_DIGITS_PATTERN,
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
    extract_microchip_keyword_candidates,
    extract_ocr_microchip_candidates,
    extract_owner_nombre_candidates,
    extract_regex_labeled_candidates,
    extract_timeline_document_date_candidates,
    extract_unanchored_document_date_candidates,
)


def _mine_interpretation_candidates(raw_text: str) -> dict[str, list[dict[str, object]]]:
    compact_text = _WHITESPACE_PATTERN.sub(" ", raw_text).strip()
    candidates: dict[str, list[dict[str, object]]] = defaultdict(list)
    seen_values: dict[str, set[str]] = defaultdict(set)

    def add_candidate(
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
        cleaned_value = value.strip(" .,:;\t\r\n")
        if not cleaned_value:
            return
        if key == "microchip_id":
            digit_match = _MICROCHIP_DIGITS_PATTERN.search(cleaned_value)
            if digit_match is None:
                return
            cleaned_value = digit_match.group(1)
        if key == "owner_name":
            cleaned_value = _split_owner_before_address_tokens(cleaned_value)
            normalized_person = _normalize_person_fragment(cleaned_value)
            if normalized_person is None:
                return
            cleaned_value = normalized_person
            if _VET_OR_CLINIC_CONTEXT_PATTERN.search(snippet) is not None:
                return
        if key == "vet_name":
            normalized_person = _normalize_person_fragment(cleaned_value)
            if normalized_person is None:
                return
            if _ADDRESS_LIKE_PATTERN.search(normalized_person):
                return
            cleaned_value = normalized_person

        normalized_key = cleaned_value.casefold()
        if normalized_key in seen_values[key]:
            return
        seen_values[key].add(normalized_key)

        effective_confidence = (
            COVERAGE_CONFIDENCE_LABEL
            if confidence >= COVERAGE_CONFIDENCE_LABEL
            else COVERAGE_CONFIDENCE_FALLBACK
        )
        candidates[key].append(
            {
                "value": cleaned_value,
                "confidence": round(min(max(effective_confidence, 0.0), 1.0), 2),
                "anchor": anchor,
                "anchor_priority": anchor_priority,
                "target_reason": target_reason,
                "evidence": {
                    "page": page,
                    "snippet": snippet.strip()[:220],
                },
            }
        )

    def add_basic_payloads(payloads: list[dict[str, object]]) -> None:
        for payload in payloads:
            add_candidate(
                key=str(payload["key"]),
                value=str(payload["value"]),
                confidence=float(payload["confidence"]),
                snippet=str(payload["snippet"]),
            )

    for payloads in (
        extract_labeled_person_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_owner_nombre_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_regex_labeled_candidates(raw_text),
        extract_microchip_keyword_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_clinical_record_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_LABEL),
        extract_ocr_microchip_candidates(raw_text, confidence=COVERAGE_CONFIDENCE_FALLBACK),
        extract_unanchored_document_date_candidates(
            raw_text,
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
        ),
    ):
        add_basic_payloads(payloads)

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

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    species_keywords = SPECIES_TOKEN_TO_CANONICAL
    breed_keywords = (
        "labrador",
        "retriever",
        "bulldog",
        "pastor",
        "yorkshire",
        "mestiz",
        "beagle",
        "caniche",
    )
    stopwords_upper = {
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

    for line in lines:
        if ":" in line:
            header, value = line.split(":", 1)
        elif "-" in line:
            header, value = line.split("-", 1)
        else:
            header, value = "", ""

        lower_header = header.casefold()
        if value:
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
            if any(
                token in lower_header for token in ("radiograf", "ecograf", "imagen", "tac", "rm")
            ):
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

        lower_line = line.casefold()
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

        if any(token in lower_line for token in ("diagn", "impresi")) and ":" not in line:
            add_candidate(key="diagnosis", value=line, confidence=0.64, snippet=line)
        if any(
            token in lower_line
            for token in (
                "amoxic",
                "clavul",
                "predni",
                "omepra",
                "antibiot",
                "mg",
                "cada",
            )
        ):
            add_candidate(
                key="medication",
                value=line,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )
        if any(
            token in lower_line
            for token in ("cirug", "proced", "sut", "cura", "ecograf", "radiograf")
        ):
            add_candidate(
                key="procedure",
                value=line,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
            )

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

    for index, line in enumerate(lines):
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

        if (
            line.isupper()
            and 2 < len(line) <= 30
            and line not in stopwords_upper
            and " " not in line
        ):
            nearby = " ".join(lines[index : min(len(lines), index + 4)]).casefold()
            if any(token in nearby for token in ("canino", "felino", "raza", "chip", "especie")):
                add_candidate(
                    key="pet_name",
                    value=line.title(),
                    confidence=COVERAGE_CONFIDENCE_FALLBACK,
                    snippet=line,
                )

    if (
        compact_text
        and "language" not in candidates
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

    return dict(candidates)


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


def _candidate_sort_key(item: dict[str, object], key: str) -> tuple[float, float]:
    confidence = float(item.get("confidence", 0.0))
    if key in DATE_TARGET_KEYS:
        return float(item.get("anchor_priority", 0)), confidence

    if key == "microchip_id":
        raw_value = str(item.get("value", "")).strip()
        if _MICROCHIP_DIGITS_PATTERN.fullmatch(raw_value):
            return 2.0, confidence
        if _MICROCHIP_DIGITS_PATTERN.search(raw_value):
            return 1.0, confidence
        return 0.0, confidence

    return 0.0, confidence
