"""PDF extraction dispatcher and compatibility surface."""

from __future__ import annotations

import logging
from pathlib import Path

from backend.app.settings import get_pdf_extractor_force

from . import pdf_extraction_nodeps as nodeps
from .constants import PDF_EXTRACTOR_FORCE_ENV

logger = logging.getLogger(__name__)

# Compatibility re-exports kept for tests and processing_runner shim consumers.
PdfCMap = nodeps.PdfCMap
_parse_tounicode_cmap = nodeps._parse_tounicode_cmap
_extract_pdf_text_tokens = nodeps._extract_pdf_text_tokens
_tokenize_pdf_content = nodeps._tokenize_pdf_content
_parse_pdf_array = nodeps._parse_pdf_array
_decode_bytes_with_cmap = nodeps._decode_bytes_with_cmap
_decode_tj_array_for_font = nodeps._decode_tj_array_for_font
_decode_token_for_font = nodeps._decode_token_for_font
_sanitize_text_chunks = nodeps._sanitize_text_chunks
_stitch_text_chunks = nodeps._stitch_text_chunks
_should_join_without_space = nodeps._should_join_without_space
_parse_pdf_literal_string = nodeps._parse_pdf_literal_string
_parse_pdf_literal_string_bytes = nodeps._parse_pdf_literal_string_bytes
_looks_textual_bytes = nodeps._looks_textual_bytes
_parse_pdf_objects = nodeps._parse_pdf_objects
_extract_cmaps_by_object = nodeps._extract_cmaps_by_object
_collect_page_content_streams = nodeps._collect_page_content_streams
_inflate_pdf_stream = nodeps._inflate_pdf_stream
_extract_text_chunks_from_content_stream = nodeps._extract_text_chunks_from_content_stream


def _extract_pdf_text(file_path: Path) -> str:
    text, _ = _extract_pdf_text_with_extractor(file_path)
    return text


def extract_text_from_pdf(file_path: Path) -> str:
    """Public compatibility alias used by legacy imports/checks."""

    return _extract_pdf_text(file_path)


def _extract_pdf_text_with_extractor(file_path: Path) -> tuple[str, str]:
    forced = get_pdf_extractor_force().lower()
    if forced not in ("", "auto", "fitz", "fallback"):
        logger.warning(
            "Unknown %s value '%s'; using auto mode",
            PDF_EXTRACTOR_FORCE_ENV,
            forced,
        )
        forced = "auto"

    if forced == "fallback":
        return _extract_pdf_text_without_external_dependencies(file_path), "fallback"

    if forced == "fitz":
        try:
            return _extract_pdf_text_with_fitz(file_path), "fitz"
        except ImportError as exc:
            from .orchestrator import ProcessingError

            raise ProcessingError("EXTRACTION_FAILED") from exc

    try:
        return _extract_pdf_text_with_fitz(file_path), "fitz"
    except ImportError:
        return _extract_pdf_text_without_external_dependencies(file_path), "fallback"


def _extract_pdf_text_with_fitz(file_path: Path) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise ImportError("PyMuPDF is not installed") from exc

    try:
        with fitz.open(file_path) as document:
            parts = [page.get_text("text") for page in document]
    except Exception as exc:  # pragma: no cover - defensive
        from .orchestrator import ProcessingError

        raise ProcessingError("EXTRACTION_FAILED") from exc

    return "\n".join(parts)


def _extract_pdf_text_without_external_dependencies(file_path: Path) -> str:
    """Wrapper keeps monkeypatch compatibility for tests targeting this module."""

    try:
        return nodeps._extract_pdf_text_without_external_dependencies(
            file_path,
            parse_pdf_objects=_parse_pdf_objects,
            extract_cmaps_by_object=_extract_cmaps_by_object,
            collect_page_content_streams=_collect_page_content_streams,
            inflate_pdf_stream=_inflate_pdf_stream,
            extract_text_chunks_from_content_stream=_extract_text_chunks_from_content_stream,
        )
    except OSError as exc:  # pragma: no cover - defensive
        from .orchestrator import ProcessingError

        raise ProcessingError("EXTRACTION_FAILED") from exc
