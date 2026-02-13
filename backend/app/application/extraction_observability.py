"""Persistence and diff logging for extraction observability snapshots."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

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
        logger.info(
            "[extraction-observability] document=%s run=%s first snapshot persisted",
            document_id,
            current.get("runId"),
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
    logger.info("\n".join(lines))
    return len(change_lines)


def persist_extraction_run_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    document_id = str(snapshot.get("documentId", "")).strip()
    if not document_id:
        raise ValueError("documentId is required")

    path = _document_runs_path(document_id)
    runs = _read_runs(path)
    previous = runs[-1] if runs else None
    runs.append(snapshot)
    if len(runs) > _MAX_RUNS_PER_DOCUMENT:
        runs = runs[-_MAX_RUNS_PER_DOCUMENT:]

    _write_runs(path, runs)
    changed_fields = _log_diff(document_id=document_id, previous=previous, current=snapshot)
    return {
        "document_id": document_id,
        "run_id": str(snapshot.get("runId", "")),
        "stored_runs": len(runs),
        "changed_fields": changed_fields,
    }


def get_extraction_runs(document_id: str) -> list[dict[str, Any]]:
    path = _document_runs_path(document_id)
    return _read_runs(path)
