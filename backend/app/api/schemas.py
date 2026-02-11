"""Pydantic schemas for HTTP request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    status: str = Field(..., description="Current processing status of the document.")
    created_at: str = Field(..., description="UTC ISO timestamp when the document was registered.")


class ProcessingRunResponse(BaseModel):
    run_id: str = Field(..., description="Unique identifier of the processing run.")
    state: str = Field(..., description="Current processing run state.")
    created_at: str = Field(..., description="UTC ISO timestamp when the run was created.")


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


class DocumentListItemResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    original_filename: str = Field(..., description="Original filename recorded at upload time.")
    created_at: str = Field(..., description="UTC ISO timestamp when the document was registered.")
    status: str = Field(..., description="Current processing status of the document.")
    status_label: str = Field(
        ..., description="User-facing status label for list display."
    )
    failure_type: str | None = Field(
        None, description="Failure category when processing failed or timed out."
    )


class DocumentListResponse(BaseModel):
    items: list[DocumentListItemResponse] = Field(
        ..., description="Paginated list of documents with derived status."
    )
    limit: int = Field(..., description="Maximum number of items returned.")
    offset: int = Field(..., description="Pagination offset.")
    total: int = Field(..., description="Total number of documents available.")


class ProcessingStepResponse(BaseModel):
    step_name: str = Field(..., description="Step identifier.")
    step_status: str = Field(..., description="Step execution status.")
    attempt: int = Field(..., description="Attempt number for this step status.")
    started_at: str | None = Field(None, description="UTC ISO timestamp for step start.")
    ended_at: str | None = Field(None, description="UTC ISO timestamp for step end.")
    error_code: str | None = Field(None, description="Step-level error code when failed.")


class ProcessingHistoryRunResponse(BaseModel):
    run_id: str = Field(..., description="Unique identifier of the processing run.")
    state: str = Field(..., description="Processing run state.")
    failure_type: str | None = Field(None, description="Run-level failure category.")
    started_at: str | None = Field(None, description="UTC ISO timestamp when the run started.")
    completed_at: str | None = Field(
        None, description="UTC ISO timestamp when the run completed."
    )
    steps: list[ProcessingStepResponse] = Field(
        ..., description="Step statuses derived from STEP_STATUS artifacts."
    )


class ProcessingHistoryResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    runs: list[ProcessingHistoryRunResponse] = Field(
        ..., description="Chronological processing runs and their steps."
    )


class RawTextArtifactResponse(BaseModel):
    run_id: str = Field(..., description="Unique identifier of the processing run.")
    artifact_type: str = Field(..., description="Artifact type identifier.")
    content_type: str = Field(..., description="Content type for the raw text artifact.")
    text: str = Field(..., description="Extracted raw text content.")
