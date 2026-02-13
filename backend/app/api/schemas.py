"""Pydantic schemas for HTTP request/response contracts."""

from __future__ import annotations

from typing import Literal

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


class LatestCompletedRunReviewResponse(BaseModel):
    run_id: str = Field(..., description="Unique identifier of the latest completed run.")
    state: str = Field(..., description="Processing run state.")
    completed_at: str | None = Field(
        None, description="UTC ISO timestamp when the run completed."
    )
    failure_type: str | None = Field(None, description="Run-level failure category.")


class ActiveInterpretationReviewResponse(BaseModel):
    interpretation_id: str = Field(..., description="Active interpretation identifier.")
    version_number: int = Field(..., description="Active interpretation version number.")
    data: dict[str, object] = Field(..., description="Structured interpretation payload.")


class RawTextArtifactAvailabilityResponse(BaseModel):
    run_id: str = Field(..., description="Processing run identifier.")
    available: bool = Field(..., description="Whether raw text is available for this run.")


class DocumentReviewResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    latest_completed_run: LatestCompletedRunReviewResponse = Field(
        ..., description="Latest completed run used for review."
    )
    active_interpretation: ActiveInterpretationReviewResponse = Field(
        ..., description="Active interpretation for the review run."
    )
    raw_text_artifact: RawTextArtifactAvailabilityResponse = Field(
        ..., description="Raw text availability for the review run."
    )


class ExtractionFieldSnapshotRequest(BaseModel):
    status: Literal["missing", "rejected", "accepted"] = Field(
        ..., description="Field extraction status."
    )
    confidence: Literal["low", "mid", "high"] | None = Field(
        None, description="Confidence bucket when applicable."
    )
    valueNormalized: str | None = Field(
        None, description="Final normalized value used by the UI when accepted."
    )
    valueRaw: str | None = Field(
        None, description="Optional raw extracted value before normalization."
    )
    reason: str | None = Field(
        None, description="Validator rejection reason when status is rejected."
    )
    rawCandidate: str | None = Field(
        None, description="Optional raw candidate value used during extraction triage."
    )
    sourceHint: str | None = Field(
        None, description="Optional source location hint for the raw candidate."
    )
    topCandidates: list[dict[str, object]] | None = Field(
        None,
        description="Optional top candidate list (max 3) with value/confidence/source hints.",
    )


class ExtractionCountsSnapshotRequest(BaseModel):
    totalFields: int
    accepted: int
    rejected: int
    missing: int
    low: int
    mid: int
    high: int


class ExtractionRunSnapshotRequest(BaseModel):
    runId: str
    documentId: str
    createdAt: str
    schemaVersion: str
    fields: dict[str, ExtractionFieldSnapshotRequest]
    counts: ExtractionCountsSnapshotRequest


class ExtractionRunPersistResponse(BaseModel):
    document_id: str
    run_id: str
    stored_runs: int
    changed_fields: int


class ExtractionRunsListResponse(BaseModel):
    document_id: str
    runs: list[dict[str, object]]


class ExtractionTriageSummaryResponse(BaseModel):
    accepted: int
    missing: int
    rejected: int
    low: int
    mid: int
    high: int


class ExtractionTriageItemResponse(BaseModel):
    field: str
    value: str | None = None
    reason: str | None = None
    flags: list[str] = Field(default_factory=list)
    rawCandidate: str | None = None
    sourceHint: str | None = None


class ExtractionRunTriageResponse(BaseModel):
    documentId: str
    runId: str
    createdAt: str
    summary: ExtractionTriageSummaryResponse
    missing: list[ExtractionTriageItemResponse]
    rejected: list[ExtractionTriageItemResponse]
    suspiciousAccepted: list[ExtractionTriageItemResponse]


class ExtractionRunFieldSummaryResponse(BaseModel):
    field: str
    missing_count: int
    rejected_count: int
    accepted_count: int
    suspicious_count: int
    top1_sample: str | None = None
    avg_conf: float | None = None


class ExtractionRunsAggregateSummaryResponse(BaseModel):
    document_id: str
    total_runs: int
    considered_runs: int
    fields: list[ExtractionRunFieldSummaryResponse]
    most_missing_fields: list[ExtractionRunFieldSummaryResponse]
    most_rejected_fields: list[ExtractionRunFieldSummaryResponse]
