"""Processing subsystem modules extracted from processing_runner."""

from __future__ import annotations

import logging
import math
import os
from collections.abc import Mapping
from datetime import UTC, datetime
from uuid import uuid4

from backend.app.application.confidence_calibration import (
    build_context_key,
    compute_review_history_adjustment,
    normalize_mapping_id,
    resolve_calibration_policy_version,
)
from backend.app.application.field_normalizers import normalize_canonical_fields
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

from .candidate_mining import (
    _candidate_sort_key,
    _map_candidates_to_global_schema,
    _mine_interpretation_candidates,
)
from .constants import (
    _WHITESPACE_PATTERN,
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
