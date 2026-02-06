"""Pydantic schemas for HTTP request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    status: str = Field(..., description="Current processing status of the document.")
    created_at: str = Field(..., description="UTC ISO timestamp when the document was registered.")


class LatestRunResponse(BaseModel):
    run_id: str = Field(..., description="Unique identifier of the processing run.")
    state: str = Field(..., description="Current processing run state.")
    failure_type: str | None = Field(
        None, description="Failure category for the run when applicable."
    )


class DocumentResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    original_filename: str = Field(..., description="Original filename recorded at upload time.")
    content_type: str = Field(..., description="MIME type recorded at upload time.")
    file_size: int = Field(..., description="File size in bytes.")
    created_at: str = Field(..., description="UTC ISO timestamp when the document was registered.")
    updated_at: str = Field(
        ..., description="UTC ISO timestamp when the document was last updated."
    )
    status: str = Field(..., description="Current processing status of the document.")
    status_message: str = Field(
        ..., description="Human-readable explanation of the current status."
    )
    failure_type: str | None = Field(
        None, description="Failure category when processing failed or timed out."
    )
    latest_run: LatestRunResponse | None = Field(
        None, description="Latest processing run summary when available."
    )
