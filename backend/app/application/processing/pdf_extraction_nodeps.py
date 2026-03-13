"""Thin fallback PDF extraction orchestrator without external dependencies."""

from __future__ import annotations

import re
import time
import zlib
from collections.abc import Callable
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path

_PDF_STREAM_PATTERN = re.compile(rb"stream\r?\n(.*?)\r?\nendstream", re.DOTALL)
_OBJECT_PATTERN = re.compile(rb"(\d+)\s+(\d+)\s+obj(.*?)endobj", re.DOTALL)

MAX_CONTENT_STREAM_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHUNKS = 20000
MAX_TOKENS_PER_STREAM = 25000
MAX_ARRAY_ITEMS = 3000
MAX_SINGLE_STREAM_BYTES = 1 * 1024 * 1024
MAX_EXTRACTION_SECONDS = 20.0
MAX_CMAP_STREAM_BYTES = 256 * 1024

_ACTIVE_EXTRACTION_DEADLINE: ContextVar[float | None] = ContextVar(
    "_ACTIVE_EXTRACTION_DEADLINE", default=None
)


@dataclass(frozen=True, slots=True)
class PdfCMap:
    codepoints: dict[int, str]
    code_lengths: tuple[int, ...]


def _deadline_exceeded() -> bool:
    deadline = _ACTIVE_EXTRACTION_DEADLINE.get()
    if deadline is None:
        return False
    return time.monotonic() > deadline


def _inflate_pdf_stream(stream: bytes) -> bytes | None:
    try:
        return zlib.decompress(stream)
    except zlib.error:
        return None


def _parse_pdf_objects(pdf_bytes: bytes) -> dict[int, bytes]:
    objects: dict[int, bytes] = {}
    for match in _OBJECT_PATTERN.finditer(pdf_bytes):
        objects[int(match.group(1))] = match.group(3)
    return objects


def _extract_pdf_text_without_external_dependencies(
    file_path: Path,
    *,
    parse_pdf_objects: Callable[[bytes], dict[int, bytes]] | None = None,
    extract_cmaps_by_object: Callable[[dict[int, bytes]], dict[int, PdfCMap]] | None = None,
    collect_page_content_streams: Callable[..., list[tuple[bytes, dict[str, PdfCMap]]]]
    | None = None,
    inflate_pdf_stream: Callable[[bytes], bytes | None] | None = None,
    extract_text_chunks_from_content_stream: Callable[..., list[str]] | None = None,
) -> str:
    from .pdf_cmap_parsing import _extract_cmaps_by_object
    from .pdf_page_structure import _collect_page_content_streams
    from .pdf_text_decoder import _extract_text_chunks_from_content_stream
    from .pdf_text_quality import _sanitize_text_chunks, _stitch_text_chunks

    started_at = time.monotonic()
    _deadline_token = _ACTIVE_EXTRACTION_DEADLINE.set(started_at + MAX_EXTRACTION_SECONDS)

    parse_pdf_objects_fn = parse_pdf_objects or _parse_pdf_objects
    extract_cmaps_by_object_fn = extract_cmaps_by_object or _extract_cmaps_by_object
    collect_page_content_streams_fn = collect_page_content_streams or _collect_page_content_streams
    inflate_pdf_stream_fn = inflate_pdf_stream or _inflate_pdf_stream
    extract_text_chunks_fn = (
        extract_text_chunks_from_content_stream or _extract_text_chunks_from_content_stream
    )

    try:
        pdf_bytes = file_path.read_bytes()
        objects = parse_pdf_objects_fn(pdf_bytes)
        cmap_by_object = extract_cmaps_by_object_fn(objects)
        page_streams = collect_page_content_streams_fn(
            objects=objects,
            cmap_by_object=cmap_by_object,
        )
        text_chunks: list[str] = []
        total_bytes = 0

        for chunk, font_to_cmap in page_streams:
            if _deadline_exceeded():
                break
            if not chunk or len(chunk) > MAX_SINGLE_STREAM_BYTES:
                continue
            total_bytes += len(chunk)
            if total_bytes > MAX_CONTENT_STREAM_BYTES:
                break
            text_chunks.extend(
                extract_text_chunks_fn(
                    chunk=chunk,
                    font_to_cmap=font_to_cmap,
                    fallback_cmaps=list(font_to_cmap.values()),
                )
            )
            if len(text_chunks) > MAX_TEXT_CHUNKS:
                break

        if not page_streams:
            for match in _PDF_STREAM_PATTERN.finditer(pdf_bytes):
                if _deadline_exceeded():
                    break
                inflated = inflate_pdf_stream_fn(match.group(1))
                if inflated is None or b"BT" not in inflated or b"ET" not in inflated:
                    continue
                text_chunks.extend(
                    extract_text_chunks_fn(
                        chunk=inflated,
                        font_to_cmap={},
                        fallback_cmaps=[],
                    )
                )
                if len(text_chunks) > MAX_TEXT_CHUNKS:
                    break

        return _stitch_text_chunks(_sanitize_text_chunks(text_chunks))
    finally:
        _ACTIVE_EXTRACTION_DEADLINE.reset(_deadline_token)


from .pdf_content_tokenizer import _tokenize_pdf_content as _tokenize_pdf_content  # noqa: E402
from .pdf_page_structure import _extract_object_stream as _extract_object_stream  # noqa: E402
