"""FastAPI routes (thin adapters).

Route aggregator module for bounded-context route submodules.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi import UploadFile as FastAPIUploadFile

from .routes_calibration import router as calibration_router
from .routes_documents import MAX_UPLOAD_SIZE as DOCUMENTS_MAX_UPLOAD_SIZE
from .routes_documents import _request_content_length as documents_request_content_length
from .routes_documents import router as documents_router
from .routes_health import router as health_router
from .routes_processing import router as processing_router
from .routes_review import router as review_router

UploadFile = FastAPIUploadFile
MAX_UPLOAD_SIZE = DOCUMENTS_MAX_UPLOAD_SIZE
_request_content_length = documents_request_content_length

router = APIRouter()
router.include_router(health_router)
router.include_router(documents_router)
router.include_router(review_router)
router.include_router(processing_router)
router.include_router(calibration_router)
