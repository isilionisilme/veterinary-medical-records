"""Candidate mining: text → structured candidate extraction for interpretation."""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from collections.abc import Mapping

from backend.app.application.field_normalizers import SPECIES_TOKEN_TO_CANONICAL
from backend.app.application.global_schema import GLOBAL_SCHEMA_KEYS, REPEATABLE_KEYS

from .constants import (
    _ADDRESS_LIKE_PATTERN,
    _CLINICAL_RECORD_GUARD_PATTERN,
    _DATE_CANDIDATE_PATTERN,
    _DATE_TARGET_ANCHORS,
    _DATE_TARGET_PRIORITY,
    _LICENSE_ONLY_PATTERN,
    _MICROCHIP_DIGITS_PATTERN,
    _MICROCHIP_KEYWORD_WINDOW_PATTERN,
    _MICROCHIP_OCR_PREFIX_WINDOW_PATTERN,
    _NAME_TOKEN_PATTERN,
    _OWNER_CLIENT_HEADER_LINE_PATTERN,
    _OWNER_CLIENT_TABULAR_LABEL_LINE_PATTERN,
    _OWNER_CONTEXT_PATTERN,
    _OWNER_HEADER_LOOKBACK_LINES,
    _OWNER_INLINE_CONTEXT_WINDOW_LINES,
    _OWNER_LABEL_LINE_PATTERN,
    _OWNER_NOMBRE_LINE_PATTERN,
    _OWNER_PATIENT_LABEL_PATTERN,
    _OWNER_TABULAR_FORWARD_SCAN_LINES,
    _PHONE_LIKE_PATTERN,
    _VET_LABEL_LINE_PATTERN,
    _VET_OR_CLINIC_CONTEXT_PATTERN,
    _WHITESPACE_PATTERN,
    COVERAGE_CONFIDENCE_FALLBACK,
    COVERAGE_CONFIDENCE_LABEL,
    DATE_TARGET_KEYS,
)

logger = logging.getLogger(__name__)


def _mine_interpretation_candidates(raw_text: str) -> dict[str, list[dict[str, object]]]:
    compact_text = _WHITESPACE_PATTERN.sub(" ", raw_text).strip()
    candidates: dict[str, list[dict[str, object]]] = defaultdict(list)
    seen_values: dict[str, set[str]] = defaultdict(set)

    def split_owner_before_address_tokens(text: str) -> str:
        tokens = text.split()
        if not tokens:
            return ""

        address_markers = {
            "calle",
            "av",
            "av.",
            "avenida",
            "cp",
            "codigo",
            "postal",
            "no",
            "no.",
            "nº",
            "n°",
            "num",
            "num.",
            "número",
            "plaza",
            "pte",
            "pte.",
            "portal",
            "piso",
            "puerta",
        }
        for index, token in enumerate(tokens):
            normalized_token = token.casefold().strip(".,:;()[]{}")
            if (
                normalized_token == "codigo"
                and index + 1 < len(tokens)
                and tokens[index + 1].casefold().strip(".,:;()[]{}") == "postal"
            ):
                return " ".join(tokens[:index]).strip()
            if normalized_token.startswith("c/") or normalized_token in address_markers:
                return " ".join(tokens[:index]).strip()
        return text

    def normalize_person_fragment(fragment: str) -> str | None:
        value = _WHITESPACE_PATTERN.sub(" ", fragment).strip(" .,:;\t\r\n")
        if not value:
            return None
        if "@" in value or _PHONE_LIKE_PATTERN.search(value):
            return None
        if _LICENSE_ONLY_PATTERN.match(value):
            return None
        if _ADDRESS_LIKE_PATTERN.search(value):
            return None

        tokens = value.split()
        if not 2 <= len(tokens) <= 5:
            return None
        letter_tokens = [token for token in tokens if _NAME_TOKEN_PATTERN.match(token)]
        if len(letter_tokens) < max(2, int(len(tokens) * 0.6)):
            return None
        return " ".join(tokens)

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
            cleaned_value = split_owner_before_address_tokens(cleaned_value)
            normalized_person = normalize_person_fragment(cleaned_value)
            if normalized_person is None:
                return
            cleaned_value = normalized_person
            if _VET_OR_CLINIC_CONTEXT_PATTERN.search(snippet) is not None:
                return

        if key == "vet_name":
            normalized_person = normalize_person_fragment(cleaned_value)
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

    def add_labeled_person_candidates(
        *,
        key: str,
        pattern: re.Pattern[str],
        confidence: float,
        owner_mode: bool = False,
    ) -> None:
        raw_lines = raw_text.splitlines()

        for index, raw_line in enumerate(raw_lines):
            line = raw_line.strip()
            if not line:
                continue

            match = pattern.match(line)
            if match is None:
                continue

            candidate_source = match.group(1).strip() if isinstance(match.group(1), str) else ""
            if not candidate_source and ":" in line:
                for next_index in range(index + 1, min(index + 4, len(raw_lines))):
                    next_line = raw_lines[next_index].strip()
                    if next_line:
                        candidate_source = next_line
                        break

            if not candidate_source:
                continue

            if owner_mode:
                candidate_source = split_owner_before_address_tokens(candidate_source)

            normalized = normalize_person_fragment(candidate_source)
            if normalized is None:
                continue

            lower_line = line.casefold()
            if key == "vet_name" and _ADDRESS_LIKE_PATTERN.search(lower_line):
                continue
            if key == "owner_name" and _VET_OR_CLINIC_CONTEXT_PATTERN.search(lower_line):
                continue

            add_candidate(
                key=key,
                value=normalized,
                confidence=confidence,
                snippet=line,
            )

    add_labeled_person_candidates(
        key="vet_name",
        pattern=_VET_LABEL_LINE_PATTERN,
        confidence=COVERAGE_CONFIDENCE_LABEL,
    )
    add_labeled_person_candidates(
        key="owner_name",
        pattern=_OWNER_LABEL_LINE_PATTERN,
        confidence=COVERAGE_CONFIDENCE_LABEL,
        owner_mode=True,
    )

    raw_lines = raw_text.splitlines()
    for index, raw_line in enumerate(raw_lines):
        line = raw_line.strip()
        if not line:
            continue
        match = _OWNER_NOMBRE_LINE_PATTERN.match(line)
        if match is None:
            continue

        window_start = max(0, index - _OWNER_INLINE_CONTEXT_WINDOW_LINES)
        window_end = min(
            len(raw_lines),
            index + _OWNER_INLINE_CONTEXT_WINDOW_LINES + 1,
        )
        context_window = " ".join(raw_lines[window_start:window_end])
        pre_context_window = " ".join(raw_lines[window_start:index])
        has_owner_context = _OWNER_CONTEXT_PATTERN.search(context_window) is not None
        previous_non_empty_line = ""
        for back_index in range(index - 1, -1, -1):
            previous_line = raw_lines[back_index].strip()
            if previous_line:
                previous_non_empty_line = previous_line
                break

        has_client_header_context = bool(
            previous_non_empty_line
            and _OWNER_CLIENT_HEADER_LINE_PATTERN.match(previous_non_empty_line)
        )
        if not has_owner_context and not has_client_header_context:
            lookback_start = max(0, index - _OWNER_HEADER_LOOKBACK_LINES)
            has_client_header_context = any(
                _OWNER_CLIENT_HEADER_LINE_PATTERN.match(raw_lines[lookback_index].strip())
                for lookback_index in range(lookback_start, index)
            )
        if not has_owner_context and not has_client_header_context:
            continue
        if _VET_OR_CLINIC_CONTEXT_PATTERN.search(context_window) is not None:
            continue
        if not has_owner_context and _OWNER_PATIENT_LABEL_PATTERN.search(pre_context_window):
            continue

        candidate_source = match.group(1).strip() if isinstance(match.group(1), str) else ""
        if not candidate_source:
            for next_index in range(
                index + 1,
                min(index + _OWNER_TABULAR_FORWARD_SCAN_LINES + 1, len(raw_lines)),
            ):
                next_line = raw_lines[next_index].strip()
                if not next_line:
                    continue
                if _OWNER_CLIENT_TABULAR_LABEL_LINE_PATTERN.match(next_line):
                    continue

                inline_candidate = split_owner_before_address_tokens(next_line)
                inline_normalized = normalize_person_fragment(inline_candidate)
                if inline_normalized is None:
                    continue

                candidate_source = inline_normalized
                break

        candidate_source = split_owner_before_address_tokens(candidate_source)

        normalized = normalize_person_fragment(candidate_source)
        if normalized is None:
            continue

        add_candidate(
            key="owner_name",
            value=normalized,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=line,
        )

    labeled_patterns: tuple[tuple[str, str, float], ...] = (
        (
            "pet_name",
            r"(?:paciente|nombre(?:\s+del\s+paciente)?|patient)\s*[:\-]\s*([^\n;]{2,100})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "species",
            r"(?:especie\s*/\s*raza|raza\s*/\s*especie)\s*[:\-]\s*([^\n;]{2,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "breed",
            r"(?:especie\s*/\s*raza|raza\s*/\s*especie)\s*[:\-]\s*([^\n;]{2,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        ("species", r"(?:especie|species)\s*[:\-]\s*([^\n;]{2,80})", COVERAGE_CONFIDENCE_LABEL),
        ("breed", r"(?:raza|breed)\s*[:\-]\s*([^\n;]{2,80})", COVERAGE_CONFIDENCE_LABEL),
        ("sex", r"(?:sexo|sex)\s*[:\-]\s*([^\n;]{1,40})", COVERAGE_CONFIDENCE_LABEL),
        ("age", r"(?:edad|age)\s*[:\-]\s*([^\n;]{1,60})", COVERAGE_CONFIDENCE_LABEL),
        (
            "dob",
            r"(?:f(?:echa)?\s*(?:de\s*)?(?:nacimiento|nac\.|nac)|dob|birth\s*date)\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "weight",
            r"(?:peso|weight)\s*[:\-]?\s*([0-9]+(?:[\.,][0-9]+)?\s*(?:kg|kgs|g)?)",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "microchip_id",
            r"(?:microchip|chip)\s*(?:n[ºo°\uFFFD]\.?|nro\.?|id)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9./_\-]{1,30}(?:\s+[A-Za-z0-9][A-Za-z0-9./_\-]{0,20}){0,3})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "clinical_record_number",
            r"(?:nhc|n[ºo°]?\s*(?:historial|historia\s*cl[ií]nica)|historial\s*cl[ií]nico|n[uú]mero\s*de\s*historial)\s*[:\-]?\s*([A-Za-z0-9./_\-]{2,40})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "visit_date",
            r"(?:fecha\s+de\s+visita|visita|consulta|visit\s+date)\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "document_date",
            r"(?:fecha\s+documento|fecha|date)\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "clinic_name",
            r"(?:cl[ií]nica|centro\s+veterinario|hospital\s+veterinario)\s*[:\-]\s*([^\n;]{3,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "clinic_address",
            r"(?:direcci[oó]n\s*(?:de\s*la\s*cl[ií]nica)?|domicilio\s*(?:de\s*la\s*cl[ií]nica)?)\s*[:\-]\s*([^\n;]{4,160})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "vet_name",
            r"(?:veterinari[oa]|dr\.?|dra\.?)\s*[:\-]\s*([^\n;]{3,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "owner_name",
            r"(?:propietari[oa]|tutor)\s*[:\-]\s*([^\n;]{3,120})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "owner_address",
            (
                r"(?:direcci[oó]n\s*(?:del\s*propietari[oa])?|domicilio\s*"
                r"(?:del\s*propietari[oa])?)\s*[:\-]\s*([^\n;]{4,160})"
            ),
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "coat_color",
            r"(?:capa|color\s*(?:del\s*(?:pelaje|pelo))?)\s*[:\-]\s*([^\n;]{2,100})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "hair_length",
            r"(?:pelo|longitud\s*del\s*pelo)\s*[:\-]\s*([^\n;]{2,100})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "repro_status",
            (
                r"(?:estado\s*reproductivo|repro(?:ductivo)?|esterilizad[oa]|"
                r"castrad[oa]|f[eé]rtil)\s*[:\-]\s*([^\n;]{2,80})"
            ),
            COVERAGE_CONFIDENCE_LABEL,
        ),
        (
            "reason_for_visit",
            r"(?:motivo(?:\s+de\s+consulta)?|reason\s+for\s+visit)\s*[:\-]\s*([^\n]{3,200})",
            COVERAGE_CONFIDENCE_LABEL,
        ),
    )

    for key, pattern, confidence in labeled_patterns:
        for match in re.finditer(pattern, raw_text, flags=re.IGNORECASE):
            add_candidate(
                key=key,
                value=match.group(1),
                confidence=confidence,
                snippet=match.group(0),
            )

    for match in _MICROCHIP_KEYWORD_WINDOW_PATTERN.finditer(raw_text):
        window = match.group(1) if isinstance(match.group(1), str) else ""
        digit_match = _MICROCHIP_DIGITS_PATTERN.search(window)
        if digit_match is None:
            continue
        add_candidate(
            key="microchip_id",
            value=digit_match.group(1),
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=match.group(0),
        )

    for match in re.finditer(
        (
            r"(?is)(?:nhc|n[ºo°]?\s*(?:historial|historia\s*cl[ií]nica)|"
            r"historial\s*cl[ií]nico)\s*[:\-]?\s*([^\n]{1,60})"
        ),
        raw_text,
    ):
        raw_value = str(match.group(1)).strip()
        if not raw_value or _CLINICAL_RECORD_GUARD_PATTERN.search(raw_value):
            continue
        add_candidate(
            key="clinical_record_number",
            value=raw_value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=match.group(0),
        )

    for match in _MICROCHIP_OCR_PREFIX_WINDOW_PATTERN.finditer(raw_text):
        window = match.group(1) if isinstance(match.group(1), str) else ""
        digit_match = _MICROCHIP_DIGITS_PATTERN.search(window)
        if digit_match is None:
            continue
        add_candidate(
            key="microchip_id",
            value=digit_match.group(1),
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet=match.group(0),
        )

    for match in re.finditer(r"\b([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})\b", raw_text):
        snippet = raw_text[max(0, match.start() - 36) : min(len(raw_text), match.end() + 36)]
        add_candidate(
            key="document_date",
            value=match.group(1),
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet=snippet,
        )

    for date_candidate in _extract_date_candidates_with_classification(raw_text):
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

        timeline_match = re.match(r"^-\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4})\s*-", line)
        if timeline_match:
            add_candidate(
                key="document_date",
                value=timeline_match.group(1),
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet=line,
                target_reason="timeline_unanchored",
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


def _extract_date_candidates_with_classification(
    raw_text: str,
) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    lower_text = raw_text.casefold()

    for match in _DATE_CANDIDATE_PATTERN.finditer(raw_text):
        value = match.group(1)
        start = max(0, match.start() - 70)
        end = min(len(raw_text), match.end() + 70)
        snippet = _WHITESPACE_PATTERN.sub(" ", raw_text[start:end]).strip()
        context = lower_text[start:end]

        chosen_key = "document_date"
        chosen_anchor = "fallback"
        chosen_priority = 1
        chosen_reason = "fallback_document_date"

        for key, anchors in _DATE_TARGET_ANCHORS.items():
            matched_anchor = next((anchor for anchor in anchors if anchor in context), None)
            if matched_anchor is None:
                continue

            priority = _DATE_TARGET_PRIORITY.get(key, 1)
            if priority > chosen_priority:
                chosen_key = key
                chosen_anchor = matched_anchor
                chosen_priority = priority
                chosen_reason = f"anchor:{matched_anchor}"

        confidence = (
            COVERAGE_CONFIDENCE_LABEL if chosen_priority > 1 else COVERAGE_CONFIDENCE_FALLBACK
        )
        candidates.append(
            {
                "target_key": chosen_key,
                "value": value,
                "confidence": confidence,
                "snippet": snippet,
                "anchor": chosen_anchor,
                "anchor_priority": chosen_priority,
                "target_reason": chosen_reason,
            }
        )

    return candidates


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
