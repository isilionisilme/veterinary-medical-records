"""Pydantic schemas for HTTP request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    state: str = Field(..., description="Current processing state of the document.")
    message: str = Field(..., description="Human-friendly confirmation message.")


class DocumentResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    filename: str = Field(..., description="Original filename recorded at upload time.")
    content_type: str = Field(..., description="MIME type recorded at upload time.")
    created_at: str = Field(..., description="UTC ISO timestamp when the document was registered.")
    state: str = Field(..., description="Current processing state of the document.")
