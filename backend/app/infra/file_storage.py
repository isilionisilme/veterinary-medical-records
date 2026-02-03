"""Filesystem storage utilities for uploaded documents."""

from __future__ import annotations

import os
from pathlib import Path

from backend.app.infra.database import BASE_DIR

DEFAULT_STORAGE_DIR = BASE_DIR / "data" / "uploads"


def get_storage_dir() -> Path:
    """Resolve the directory used to store uploaded files.

    The directory can be overridden via the `VET_RECORDS_STORAGE_DIR` environment
    variable. The directory is created if it does not exist.

    Returns:
        Path to the storage directory.

    Side Effects:
        Creates the directory when missing.
    """

    env_override = os.environ.get("VET_RECORDS_STORAGE_DIR")
    storage_dir = Path(env_override) if env_override else DEFAULT_STORAGE_DIR
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def build_document_path(*, document_id: str, original_filename: str) -> Path:
    """Build a deterministic filesystem path for a stored document.

    Args:
        document_id: Unique identifier for the document.
        original_filename: Original filename as uploaded by the client.

    Returns:
        A full path where the document bytes should be stored.
    """

    suffix = Path(original_filename).suffix.lower() or ".bin"
    return get_storage_dir() / f"{document_id}{suffix}"


def write_document_bytes(*, path: Path, file_bytes: bytes) -> None:
    """Write uploaded bytes to disk without overwriting existing content.

    Args:
        path: Destination path for the stored document.
        file_bytes: Raw bytes to write.

    Raises:
        FileExistsError: When the destination path already exists.
        OSError: For underlying filesystem failures.
    """

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        handle.write(file_bytes)
