"""Pydantic schemas for HTTP request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    document_id: str = Field(..., description="Unique identifier of the document.")
    state: str = Field(..., description="Current processing state of the document.")
    message: str = Field(..., description="Human-friendly confirmation message.")
