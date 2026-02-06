"""Pydantic schemas for HTTP request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    status: str = Field(..., description="Current processing status of the document.")
    created_at: str = Field(..., description="UTC ISO timestamp when the document was registered.")


class DocumentResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    original_filename: str = Field(..., description="Original filename recorded at upload time.")
    content_type: str = Field(..., description="MIME type recorded at upload time.")
    file_size: int = Field(..., description="File size in bytes.")
    created_at: str = Field(..., description="UTC ISO timestamp when the document was registered.")
    status: str = Field(..., description="Current processing status of the document.")
