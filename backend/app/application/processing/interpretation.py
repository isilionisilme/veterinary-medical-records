"""Processing subsystem modules extracted from processing_runner."""

from __future__ import annotations

import logging
import math
import os
import re
from collections import defaultdict
from collections.abc import Mapping
from datetime import UTC, datetime
from uuid import uuid4

from backend.app.application.confidence_calibration import (
    build_context_key,
    compute_review_history_adjustment,
    normalize_mapping_id,
    resolve_calibration_policy_version,
)
from backend.app.application.field_normalizers import (
    SPECIES_TOKEN_TO_CANONICAL,
    normalize_canonical_fields,
)
from backend.app.application.global_schema import (
    CRITICAL_KEYS,
    GLOBAL_SCHEMA_KEYS,
    REPEATABLE_KEYS,
    VALUE_TYPE_BY_KEY,
    normalize_global_schema,
    validate_global_schema_shape,
)
from backend.app.config import (
    confidence_band_cutoffs_or_none,
    confidence_policy_explicit_config_diagnostics,
    confidence_policy_version_or_none,
)
from backend.app.ports.document_repository import DocumentRepository

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
    INTERPRETATION_DEBUG_INCLUDE_CANDIDATES_ENV,
    MVP_COVERAGE_DEBUG_KEYS,
    NUMERIC_TYPES,
    REVIEW_SCHEMA_CONTRACT,
)

logger = logging.getLogger(__name__)


def _default_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _build_interpretation_artifact(
    *,
    document_id: str,
    run_id: str,
    raw_text: str,
    repository: DocumentRepository | None = None,
) -> dict[str, object]:
    compact_text = _WHITESPACE_PATTERN.sub(" ", raw_text).strip()
    warning_codes: list[str] = []
    candidate_bundle: dict[str, list[dict[str, object]]] = {}
    canonical_evidence: dict[str, list[dict[str, object]]] = {}

    if compact_text:
        candidate_bundle = _mine_interpretation_candidates(raw_text)
        canonical_values, canonical_evidence = _map_candidates_to_global_schema(candidate_bundle)
        canonical_values = normalize_canonical_fields(
            canonical_values,
            canonical_evidence,
        )
        normalized_values = normalize_global_schema(canonical_values)
        validation_errors = validate_global_schema_shape(normalized_values)
        if validation_errors:
            from .orchestrator import InterpretationBuildError

            raise InterpretationBuildError(
                error_code="INTERPRETATION_VALIDATION_FAILED",
                details={"errors": validation_errors},
            )

        calibration_context_key = build_context_key(
            document_type="veterinary_record",
            language=normalized_values.get("language")
            if isinstance(normalized_values.get("language"), str)
            else None,
        )
        context_key_aliases: tuple[str, ...] = ()
        calibration_policy_version = resolve_calibration_policy_version()
        fields = _build_structured_fields_from_global_schema(
            normalized_values=normalized_values,
            evidence_map=canonical_evidence,
            candidate_bundle=candidate_bundle,
            context_key=calibration_context_key,
            context_key_aliases=context_key_aliases,
            policy_version=calibration_policy_version,
            repository=repository,
        )
    else:
        normalized_values = normalize_global_schema(None)
        fields = []
        warning_codes.append("EMPTY_RAW_TEXT")
        calibration_context_key = build_context_key(
            document_type="veterinary_record",
            language=None,
        )
        context_key_aliases = ()

    populated_keys = [
        key
        for key in GLOBAL_SCHEMA_KEYS
        if (
            isinstance(normalized_values.get(key), list) and len(normalized_values.get(key, [])) > 0
        )
        or (isinstance(normalized_values.get(key), str) and bool(normalized_values.get(key)))
    ]
    now_iso = _default_now_iso()
    policy_version = confidence_policy_version_or_none()
    band_cutoffs = confidence_band_cutoffs_or_none()
    mvp_coverage_debug = _build_mvp_coverage_debug_summary(
        raw_text=raw_text,
        normalized_values=normalized_values,
        candidate_bundle=candidate_bundle,
        evidence_map=canonical_evidence,
    )
    data: dict[str, object] = {
        "document_id": document_id,
        "processing_run_id": run_id,
        "created_at": now_iso,
        "schema_contract": REVIEW_SCHEMA_CONTRACT,
        "fields": fields,
        "global_schema": normalized_values,
        "summary": {
            "total_keys": len(GLOBAL_SCHEMA_KEYS),
            "populated_keys": len(populated_keys),
            "keys_present": populated_keys,
            "warning_codes": warning_codes,
            "date_selection": _build_date_selection_debug(canonical_evidence),
            "mvp_coverage_debug": mvp_coverage_debug,
        },
        "context_key": calibration_context_key,
    }
    if policy_version is not None and band_cutoffs is not None:
        low_max, mid_max = band_cutoffs
        data["confidence_policy"] = {
            "policy_version": policy_version,
            "band_cutoffs": {
                "low_max": round(low_max, 4),
                "mid_max": round(mid_max, 4),
            },
        }
        logger.info(
            "confidence_policy included in interpretation payload policy_version=%s",
            policy_version,
        )
    else:
        _, reason, missing_keys, invalid_keys = confidence_policy_explicit_config_diagnostics()
        logger.warning(
            "confidence_policy omitted from interpretation payload "
            "reason=%s missing_keys=%s invalid_keys=%s",
            reason,
            missing_keys,
            invalid_keys,
        )
    logger.info(
        "MVP coverage debug run_id=%s document_id=%s fields=%s",
        run_id,
        document_id,
        mvp_coverage_debug,
    )
    if _should_include_interpretation_candidates():
        data["candidate_bundle"] = candidate_bundle

    return {
        "interpretation_id": str(uuid4()),
        "version_number": 1,
        "data": data,
    }


def _should_include_interpretation_candidates() -> bool:
    raw = os.getenv(INTERPRETATION_DEBUG_INCLUDE_CANDIDATES_ENV, "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


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


def _build_date_selection_debug(
    evidence_map: Mapping[str, list[dict[str, object]]],
) -> dict[str, dict[str, object] | None]:
    payload: dict[str, dict[str, object] | None] = {}
    for key in ("visit_date", "document_date", "admission_date", "discharge_date"):
        candidates = evidence_map.get(key, [])
        if not candidates:
            payload[key] = None
            continue
        top = candidates[0]
        payload[key] = {
            "anchor": top.get("anchor"),
            "anchor_priority": top.get("anchor_priority", 0),
            "target_reason": top.get("target_reason"),
        }
    return payload


def _build_mvp_coverage_debug_summary(
    *,
    raw_text: str,
    normalized_values: Mapping[str, object],
    candidate_bundle: Mapping[str, list[dict[str, object]]],
    evidence_map: Mapping[str, list[dict[str, object]]],
) -> dict[str, dict[str, object] | None]:
    summary: dict[str, dict[str, object] | None] = {}
    for key in MVP_COVERAGE_DEBUG_KEYS:
        raw_value = normalized_values.get(key)
        accepted = (isinstance(raw_value, str) and bool(raw_value.strip())) or (
            isinstance(raw_value, list) and len(raw_value) > 0
        )

        key_candidates = sorted(
            candidate_bundle.get(key, []),
            key=lambda item: _candidate_sort_key(item, key),
            reverse=True,
        )
        top1 = key_candidates[0] if key_candidates else None
        top1_value = str(top1.get("value", "")).strip() if isinstance(top1, dict) else None
        top1_conf = float(top1.get("confidence", 0.0)) if isinstance(top1, dict) else None

        line_number: int | None = None
        if accepted:
            key_evidence = evidence_map.get(key, [])
            top_evidence = key_evidence[0] if key_evidence else None
            evidence_payload = (
                top_evidence.get("evidence") if isinstance(top_evidence, dict) else None
            )
            snippet = (
                evidence_payload.get("snippet") if isinstance(evidence_payload, dict) else None
            )
            if isinstance(snippet, str) and snippet.strip():
                line_number = _find_line_number_for_snippet(raw_text, snippet)

        summary[key] = {
            "status": "accepted" if accepted else "missing",
            "top1": top1_value,
            "confidence": round(top1_conf, 2) if isinstance(top1_conf, float) else None,
            "line_number": line_number,
        }

    return summary


def _find_line_number_for_snippet(raw_text: str, snippet: str) -> int | None:
    lines = raw_text.splitlines()
    compact_snippet = _WHITESPACE_PATTERN.sub(" ", snippet).strip().casefold()
    if not compact_snippet:
        return None

    for index, line in enumerate(lines, start=1):
        compact_line = _WHITESPACE_PATTERN.sub(" ", line).strip().casefold()
        if not compact_line:
            continue
        if compact_snippet in compact_line or compact_line in compact_snippet:
            return index

    return None


def _build_structured_fields_from_global_schema(
    *,
    normalized_values: Mapping[str, object],
    evidence_map: Mapping[str, list[dict[str, object]]],
    candidate_bundle: Mapping[str, list[dict[str, object]]],
    context_key: str,
    context_key_aliases: tuple[str, ...],
    policy_version: str,
    repository: DocumentRepository | None,
) -> list[dict[str, object]]:
    fields: list[dict[str, object]] = []
    candidate_suggestions_by_key = {
        key: _build_field_candidate_suggestions(key=key, candidate_bundle=candidate_bundle)
        for key in GLOBAL_SCHEMA_KEYS
    }

    for key in GLOBAL_SCHEMA_KEYS:
        value = normalized_values.get(key)
        key_evidence = evidence_map.get(key, [])
        candidate_suggestions = candidate_suggestions_by_key.get(key)

        if key in REPEATABLE_KEYS:
            if not isinstance(value, list):
                continue
            for index, item in enumerate(value):
                if not isinstance(item, str) or not item:
                    continue
                candidate = key_evidence[index] if index < len(key_evidence) else None
                evidence = candidate.get("evidence") if isinstance(candidate, dict) else None
                confidence = (
                    float(candidate.get("confidence", 0.65))
                    if isinstance(candidate, dict)
                    else 0.65
                )
                mapping_id = _derive_mapping_id(key=key, candidate=candidate)
                fields.append(
                    _build_structured_field(
                        key=key,
                        value=item,
                        confidence=confidence,
                        snippet=(evidence.get("snippet") if isinstance(evidence, dict) else item),
                        value_type=VALUE_TYPE_BY_KEY.get(key, "string"),
                        page=(evidence.get("page") if isinstance(evidence, dict) else None),
                        mapping_id=mapping_id,
                        context_key=context_key,
                        context_key_aliases=context_key_aliases,
                        policy_version=policy_version,
                        repository=repository,
                        candidate_suggestions=candidate_suggestions,
                    )
                )
            continue

        if not isinstance(value, str) or not value:
            continue
        candidate = key_evidence[0] if key_evidence else None
        evidence = candidate.get("evidence") if isinstance(candidate, dict) else None
        confidence = (
            float(candidate.get("confidence", 0.65)) if isinstance(candidate, dict) else 0.65
        )
        mapping_id = _derive_mapping_id(key=key, candidate=candidate)
        fields.append(
            _build_structured_field(
                key=key,
                value=value,
                confidence=confidence,
                snippet=(evidence.get("snippet") if isinstance(evidence, dict) else value),
                value_type=VALUE_TYPE_BY_KEY.get(key, "string"),
                page=(evidence.get("page") if isinstance(evidence, dict) else None),
                mapping_id=mapping_id,
                context_key=context_key,
                context_key_aliases=context_key_aliases,
                policy_version=policy_version,
                repository=repository,
                candidate_suggestions=candidate_suggestions,
            )
        )

    return fields


def _build_field_candidate_suggestions(
    *, key: str, candidate_bundle: Mapping[str, list[dict[str, object]]]
) -> list[dict[str, object]]:
    ranked_candidates = sorted(
        candidate_bundle.get(key, []),
        key=_candidate_suggestion_sort_key,
    )

    suggestions: list[dict[str, object]] = []
    seen_values: set[str] = set()

    for candidate in ranked_candidates:
        value = str(candidate.get("value", "")).strip()
        if not value:
            continue
        normalized_value = value.casefold()
        if normalized_value in seen_values:
            continue
        seen_values.add(normalized_value)

        confidence = _sanitize_field_candidate_confidence(candidate.get("confidence"))
        suggestion: dict[str, object] = {
            "value": value,
            "confidence": confidence,
        }

        raw_evidence = candidate.get("evidence")
        if isinstance(raw_evidence, dict):
            evidence_payload: dict[str, object] = {}
            page = raw_evidence.get("page")
            if isinstance(page, int):
                evidence_payload["page"] = page
            snippet = raw_evidence.get("snippet")
            if isinstance(snippet, str) and snippet.strip():
                evidence_payload["snippet"] = snippet.strip()
            if evidence_payload:
                suggestion["evidence"] = evidence_payload

        suggestions.append(suggestion)
        if len(suggestions) >= 5:
            break

    return suggestions


def _candidate_suggestion_sort_key(item: dict[str, object]) -> tuple[float, str, str, int]:
    raw_evidence = item.get("evidence")
    evidence_snippet = ""
    evidence_page = 0
    if isinstance(raw_evidence, dict):
        snippet = raw_evidence.get("snippet")
        if isinstance(snippet, str):
            evidence_snippet = snippet.strip().casefold()
        page = raw_evidence.get("page")
        if isinstance(page, int):
            evidence_page = page

    return (
        -_sanitize_field_candidate_confidence(item.get("confidence")),
        str(item.get("value", "")).strip().casefold(),
        evidence_snippet,
        evidence_page,
    )


def _build_structured_field(
    *,
    key: str,
    value: str,
    confidence: float,
    snippet: str,
    value_type: str,
    page: int | None,
    mapping_id: str | None,
    context_key: str,
    context_key_aliases: tuple[str, ...],
    policy_version: str,
    repository: DocumentRepository | None,
    candidate_suggestions: list[dict[str, object]] | None,
) -> dict[str, object]:
    normalized_snippet = snippet.strip()
    if len(normalized_snippet) > 180:
        normalized_snippet = normalized_snippet[:177].rstrip() + "..."
    field_candidate_confidence = _sanitize_field_candidate_confidence(confidence)
    text_extraction_reliability = _sanitize_text_extraction_reliability(None)
    field_review_history_adjustment = _resolve_review_history_adjustment(
        repository=repository,
        context_key=context_key,
        context_key_aliases=context_key_aliases,
        field_key=key,
        mapping_id=mapping_id,
        policy_version=policy_version,
    )
    field_mapping_confidence = _compose_field_mapping_confidence(
        candidate_confidence=field_candidate_confidence,
        review_history_adjustment=field_review_history_adjustment,
    )
    payload: dict[str, object] = {
        "field_id": str(uuid4()),
        "key": key,
        "value": value,
        "value_type": value_type,
        "field_candidate_confidence": field_candidate_confidence,
        "field_mapping_confidence": field_mapping_confidence,
        "text_extraction_reliability": text_extraction_reliability,
        "field_review_history_adjustment": field_review_history_adjustment,
        "context_key": context_key,
        "mapping_id": mapping_id,
        "policy_version": policy_version,
        "is_critical": key in CRITICAL_KEYS,
        "origin": "machine",
        "evidence": {
            "page": page,
            "snippet": normalized_snippet,
        },
    }
    if candidate_suggestions:
        payload["candidate_suggestions"] = candidate_suggestions
    return payload


def _sanitize_text_extraction_reliability(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        numeric = float(value)
        if math.isfinite(numeric) and 0.0 <= numeric <= 1.0:
            return numeric
    return None


def _sanitize_field_review_history_adjustment(value: object) -> float:
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, int | float):
        numeric = float(value)
        if math.isfinite(numeric):
            return numeric
    return 0.0


def _sanitize_field_candidate_confidence(value: object) -> float:
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, NUMERIC_TYPES):
        numeric = float(value)
        if math.isfinite(numeric):
            return min(max(numeric, 0.0), 1.0)
    return 0.0


def _derive_mapping_id(*, key: str, candidate: dict[str, object] | None) -> str | None:
    if not isinstance(candidate, dict):
        return None

    explicit = normalize_mapping_id(candidate.get("mapping_id"))
    if explicit is not None:
        return explicit

    anchor = candidate.get("anchor")
    if isinstance(anchor, str) and anchor.strip():
        return f"anchor::{anchor.strip().lower()}"

    reason = candidate.get("target_reason")
    if isinstance(reason, str) and reason.startswith("fallback"):
        return f"fallback::{key}"
    return None


def _resolve_review_history_adjustment(
    *,
    repository: DocumentRepository | None,
    context_key: str,
    context_key_aliases: tuple[str, ...],
    field_key: str,
    mapping_id: str | None,
    policy_version: str,
) -> float:
    _ = context_key_aliases
    if repository is None:
        return 0.0

    counts = repository.get_calibration_counts(
        context_key=context_key,
        field_key=field_key,
        mapping_id=mapping_id,
        policy_version=policy_version,
    )
    if counts is None:
        return 0.0

    accept_count, edit_count = counts
    return _sanitize_field_review_history_adjustment(
        compute_review_history_adjustment(
            accept_count=accept_count,
            edit_count=edit_count,
        )
    )


def _compose_field_mapping_confidence(
    *, candidate_confidence: float, review_history_adjustment: float
) -> float:
    composed = candidate_confidence + (review_history_adjustment / 100.0)
    return min(max(composed, 0.0), 1.0)


def _normalize_candidate_text(text: str) -> str:
    normalized = _WHITESPACE_PATTERN.sub(" ", text).strip()
    return normalized
