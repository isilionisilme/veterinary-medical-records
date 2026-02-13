"""Application configuration helpers."""

from __future__ import annotations

import os


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
