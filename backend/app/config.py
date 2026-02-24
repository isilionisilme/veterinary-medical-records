"""Application configuration helpers."""

from __future__ import annotations

import os

DEFAULT_CONFIDENCE_POLICY_VERSION = "v1"
DEFAULT_CONFIDENCE_LOW_MAX = 0.50
DEFAULT_CONFIDENCE_MID_MAX = 0.75
DEFAULT_HUMAN_EDIT_NEUTRAL_CANDIDATE_CONFIDENCE = 0.50
CONFIDENCE_POLICY_VERSION_ENV = "VET_RECORDS_CONFIDENCE_POLICY_VERSION"
CONFIDENCE_LOW_MAX_ENV = "VET_RECORDS_CONFIDENCE_LOW_MAX"
CONFIDENCE_MID_MAX_ENV = "VET_RECORDS_CONFIDENCE_MID_MAX"
HUMAN_EDIT_NEUTRAL_CANDIDATE_CONFIDENCE_ENV = (
    "VET_RECORDS_HUMAN_EDIT_NEUTRAL_CANDIDATE_CONFIDENCE"
)


def processing_enabled() -> bool:
    """Return whether background processing is enabled."""

    raw = os.environ.get("VET_RECORDS_DISABLE_PROCESSING")
    if raw is None:
        return True
    return raw.strip().lower() not in {"1", "true", "yes", "on"}


def extraction_observability_enabled() -> bool:
    """Return whether extraction observability debug endpoints are enabled."""

    raw = os.environ.get("VET_RECORDS_EXTRACTION_OBS")
    if raw is None:
        return False
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def confidence_policy_version() -> str:
    """Return the active confidence policy version for review payloads."""

    raw = os.environ.get("VET_RECORDS_CONFIDENCE_POLICY_VERSION", "").strip()
    return raw or DEFAULT_CONFIDENCE_POLICY_VERSION


def confidence_band_cutoffs() -> tuple[float, float]:
    """Return (low_max, mid_max) confidence band cutoffs for veterinarian UI."""

    low_raw = os.environ.get("VET_RECORDS_CONFIDENCE_LOW_MAX")
    mid_raw = os.environ.get("VET_RECORDS_CONFIDENCE_MID_MAX")
    try:
        low_max = float(low_raw) if low_raw is not None else DEFAULT_CONFIDENCE_LOW_MAX
        mid_max = float(mid_raw) if mid_raw is not None else DEFAULT_CONFIDENCE_MID_MAX
    except ValueError:
        return DEFAULT_CONFIDENCE_LOW_MAX, DEFAULT_CONFIDENCE_MID_MAX

    if low_max < 0 or mid_max > 1 or low_max >= mid_max:
        return DEFAULT_CONFIDENCE_LOW_MAX, DEFAULT_CONFIDENCE_MID_MAX
    return low_max, mid_max


def confidence_policy_version_or_none() -> str | None:
    """Return policy version when explicitly configured, else None."""

    raw = os.environ.get(CONFIDENCE_POLICY_VERSION_ENV, "").strip()
    return raw or None


def human_edit_neutral_candidate_confidence() -> float:
    """Return neutral candidate confidence baseline for human edits (0..1)."""

    raw = os.environ.get(HUMAN_EDIT_NEUTRAL_CANDIDATE_CONFIDENCE_ENV)
    if raw is None:
        return DEFAULT_HUMAN_EDIT_NEUTRAL_CANDIDATE_CONFIDENCE
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_HUMAN_EDIT_NEUTRAL_CANDIDATE_CONFIDENCE
    if 0 <= value <= 1:
        return value
    return DEFAULT_HUMAN_EDIT_NEUTRAL_CANDIDATE_CONFIDENCE


def confidence_band_cutoffs_or_none() -> tuple[float, float] | None:
    """Return (low_max, mid_max) only when both values are configured and valid."""

    low_raw = os.environ.get(CONFIDENCE_LOW_MAX_ENV)
    mid_raw = os.environ.get(CONFIDENCE_MID_MAX_ENV)
    if low_raw is None or mid_raw is None:
        return None
    try:
        low_max = float(low_raw)
        mid_max = float(mid_raw)
    except ValueError:
        return None

    if low_max < 0 or mid_max > 1 or low_max >= mid_max:
        return None
    return low_max, mid_max


def confidence_policy_explicit_config_diagnostics() -> tuple[bool, str, list[str], list[str]]:
    """Return explicit confidence-policy config status for diagnostics and logs."""

    missing_keys: list[str] = []
    invalid_keys: list[str] = []

    version_raw = os.environ.get(CONFIDENCE_POLICY_VERSION_ENV)
    low_raw = os.environ.get(CONFIDENCE_LOW_MAX_ENV)
    mid_raw = os.environ.get(CONFIDENCE_MID_MAX_ENV)

    if version_raw is None or not version_raw.strip():
        missing_keys.append(CONFIDENCE_POLICY_VERSION_ENV)
    if low_raw is None:
        missing_keys.append(CONFIDENCE_LOW_MAX_ENV)
    if mid_raw is None:
        missing_keys.append(CONFIDENCE_MID_MAX_ENV)

    low_value: float | None = None
    mid_value: float | None = None
    if low_raw is not None:
        try:
            low_value = float(low_raw)
        except ValueError:
            invalid_keys.append(CONFIDENCE_LOW_MAX_ENV)
    if mid_raw is not None:
        try:
            mid_value = float(mid_raw)
        except ValueError:
            invalid_keys.append(CONFIDENCE_MID_MAX_ENV)

    if low_value is not None and not (0 <= low_value <= 1):
        invalid_keys.append(CONFIDENCE_LOW_MAX_ENV)
    if mid_value is not None and not (0 <= mid_value <= 1):
        invalid_keys.append(CONFIDENCE_MID_MAX_ENV)
    if low_value is not None and mid_value is not None and low_value >= mid_value:
        invalid_keys.extend([CONFIDENCE_LOW_MAX_ENV, CONFIDENCE_MID_MAX_ENV])

    missing_keys = sorted(missing_keys)
    invalid_keys = sorted(set(invalid_keys))
    if missing_keys or invalid_keys:
        reason = "policy_invalid" if invalid_keys else "policy_not_configured"
        return False, reason, missing_keys, invalid_keys
    return True, "policy_configured", [], []
