"""Domain models for veterinary medical records."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ProcessingStatus(str, Enum):
    """Derived document status values exposed to clients."""

    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMED_OUT = "TIMED_OUT"


class ReviewStatus(str, Enum):
    """Human review status for a document."""

    IN_REVIEW = "IN_REVIEW"
    REVIEWED = "REVIEWED"


@dataclass(frozen=True, slots=True)
class Document:
    """Immutable document metadata record stored by the system."""

    document_id: str
    original_filename: str
    content_type: str
    file_size: int
    storage_path: str
    created_at: str
    updated_at: str
    review_status: ReviewStatus
