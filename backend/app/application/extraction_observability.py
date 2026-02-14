"""Persistence and diff logging for extraction observability snapshots."""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)
_uvicorn_logger = logging.getLogger("uvicorn.error")


def _emit_info(message: str) -> None:
    if _uvicorn_logger.handlers:
        _uvicorn_logger.info(message)
        return
    logger.info(message)

_MAX_RUNS_PER_DOCUMENT = 20
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_OBSERVABILITY_DIR = _PROJECT_ROOT / ".local" / "extraction_runs"


def _safe_document_filename(document_id: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", document_id.strip())
    return cleaned or "unknown"


def _document_runs_path(document_id: str) -> Path:
    return _OBSERVABILITY_DIR / f"{_safe_document_filename(document_id)}.json"


def _read_runs(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list):
        return []
    return [item for item in payload if isinstance(item, dict)]


def _write_runs(path: Path, runs: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(runs, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _as_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _preview(value: str | None, *, limit: int = 80) -> str | None:
    if not value:
        return None
    if len(value) <= limit:
        return value
    return f"{value[: limit - 1].rstrip()}…"


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_diacritics = "".join(char for char in normalized if not unicodedata.combining(char))
    return without_diacritics.strip().lower()


def _extract_first_number(value: str) -> float | None:
    match = re.search(r"-?\d+(?:[\.,]\d+)?", value)
    if match is None:
        return None
    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def _suspicious_accepted_flags(field_key: str, value: str | None) -> list[str]:
    if not value:
        return []

    flags: list[str] = []
    normalized_value = value.strip()
    normalized_key = field_key.strip().lower()

    if len(normalized_value) > 80:
        flags.append("value_too_long")

    if normalized_key == "microchip_id":
        if any(char.isalpha() for char in normalized_value):
            flags.append("microchip_contains_letters")
        if len(normalized_value.split()) > 1:
            flags.append("microchip_multiple_words")
        if len(normalized_value) < 9 or len(normalized_value) > 15:
            flags.append("microchip_length_out_of_range")
        if not normalized_value.isdigit():
            flags.append("microchip_non_digit_characters")

    if normalized_key == "weight":
        letter_tokens = re.findall(r"[A-Za-z]+", normalized_value)
        invalid_letter_tokens = [
            token for token in letter_tokens if token.lower() not in {"kg", "kgs"}
        ]
        if invalid_letter_tokens:
            flags.append("weight_contains_non_kg_letters")

        numeric_value = _extract_first_number(normalized_value)
        if numeric_value is None:
            flags.append("weight_missing_numeric_value")
        elif numeric_value < 0.2 or numeric_value > 120:
            flags.append("weight_out_of_range")

    if normalized_key == "species":
        normalized_species = _normalize_text(normalized_value)
        if normalized_species not in {"canino", "felino"}:
            flags.append("species_outside_allowed_set")

    if normalized_key == "sex":
        normalized_sex = _normalize_text(normalized_value)
        if normalized_sex not in {"macho", "hembra"}:
            flags.append("sex_outside_allowed_set")

    return flags


def _coerce_confidence(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric < 0:
        return 0.0
    if numeric > 1:
        return 1.0
    return numeric


def _extract_top_candidates(raw_payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_candidates = raw_payload.get("topCandidates")
    candidates: list[dict[str, Any]] = []

    if isinstance(raw_candidates, list):
        for item in raw_candidates[:3]:
            if not isinstance(item, dict):
                continue
            value = _as_text(item.get("value"))
            if not value:
                continue
            candidates.append(
                {
                    "value": value,
                    "confidence": _coerce_confidence(item.get("confidence")),
                    "sourceHint": _as_text(item.get("sourceHint")),
                }
            )

    if candidates:
        return candidates

    fallback_value = (
        _as_text(raw_payload.get("rawCandidate"))
        or _as_text(raw_payload.get("valueRaw"))
        or _as_text(raw_payload.get("valueNormalized"))
    )
    if fallback_value:
        return [{"value": fallback_value, "confidence": None, "sourceHint": None}]

    return []


def _format_top_candidate_for_log(item: dict[str, Any] | None) -> str:
    if not isinstance(item, dict):
        return "top1=<none>"

    value = _preview(_as_text(item.get("value")))
    if not value:
        return "top1=<none>"

    confidence = _coerce_confidence(item.get("confidence"))
    if confidence is None:
        return f"top1={value!r} (conf=n/a)"
    return f"top1={value!r} (conf={confidence:.2f})"


def build_extraction_triage(snapshot: dict[str, Any]) -> dict[str, Any]:
    fields = snapshot.get("fields") if isinstance(snapshot.get("fields"), dict) else {}
    counts = snapshot.get("counts") if isinstance(snapshot.get("counts"), dict) else {}

    missing: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    suspicious_accepted: list[dict[str, Any]] = []

    for field_key in sorted(fields.keys()):
        raw_payload = fields.get(field_key)
        if not isinstance(raw_payload, dict):
            continue

        status = str(raw_payload.get("status", "")).strip().lower()
        value_normalized = _as_text(raw_payload.get("valueNormalized"))
        value_raw = _as_text(raw_payload.get("valueRaw"))
        raw_candidate = _as_text(raw_payload.get("rawCandidate"))
        source_hint = _as_text(raw_payload.get("sourceHint"))
        top_candidates = _extract_top_candidates(raw_payload)
        top1 = top_candidates[0] if top_candidates else None
        top1_value = _as_text(top1.get("value")) if isinstance(top1, dict) else None
        value_for_triage = value_normalized or value_raw or raw_candidate or top1_value

        if status == "missing":
            missing.append(
                {
                    "field": field_key,
                    "value": None,
                    "reason": "missing",
                    "flags": [],
                    "rawCandidate": raw_candidate,
                    "sourceHint": source_hint,
                    "topCandidates": top_candidates,
                }
            )
            continue

        if status == "rejected":
            rejected.append(
                {
                    "field": field_key,
                    "value": value_for_triage,
                    "reason": _as_text(raw_payload.get("reason")) or "rejected",
                    "flags": [],
                    "rawCandidate": raw_candidate,
                    "sourceHint": source_hint,
                    "topCandidates": top_candidates,
                }
            )
            continue

        if status == "accepted":
            flags = _suspicious_accepted_flags(field_key, value_for_triage)
            if flags:
                suspicious_accepted.append(
                    {
                        "field": field_key,
                        "value": value_for_triage,
                        "reason": None,
                        "flags": flags,
                        "rawCandidate": raw_candidate,
                        "sourceHint": source_hint,
                        "topCandidates": top_candidates,
                    }
                )

    return {
        "documentId": _as_text(snapshot.get("documentId")) or "",
        "runId": _as_text(snapshot.get("runId")) or "",
        "createdAt": _as_text(snapshot.get("createdAt")) or "",
        "summary": {
            "accepted": int(counts.get("accepted", 0) or 0),
            "missing": int(counts.get("missing", 0) or 0),
            "rejected": int(counts.get("rejected", 0) or 0),
            "low": int(counts.get("low", 0) or 0),
            "mid": int(counts.get("mid", 0) or 0),
            "high": int(counts.get("high", 0) or 0),
        },
        "missing": missing,
        "rejected": rejected,
        "suspiciousAccepted": suspicious_accepted,
    }


def _log_triage_report(document_id: str, triage: dict[str, Any]) -> None:
    summary = triage.get("summary") if isinstance(triage.get("summary"), dict) else {}
    missing = triage.get("missing") if isinstance(triage.get("missing"), list) else []
    rejected = triage.get("rejected") if isinstance(triage.get("rejected"), list) else []
    suspicious = (
        triage.get("suspiciousAccepted")
        if isinstance(triage.get("suspiciousAccepted"), list)
        else []
    )

    lines: list[str] = [
        (
            "[extraction-observability] "
            f"document={document_id} run={triage.get('runId')} triage "
            f"accepted={int(summary.get('accepted', 0) or 0)} "
            f"missing={int(summary.get('missing', 0) or 0)} "
            f"rejected={int(summary.get('rejected', 0) or 0)} "
            f"low={int(summary.get('low', 0) or 0)} "
            f"mid={int(summary.get('mid', 0) or 0)} "
            f"high={int(summary.get('high', 0) or 0)}"
        ),
        "MISSING:",
        "REJECTED:",
    ]

    if not missing:
        lines.insert(len(lines) - 1, "- none")
    else:
        missing_lines: list[str] = []
        for item in missing:
            if not isinstance(item, dict):
                continue
            field = item.get("field")
            candidates = (
                item.get("topCandidates")
                if isinstance(item.get("topCandidates"), list)
                else []
            )
            top1 = candidates[0] if candidates else None
            missing_lines.append(f"- {field}: {_format_top_candidate_for_log(top1)}")
        lines[len(lines) - 1:len(lines) - 1] = missing_lines

    if not rejected:
        lines.append("- none")
    else:
        for item in rejected:
            if not isinstance(item, dict):
                continue
            field = item.get("field")
            reason = item.get("reason")
            raw_candidate = _preview(_as_text(item.get("rawCandidate")))
            candidates = (
                item.get("topCandidates")
                if isinstance(item.get("topCandidates"), list)
                else []
            )
            top1 = candidates[0] if candidates else None
            line = f"- {field}: reason={reason} {_format_top_candidate_for_log(top1)}"
            if raw_candidate:
                line += f" rawCandidate={raw_candidate!r}"
            lines.append(line)

    lines.append("SUSPICIOUS_ACCEPTED:")
    if not suspicious:
        lines.append("- none")
    else:
        for item in suspicious:
            if not isinstance(item, dict):
                continue
            field = item.get("field")
            value = _preview(_as_text(item.get("value")))
            flags = item.get("flags") if isinstance(item.get("flags"), list) else []
            raw_candidate = _preview(_as_text(item.get("rawCandidate")))
            flags_label = ",".join(str(flag) for flag in flags) if flags else "unknown"
            line = f"- {field}: flags=[{flags_label}]"
            if value:
                line += f" value={value!r}"
            if raw_candidate:
                line += f" rawCandidate={raw_candidate!r}"
            lines.append(line)

    _emit_info("\n".join(lines))


def _count_deltas(
    previous: dict[str, Any] | None,
    current: dict[str, Any],
) -> list[str]:
    previous_counts = previous.get("counts") if isinstance(previous, dict) else None
    current_counts = current.get("counts") if isinstance(current, dict) else None
    if not isinstance(previous_counts, dict) or not isinstance(current_counts, dict):
        return []

    lines: list[str] = []
    for key in ("accepted", "missing", "rejected", "low", "mid", "high"):
        old_value = int(previous_counts.get(key, 0) or 0)
        new_value = int(current_counts.get(key, 0) or 0)
        delta = new_value - old_value
        lines.append(f"- {key}: {old_value} -> {new_value} ({delta:+d})")
    return lines


def _field_changes(
    previous: dict[str, Any] | None,
    current: dict[str, Any],
) -> list[str]:
    previous_fields = previous.get("fields") if isinstance(previous, dict) else None
    current_fields = current.get("fields") if isinstance(current, dict) else None
    if not isinstance(previous_fields, dict) or not isinstance(current_fields, dict):
        return []

    changes: list[str] = []
    keys = sorted(set(previous_fields.keys()) | set(current_fields.keys()))
    for key in keys:
        old_raw = previous_fields.get(key)
        new_raw = current_fields.get(key)
        if not isinstance(old_raw, dict) or not isinstance(new_raw, dict):
            continue

        old_status = old_raw.get("status")
        new_status = new_raw.get("status")
        old_conf = old_raw.get("confidence")
        new_conf = new_raw.get("confidence")
        old_value = old_raw.get("valueNormalized")
        new_value = new_raw.get("valueNormalized")
        new_reason = new_raw.get("reason")

        if old_status == new_status and old_conf == new_conf and old_value == new_value:
            continue

        change_line = f"- {key}: {old_status}"
        if old_conf:
            change_line += f" ({old_conf})"
        change_line += " -> "
        change_line += f"{new_status}"
        if new_conf:
            change_line += f" ({new_conf})"

        if new_status == "rejected" and isinstance(new_reason, str) and new_reason:
            change_line += f" [reason: {new_reason}]"

        if isinstance(old_value, str) and isinstance(new_value, str) and old_value != new_value:
            change_line += f" [value: {old_value!r} -> {new_value!r}]"
        elif not isinstance(old_value, str) and isinstance(new_value, str):
            change_line += f" [value: {new_value!r}]"

        changes.append(change_line)

    return changes


def _log_diff(
    *,
    document_id: str,
    previous: dict[str, Any] | None,
    current: dict[str, Any],
) -> int:
    if previous is None:
        _emit_info(
            "[extraction-observability] "
            f"document={document_id} run={current.get('runId')} first snapshot persisted"
        )
        return 0

    summary_lines = _count_deltas(previous, current)
    change_lines = _field_changes(previous, current)

    header = (
        "[extraction-observability] "
        f"document={document_id} run={current.get('runId')} "
        "diff vs previous:"
    )
    lines = [
        header,
        "Summary:",
        *summary_lines,
        "Changes:" if change_lines else "Changes: none",
        *change_lines,
    ]
    _emit_info("\n".join(lines))
    return len(change_lines)


def persist_extraction_run_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    document_id = str(snapshot.get("documentId", "")).strip()
    if not document_id:
        raise ValueError("documentId is required")

    run_id = str(snapshot.get("runId", "")).strip()
    if not run_id:
        raise ValueError("runId is required")

    path = _document_runs_path(document_id)
    runs = _read_runs(path)
    existing_index: int | None = None
    for index, item in enumerate(runs):
        if str(item.get("runId", "")).strip() == run_id:
            existing_index = index
            break

    was_created = existing_index is None
    if existing_index is None:
        previous = runs[-1] if runs else None
        runs.append(snapshot)
        if len(runs) > _MAX_RUNS_PER_DOCUMENT:
            runs = runs[-_MAX_RUNS_PER_DOCUMENT:]
    else:
        previous = runs[existing_index]
        runs[existing_index] = snapshot

    _write_runs(path, runs)
    triage = build_extraction_triage(snapshot)
    _log_triage_report(document_id, triage)
    changed_fields = _log_diff(document_id=document_id, previous=previous, current=snapshot)
    return {
        "document_id": document_id,
        "run_id": run_id,
        "stored_runs": len(runs),
        "changed_fields": changed_fields,
        "was_created": was_created,
    }


def get_extraction_runs(document_id: str) -> list[dict[str, Any]]:
    path = _document_runs_path(document_id)
    return _read_runs(path)


def get_latest_extraction_run_triage(document_id: str) -> dict[str, Any] | None:
    runs = get_extraction_runs(document_id)
    if not runs:
        return None
    latest = runs[-1]
    return build_extraction_triage(latest)


def _truncate_text(value: str | None, *, limit: int = 80) -> str | None:
    if value is None:
        return None
    compact = value.strip()
    if not compact:
        return None
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 1].rstrip()}…"


def summarize_extraction_runs(document_id: str, *, limit: int = 20) -> dict[str, Any] | None:
    runs = get_extraction_runs(document_id)
    if not runs:
        return None

    selected_runs = runs[-max(1, limit):]
    stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "missing_count": 0,
            "rejected_count": 0,
            "accepted_count": 0,
            "suspicious_count": 0,
            "top1_counter": Counter(),
            "top1_confidences": [],
            "missing_top1_counter": Counter(),
            "missing_top1_confidences": [],
            "missing_with_candidates_count": 0,
            "missing_without_candidates_count": 0,
        }
    )

    for run in selected_runs:
        fields = run.get("fields") if isinstance(run.get("fields"), dict) else {}
        for field_key, raw_payload in fields.items():
            if not isinstance(raw_payload, dict):
                continue

            status = str(raw_payload.get("status", "")).strip().lower()
            field_stats = stats[str(field_key)]
            if status == "missing":
                field_stats["missing_count"] += 1
            elif status == "rejected":
                field_stats["rejected_count"] += 1
            elif status == "accepted":
                field_stats["accepted_count"] += 1

            top_candidates = _extract_top_candidates(raw_payload)
            top1 = top_candidates[0] if top_candidates else None
            top1_value = _as_text(top1.get("value")) if isinstance(top1, dict) else None
            if status in {"missing", "rejected"} and top1_value:
                field_stats["top1_counter"][top1_value] += 1
                top1_conf = (
                    _coerce_confidence(top1.get("confidence"))
                    if isinstance(top1, dict)
                    else None
                )
                if top1_conf is not None:
                    field_stats["top1_confidences"].append(top1_conf)

            if status == "missing":
                if top1_value:
                    field_stats["missing_with_candidates_count"] += 1
                    field_stats["missing_top1_counter"][top1_value] += 1
                    missing_top1_conf = (
                        _coerce_confidence(top1.get("confidence"))
                        if isinstance(top1, dict)
                        else None
                    )
                    if missing_top1_conf is not None:
                        field_stats["missing_top1_confidences"].append(
                            missing_top1_conf
                        )
                else:
                    field_stats["missing_without_candidates_count"] += 1

            if status == "accepted":
                value_for_flags = (
                    _as_text(raw_payload.get("valueNormalized"))
                    or _as_text(raw_payload.get("valueRaw"))
                    or _as_text(raw_payload.get("rawCandidate"))
                    or top1_value
                )
                if _suspicious_accepted_flags(str(field_key), value_for_flags):
                    field_stats["suspicious_count"] += 1

    field_rows: list[dict[str, Any]] = []
    for field, field_stats in stats.items():
        top1_sample = None
        if field_stats["top1_counter"]:
            top1_sample = field_stats["top1_counter"].most_common(1)[0][0]

        confidences = field_stats["top1_confidences"]
        avg_conf = None
        if confidences:
            avg_conf = round(sum(confidences) / len(confidences), 2)

        missing_top1_sample = None
        if field_stats["missing_top1_counter"]:
            missing_top1_sample = field_stats["missing_top1_counter"].most_common(1)[0][0]

        missing_confidences = field_stats["missing_top1_confidences"]
        avg_top1_conf = None
        if missing_confidences:
            avg_top1_conf = round(sum(missing_confidences) / len(missing_confidences), 2)

        missing_with_candidates_count = int(field_stats["missing_with_candidates_count"])
        missing_without_candidates_count = int(
            field_stats["missing_without_candidates_count"]
        )
        has_candidates = missing_with_candidates_count > 0

        field_rows.append(
            {
                "field": field,
                "missing_count": int(field_stats["missing_count"]),
                "rejected_count": int(field_stats["rejected_count"]),
                "accepted_count": int(field_stats["accepted_count"]),
                "suspicious_count": int(field_stats["suspicious_count"]),
                "top1_sample": _truncate_text(top1_sample),
                "avg_conf": avg_conf,
                "has_candidates": has_candidates,
                "missing_with_candidates_count": missing_with_candidates_count,
                "missing_without_candidates_count": missing_without_candidates_count,
                "avg_top1_conf": avg_top1_conf,
                "top_key_tokens": _truncate_text(missing_top1_sample, limit=30),
            }
        )

    field_rows.sort(
        key=lambda item: (
            int(item.get("missing_count", 0) or 0),
            int(item.get("rejected_count", 0) or 0),
            int(item.get("suspicious_count", 0) or 0),
            str(item.get("field", "")),
        ),
        reverse=True,
    )

    most_missing = sorted(
        [item for item in field_rows if int(item.get("missing_count", 0) or 0) > 0],
        key=lambda item: (
            int(item.get("missing_count", 0) or 0),
            int(item.get("rejected_count", 0) or 0),
            str(item.get("field", "")),
        ),
        reverse=True,
    )
    most_rejected = sorted(
        [item for item in field_rows if int(item.get("rejected_count", 0) or 0) > 0],
        key=lambda item: (
            int(item.get("rejected_count", 0) or 0),
            int(item.get("missing_count", 0) or 0),
            str(item.get("field", "")),
        ),
        reverse=True,
    )

    missing_fields_with_candidates = sum(
        1
        for item in most_missing
        if bool(item.get("has_candidates"))
    )
    missing_fields_without_candidates = sum(
        1
        for item in most_missing
        if not bool(item.get("has_candidates"))
    )

    summary = {
        "document_id": document_id,
        "total_runs": len(runs),
        "considered_runs": len(selected_runs),
        "missing_fields_with_candidates": missing_fields_with_candidates,
        "missing_fields_without_candidates": missing_fields_without_candidates,
        "fields": field_rows,
        "most_missing_fields": most_missing[:10],
        "most_rejected_fields": most_rejected[:10],
    }
    _log_extraction_runs_summary(summary)
    return summary


def _log_extraction_runs_summary(summary: dict[str, Any]) -> None:
    document_id = _as_text(summary.get("document_id")) or ""
    considered_runs = int(summary.get("considered_runs", 0) or 0)
    missing_with_candidates = int(summary.get("missing_fields_with_candidates", 0) or 0)
    missing_without_candidates = int(summary.get("missing_fields_without_candidates", 0) or 0)
    fields = summary.get("fields") if isinstance(summary.get("fields"), list) else []
    most_missing = (
        summary.get("most_missing_fields")
        if isinstance(summary.get("most_missing_fields"), list)
        else []
    )
    most_rejected = (
        summary.get("most_rejected_fields")
        if isinstance(summary.get("most_rejected_fields"), list)
        else []
    )

    lines = [
        (
            "[extraction-observability] "
            f"document={document_id} runs_summary considered_runs={considered_runs} "
            f"tracked_fields={len(fields)} "
            f"missing_fields_with_candidates={missing_with_candidates} "
            f"missing_fields_without_candidates={missing_without_candidates}"
        ),
        "MOST_MISSING:",
    ]

    if not most_missing:
        lines.append("- none")
    else:
        for item in most_missing[:5]:
            if not isinstance(item, dict):
                continue
            lines.append(
                "- "
                f"{item.get('field')}: missing={int(item.get('missing_count', 0) or 0)} "
                f"rejected={int(item.get('rejected_count', 0) or 0)} "
                f"has_candidates={bool(item.get('has_candidates'))} "
                f"top1={item.get('top1_sample')!r} "
                f"avg_top1_conf={item.get('avg_top1_conf')} "
                f"top_key_tokens={item.get('top_key_tokens')!r}"
            )

    lines.append("MOST_REJECTED:")
    if not most_rejected:
        lines.append("- none")
    else:
        for item in most_rejected[:5]:
            if not isinstance(item, dict):
                continue
            lines.append(
                "- "
                f"{item.get('field')}: rejected={int(item.get('rejected_count', 0) or 0)} "
                f"missing={int(item.get('missing_count', 0) or 0)} "
                f"top1={item.get('top1_sample')!r} avg_conf={item.get('avg_conf')}"
            )

    _emit_info("\n".join(lines))
