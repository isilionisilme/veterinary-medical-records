"""SQLite database connection utilities and schema initialization.

This module centralizes the SQLite file location, connection creation, and the
minimal schema used for the current release.
"""

from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = BASE_DIR / "data" / "documents.db"


def get_database_path() -> Path:
    """Resolve the SQLite database file path.

    The path can be overridden via the `VET_RECORDS_DB_PATH` environment
    variable. The parent directory is created if it does not exist.

    Returns:
        Path to the SQLite database file.

    Side Effects:
        Creates the parent directory for the database file when missing.
    """

    env_override = os.environ.get("VET_RECORDS_DB_PATH")
    path = Path(env_override) if env_override else DEFAULT_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Yield a configured SQLite connection.

    The connection uses `sqlite3.Row` for row mapping and is always closed after
    the context exits.

    Yields:
        An open SQLite connection.
    """

    conn = sqlite3.connect(get_database_path(), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def ensure_schema() -> None:
    """Ensure required tables exist for the current application slice.

    Side Effects:
        Creates tables when they do not already exist.
    """

    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS documents (
                document_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                content_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                state TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS document_status_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id TEXT NOT NULL,
                state TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(document_id) REFERENCES documents(document_id)
            );
            """
        )
        conn.commit()
