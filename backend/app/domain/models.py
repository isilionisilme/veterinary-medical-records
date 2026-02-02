"""Domain models for veterinary medical records."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ProcessingStatus(str, Enum):
    """High-level lifecycle states for a document processing workflow."""

    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    TEXT_EXTRACTED = "TEXT_EXTRACTED"
    TEXT_FAILED = "TEXT_FAILED"
    STRUCTURED = "STRUCTURED"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"


@dataclass(frozen=True, slots=True)
class Document:
    """Immutable document metadata record stored by the system."""

    document_id: str
    filename: str
    content_type: str
    created_at: str
    state: ProcessingStatus
