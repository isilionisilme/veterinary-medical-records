"""Application configuration helpers."""

from __future__ import annotations

import os

DEFAULT_CONFIDENCE_POLICY_VERSION = "v1"
DEFAULT_CONFIDENCE_LOW_MAX = 0.50
DEFAULT_CONFIDENCE_MID_MAX = 0.75


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
