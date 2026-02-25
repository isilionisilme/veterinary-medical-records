"""Processing subsystem modules extracted from processing_runner."""

from __future__ import annotations

import logging
import os
import re
import time
import zlib
from dataclasses import dataclass
from pathlib import Path

from .constants import _WHITESPACE_PATTERN, PDF_EXTRACTOR_FORCE_ENV

logger = logging.getLogger(__name__)
_PDF_STREAM_PATTERN = re.compile(rb"stream\r?\n(.*?)\r?\nendstream", re.DOTALL)
_OBJECT_PATTERN = re.compile(rb"(\d+)\s+(\d+)\s+obj(.*?)endobj", re.DOTALL)
_HEX_STRING_PATTERN = re.compile(rb"<([0-9A-Fa-f\s]+)>")
_HEX_PAIR_PATTERN = re.compile(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>")
_BFRANGE_ARRAY_ENTRY_PATTERN = re.compile(rb"<([0-9A-Fa-f]+)>")
_FONT_SELECTION_PATTERN = re.compile(rb"/([^\s/<>{}\[\]()]+)\s+[-+]?\d+(?:\.\d+)?\s+Tf")
_FONT_DICT_INLINE_PATTERN = re.compile(rb"/Font\s*<<(.*?)>>", re.DOTALL)
_FONT_DICT_REF_PATTERN = re.compile(rb"/Font\s+(\d+)\s+0\s+R")
_FONT_ENTRY_PATTERN = re.compile(rb"/([^\s/<>{}\[\]()]+)\s+(\d+)\s+0\s+R")
_TOUNICODE_REF_PATTERN = re.compile(rb"/ToUnicode\s+(\d+)\s+0\s+R")
_PAGE_TYPE_PATTERN = re.compile(rb"/Type\s*/Page\b")
_PAGE_CONTENTS_ARRAY_PATTERN = re.compile(rb"/Contents\s*\[(.*?)\]", re.DOTALL)
_PAGE_CONTENTS_SINGLE_PATTERN = re.compile(rb"/Contents\s+(\d+)\s+\d+\s+R")
_PAGE_RESOURCES_REF_PATTERN = re.compile(rb"/Resources\s+(\d+)\s+\d+\s+R")
_PAGE_RESOURCES_INLINE_PATTERN = re.compile(rb"/Resources\s*<<(.*?)>>", re.DOTALL)
_OBJECT_REF_PATTERN = re.compile(rb"(\d+)\s+\d+\s+R")

MAX_CONTENT_STREAM_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHUNKS = 20000
MAX_TOKENS_PER_STREAM = 25000
MAX_ARRAY_ITEMS = 3000
MAX_SINGLE_STREAM_BYTES = 1 * 1024 * 1024
MAX_EXTRACTION_SECONDS = 20.0
MAX_CMAP_STREAM_BYTES = 256 * 1024
_ACTIVE_EXTRACTION_DEADLINE: float | None = None


def _extract_pdf_text(file_path: Path) -> str:
    text, _ = _extract_pdf_text_with_extractor(file_path)
    return text


def _extract_pdf_text_with_extractor(file_path: Path) -> tuple[str, str]:
    forced = os.getenv(PDF_EXTRACTOR_FORCE_ENV, "").strip().lower()
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


@dataclass(frozen=True, slots=True)
class PdfCMap:
    codepoints: dict[int, str]
    code_lengths: tuple[int, ...]


def _extract_pdf_text_without_external_dependencies(file_path: Path) -> str:
    started_at = time.monotonic()
    global _ACTIVE_EXTRACTION_DEADLINE
    _ACTIVE_EXTRACTION_DEADLINE = started_at + MAX_EXTRACTION_SECONDS

    def _timed_out() -> bool:
        return (time.monotonic() - started_at) > MAX_EXTRACTION_SECONDS

    try:
        try:
            pdf_bytes = file_path.read_bytes()
        except OSError as exc:  # pragma: no cover - defensive
            from .orchestrator import ProcessingError

            raise ProcessingError("EXTRACTION_FAILED") from exc

        objects = _parse_pdf_objects(pdf_bytes)
        cmap_by_object = _extract_cmaps_by_object(objects)
        page_streams = _collect_page_content_streams(objects=objects, cmap_by_object=cmap_by_object)
        text_chunks: list[str] = []
        total_bytes = 0
        for chunk, font_to_cmap in page_streams:
            if _timed_out():
                break
            if not chunk:
                continue
            if len(chunk) > MAX_SINGLE_STREAM_BYTES:
                continue
            total_bytes += len(chunk)
            if total_bytes > MAX_CONTENT_STREAM_BYTES:
                break
            fallback_cmaps = list(font_to_cmap.values())
            text_chunks.extend(
                _extract_text_chunks_from_content_stream(
                    chunk=chunk,
                    font_to_cmap=font_to_cmap,
                    fallback_cmaps=fallback_cmaps,
                )
            )
            if len(text_chunks) > MAX_TEXT_CHUNKS:
                break

        # Last-resort fallback only when page stream discovery fails.
        if not page_streams:
            for match in _PDF_STREAM_PATTERN.finditer(pdf_bytes):
                if _timed_out():
                    break
                stream = match.group(1)
                inflated = _inflate_pdf_stream(stream)
                if inflated is None:
                    continue
                if b"BT" not in inflated or b"ET" not in inflated:
                    continue
                text_chunks.extend(
                    _extract_text_chunks_from_content_stream(
                        chunk=inflated,
                        font_to_cmap={},
                        fallback_cmaps=[],
                    )
                )
                if len(text_chunks) > MAX_TEXT_CHUNKS:
                    break

        sanitized_chunks = _sanitize_text_chunks(text_chunks)
        return _stitch_text_chunks(sanitized_chunks)
    finally:
        _ACTIVE_EXTRACTION_DEADLINE = None


def _deadline_exceeded() -> bool:
    if _ACTIVE_EXTRACTION_DEADLINE is None:
        return False
    return time.monotonic() > _ACTIVE_EXTRACTION_DEADLINE


def _inflate_pdf_stream(stream: bytes) -> bytes | None:
    try:
        return zlib.decompress(stream)
    except zlib.error:
        return None


def _parse_tounicode_cmap(chunk: bytes) -> PdfCMap | None:
    if b"begincmap" not in chunk:
        return None

    code_lengths: set[int] = set()
    for codespace_match in re.finditer(
        rb"\d+\s+begincodespacerange(.*?)endcodespacerange",
        chunk,
        re.DOTALL,
    ):
        for start_hex, _ in _HEX_PAIR_PATTERN.findall(codespace_match.group(1)):
            code_lengths.add(max(1, len(start_hex) // 2))
    if not code_lengths:
        code_lengths.add(1)

    mapping: dict[int, str] = {}

    for bfchar_match in re.finditer(
        rb"\d+\s+beginbfchar(.*?)endbfchar",
        chunk,
        re.DOTALL,
    ):
        for src_hex, dst_hex in _HEX_PAIR_PATTERN.findall(bfchar_match.group(1)):
            src = int(src_hex, 16)
            mapping[src] = _decode_unicode_hex(dst_hex)

    for bfrange_match in re.finditer(
        rb"\d+\s+beginbfrange(.*?)endbfrange",
        chunk,
        re.DOTALL,
    ):
        for line in bfrange_match.group(1).splitlines():
            line = line.strip()
            if not line:
                continue

            pair_match = re.match(
                rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>",
                line,
            )
            if pair_match:
                start_hex, end_hex, dst_start_hex = pair_match.groups()
                start = int(start_hex, 16)
                end = int(end_hex, 16)
                dst_start = int(dst_start_hex, 16)
                for offset, code in enumerate(range(start, end + 1)):
                    mapping[code] = _decode_unicode_hex(
                        f"{dst_start + offset:0{len(dst_start_hex)}X}".encode("ascii")
                    )
                continue

            array_match = re.match(
                rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*)\]",
                line,
            )
            if not array_match:
                continue
            start_hex, end_hex, destinations = array_match.groups()
            start = int(start_hex, 16)
            end = int(end_hex, 16)
            destination_values = _BFRANGE_ARRAY_ENTRY_PATTERN.findall(destinations)
            for offset, code in enumerate(range(start, end + 1)):
                if offset >= len(destination_values):
                    break
                mapping[code] = _decode_unicode_hex(destination_values[offset])

    if not mapping:
        return None
    return PdfCMap(
        codepoints=mapping,
        code_lengths=tuple(sorted(code_lengths, reverse=True)),
    )


def _parse_pdf_objects(pdf_bytes: bytes) -> dict[int, bytes]:
    objects: dict[int, bytes] = {}
    for match in _OBJECT_PATTERN.finditer(pdf_bytes):
        object_id = int(match.group(1))
        objects[object_id] = match.group(3)
    return objects


def _extract_cmaps_by_object(objects: dict[int, bytes]) -> dict[int, PdfCMap]:
    cmaps: dict[int, PdfCMap] = {}
    for object_id, object_payload in objects.items():
        if _deadline_exceeded():
            break
        stream = _extract_object_stream(object_payload, max_bytes=MAX_CMAP_STREAM_BYTES)
        if stream is None:
            continue
        cmap = _parse_tounicode_cmap(stream)
        if cmap is not None:
            cmaps[object_id] = cmap
    return cmaps


def _collect_page_content_streams(
    *,
    objects: dict[int, bytes],
    cmap_by_object: dict[int, PdfCMap],
) -> list[tuple[bytes, dict[str, PdfCMap]]]:
    page_streams: list[tuple[bytes, dict[str, PdfCMap]]] = []
    for page_payload in objects.values():
        if not _PAGE_TYPE_PATTERN.search(page_payload):
            continue

        font_to_cmap = _extract_font_to_cmap_for_page(
            page_payload=page_payload,
            objects=objects,
            cmap_by_object=cmap_by_object,
        )
        for content_object_id in _extract_page_content_object_ids(page_payload):
            content_payload = objects.get(content_object_id)
            if content_payload is None:
                continue
            stream = _extract_object_stream(content_payload)
            if stream is None:
                continue
            page_streams.append((stream, font_to_cmap))
    return page_streams


def _extract_page_content_object_ids(page_payload: bytes) -> list[int]:
    contents_ids: list[int] = []
    array_match = _PAGE_CONTENTS_ARRAY_PATTERN.search(page_payload)
    if array_match:
        refs = _OBJECT_REF_PATTERN.findall(array_match.group(1))
        contents_ids.extend(int(ref) for ref in refs)
        return contents_ids

    single_match = _PAGE_CONTENTS_SINGLE_PATTERN.search(page_payload)
    if single_match:
        contents_ids.append(int(single_match.group(1)))
    return contents_ids


def _extract_font_to_cmap_for_page(
    *,
    page_payload: bytes,
    objects: dict[int, bytes],
    cmap_by_object: dict[int, PdfCMap],
) -> dict[str, PdfCMap]:
    resource_payload = _resolve_page_resources(page_payload=page_payload, objects=objects)
    if resource_payload is None:
        return {}
    return _build_font_to_cmap_from_page_resources(
        resource_payload=resource_payload,
        objects=objects,
        cmap_by_object=cmap_by_object,
    )


def _resolve_page_resources(
    *,
    page_payload: bytes,
    objects: dict[int, bytes],
) -> bytes | None:
    inline_match = _PAGE_RESOURCES_INLINE_PATTERN.search(page_payload)
    if inline_match:
        return inline_match.group(1)

    ref_match = _PAGE_RESOURCES_REF_PATTERN.search(page_payload)
    if ref_match is None:
        return None
    return objects.get(int(ref_match.group(1)))


def _extract_object_stream(object_payload: bytes, max_bytes: int | None = None) -> bytes | None:
    match = re.search(rb"stream\r?\n(.*?)\r?\nendstream", object_payload, re.DOTALL)
    if match is None:
        return None
    raw_stream = match.group(1)
    if max_bytes is not None and len(raw_stream) > max_bytes:
        return None
    inflated = _inflate_pdf_stream(raw_stream)
    if inflated is not None:
        if max_bytes is not None and len(inflated) > max_bytes:
            return None
        return inflated
    if _looks_textual_bytes(raw_stream) and b"BT" in raw_stream and b"ET" in raw_stream:
        return raw_stream
    return None


def _build_font_to_cmap_from_page_resources(
    *,
    resource_payload: bytes,
    objects: dict[int, bytes],
    cmap_by_object: dict[int, PdfCMap],
) -> dict[str, PdfCMap]:
    font_name_to_font_object = _extract_font_entries_from_resource_payload(
        resource_payload=resource_payload,
        objects=objects,
    )

    mapping: dict[str, PdfCMap] = {}
    for font_name, font_object_id in font_name_to_font_object.items():
        font_payload = objects.get(font_object_id)
        if font_payload is None:
            continue
        to_unicode_ref = _TOUNICODE_REF_PATTERN.search(font_payload)
        if to_unicode_ref is None:
            continue
        cmap = cmap_by_object.get(int(to_unicode_ref.group(1)))
        if cmap is not None:
            mapping[font_name] = cmap
    return mapping


def _extract_font_entries_from_resource_payload(
    *,
    resource_payload: bytes,
    objects: dict[int, bytes],
) -> dict[str, int]:
    font_name_to_font_object: dict[str, int] = {}

    for inline_dict in _FONT_DICT_INLINE_PATTERN.findall(resource_payload):
        for font_name, font_object in _FONT_ENTRY_PATTERN.findall(inline_dict):
            parsed_name = font_name.decode("ascii", "ignore")
            if not parsed_name:
                continue
            font_name_to_font_object[parsed_name] = int(font_object)

    for font_dict_object in _FONT_DICT_REF_PATTERN.findall(resource_payload):
        referenced = objects.get(int(font_dict_object))
        if referenced is None:
            continue
        for font_name, font_object in _FONT_ENTRY_PATTERN.findall(referenced):
            parsed_name = font_name.decode("ascii", "ignore")
            if not parsed_name:
                continue
            font_name_to_font_object[parsed_name] = int(font_object)

    return font_name_to_font_object


def _extract_font_events(chunk: bytes) -> list[tuple[int, str]]:
    events: list[tuple[int, str]] = []
    for match in _FONT_SELECTION_PATTERN.finditer(chunk):
        events.append((match.start(), match.group(1).decode("ascii", "ignore")))
    return events


def _active_font_name(position: int, font_events: list[tuple[int, str]]) -> str | None:
    active: str | None = None
    for event_position, font_name in font_events:
        if event_position > position:
            break
        active = font_name
    return active


def _decode_unicode_hex(hex_value: bytes) -> str:
    if len(hex_value) % 2 == 1:
        hex_value = b"0" + hex_value
    raw = bytes.fromhex(hex_value.decode("ascii"))
    if len(raw) % 2 == 0 and len(raw) >= 2:
        try:
            return raw.decode("utf-16-be")
        except UnicodeDecodeError:
            pass
    return raw.decode("latin-1", errors="ignore")


def _extract_pdf_text_tokens(chunk: bytes) -> list[tuple[int, bytes]]:
    tokens: list[tuple[int, bytes]] = []

    for hex_match in _HEX_STRING_PATTERN.finditer(chunk):
        compact = re.sub(rb"\s+", b"", hex_match.group(1))
        if not compact:
            continue
        if len(compact) % 2 == 1:
            compact = b"0" + compact
        try:
            tokens.append((hex_match.start(), bytes.fromhex(compact.decode("ascii"))))
        except ValueError:
            continue

    index = 0
    length = len(chunk)
    while index < length:
        if chunk[index] != 40:  # "("
            index += 1
            continue
        start_index = index
        parsed, next_index = _parse_pdf_literal_string_bytes(chunk, index + 1)
        if parsed:
            tokens.append((start_index, parsed))
        index = next_index

    tokens.sort(key=lambda item: item[0])
    return tokens


def _extract_text_chunks_from_content_stream(
    *,
    chunk: bytes,
    font_to_cmap: dict[str, PdfCMap],
    fallback_cmaps: list[PdfCMap],
) -> list[str]:
    extracted: list[str] = []
    in_text_object = False
    active_font: str | None = None
    active_cmap: PdfCMap | None = None
    operand_stack: list[object] = []

    for token in _tokenize_pdf_content(chunk):
        if isinstance(token, str):
            if token.startswith("/"):
                operand_stack.append(token)
                continue
            if token == "BT":
                in_text_object = True
                operand_stack.clear()
                continue
            if token == "ET":
                in_text_object = False
                active_font = None
                operand_stack.clear()
                continue

            if not in_text_object:
                operand_stack.clear()
                continue

            if token == "Tf":
                if len(operand_stack) >= 2 and isinstance(operand_stack[-2], str):
                    font_name = operand_stack[-2]
                    if font_name.startswith("/"):
                        active_font = font_name[1:]
                        active_cmap = font_to_cmap.get(active_font)
                operand_stack.clear()
                continue

            if token == "Tj":
                if operand_stack and isinstance(operand_stack[-1], bytes):
                    extracted_token, selected_cmap = _decode_token_for_font(
                        token_bytes=operand_stack[-1],
                        active_cmap=active_cmap,
                        active_font=active_font,
                        font_to_cmap=font_to_cmap,
                        fallback_cmaps=fallback_cmaps,
                    )
                    if selected_cmap is not None and active_cmap is None:
                        active_cmap = selected_cmap
                    if extracted_token:
                        extracted.append(extracted_token)
                operand_stack.clear()
                continue

            if token == "TJ":
                if operand_stack and isinstance(operand_stack[-1], list):
                    decoded_array, selected_cmap = _decode_tj_array_for_font(
                        array_items=operand_stack[-1],
                        active_cmap=active_cmap,
                        active_font=active_font,
                        font_to_cmap=font_to_cmap,
                        fallback_cmaps=fallback_cmaps,
                    )
                    if selected_cmap is not None:
                        active_cmap = selected_cmap
                    if decoded_array:
                        extracted.append(decoded_array)
                operand_stack.clear()
                continue

            # Unknown operator inside a text object.
            operand_stack.clear()
            continue

        operand_stack.append(token)

    return extracted


def _decode_token_for_font(
    *,
    token_bytes: bytes,
    active_cmap: PdfCMap | None,
    active_font: str | None,
    font_to_cmap: dict[str, PdfCMap],
    fallback_cmaps: list[PdfCMap],
) -> tuple[str, PdfCMap | None]:
    if active_cmap is not None:
        return _decode_pdf_text_token(token_bytes, [active_cmap]), active_cmap

    primary = font_to_cmap.get(active_font) if active_font else None
    if primary is not None:
        return _decode_pdf_text_token(token_bytes, [primary]), primary

    if not fallback_cmaps:
        return _decode_pdf_text_token(token_bytes, []), None

    best_text = ""
    best_cmap: PdfCMap | None = None
    best_score = float("-inf")
    for cmap in fallback_cmaps[:4]:
        decoded = _decode_pdf_text_token(token_bytes, [cmap])
        score = _decoded_text_score(_normalize_candidate_text(decoded))
        if score > best_score:
            best_score = score
            best_text = decoded
            best_cmap = cmap
    return best_text, best_cmap


def _decode_tj_array_for_font(
    *,
    array_items: list[object],
    active_cmap: PdfCMap | None,
    active_font: str | None,
    font_to_cmap: dict[str, PdfCMap],
    fallback_cmaps: list[PdfCMap],
) -> tuple[str, PdfCMap | None]:
    candidate_cmaps: list[PdfCMap]
    if active_cmap is not None:
        candidate_cmaps = [active_cmap]
    else:
        primary = font_to_cmap.get(active_font) if active_font else None
        if primary is not None:
            candidate_cmaps = [primary]
        else:
            candidate_cmaps = fallback_cmaps[:4]

    if not candidate_cmaps:
        return "", None

    best_text = ""
    best_cmap: PdfCMap | None = None
    best_score = float("-inf")
    for cmap in candidate_cmaps:
        parts: list[str] = []
        for item in array_items:
            if isinstance(item, bytes):
                decoded = _decode_pdf_text_token(item, [cmap])
                if decoded:
                    parts.append(decoded)
                continue
            # In TJ arrays, strongly negative spacing often indicates a visual gap.
            if isinstance(item, int | float) and item < -180:
                parts.append(" ")
        candidate_text = "".join(parts)
        score = _decoded_text_score(_normalize_candidate_text(candidate_text))
        if score > best_score:
            best_score = score
            best_text = candidate_text
            best_cmap = cmap

    return best_text, best_cmap


def _tokenize_pdf_content(content: bytes) -> list[object]:
    tokens: list[object] = []
    index = 0
    length = len(content)
    while index < length:
        if _deadline_exceeded():
            return tokens
        byte = content[index]

        if byte in b" \t\r\n\x00":
            index += 1
            continue
        if byte == 37:  # "%"
            while index < length and content[index] not in b"\r\n":
                index += 1
            continue
        if byte == 40:  # "("
            parsed, next_index = _parse_pdf_literal_string_bytes(content, index + 1)
            tokens.append(parsed)
            if len(tokens) >= MAX_TOKENS_PER_STREAM:
                return tokens
            index = next_index
            continue
        if byte == 91:  # "["
            parsed_array, next_index = _parse_pdf_array(content, index + 1)
            tokens.append(parsed_array)
            if len(tokens) >= MAX_TOKENS_PER_STREAM:
                return tokens
            index = next_index
            continue
        if byte == 60 and index + 1 < length and content[index + 1] != 60:  # "<...>"
            hex_end = content.find(b">", index + 1)
            if hex_end == -1:
                break
            compact = re.sub(rb"\s+", b"", content[index + 1 : hex_end])
            if compact:
                if len(compact) % 2 == 1:
                    compact = b"0" + compact
                try:
                    tokens.append(bytes.fromhex(compact.decode("ascii")))
                    if len(tokens) >= MAX_TOKENS_PER_STREAM:
                        return tokens
                except ValueError:
                    pass
            index = hex_end + 1
            continue

        start = index
        if byte == 47:  # "/"
            index += 1
            while index < length and content[index] not in b" \t\r\n[]()<>\x00":
                index += 1
            tokens.append(content[start:index].decode("latin-1", errors="ignore"))
            if len(tokens) >= MAX_TOKENS_PER_STREAM:
                return tokens
            continue

        while index < length and content[index] not in b" \t\r\n[]()<>/\x00":
            index += 1
        if start == index:
            index += 1
            continue
        word = content[start:index].decode("latin-1", errors="ignore")
        numeric = _parse_number_token(word)
        if numeric is not None:
            tokens.append(numeric)
        else:
            tokens.append(word)
        if len(tokens) >= MAX_TOKENS_PER_STREAM:
            return tokens

    return tokens


def _parse_pdf_array(content: bytes, index: int) -> tuple[list[object], int]:
    values: list[object] = []
    length = len(content)
    while index < length:
        if _deadline_exceeded():
            return values, length
        if len(values) >= MAX_ARRAY_ITEMS:
            return values, length
        byte = content[index]
        if byte in b" \t\r\n\x00":
            index += 1
            continue
        if byte == 93:  # "]"
            return values, index + 1
        if byte == 40:
            parsed, next_index = _parse_pdf_literal_string_bytes(content, index + 1)
            values.append(parsed)
            index = next_index
            continue
        if byte == 91:
            nested, next_index = _parse_pdf_array(content, index + 1)
            values.append(nested)
            index = next_index
            continue
        if byte == 60 and index + 1 < length and content[index + 1] != 60:
            hex_end = content.find(b">", index + 1)
            if hex_end == -1:
                return values, length
            compact = re.sub(rb"\s+", b"", content[index + 1 : hex_end])
            if compact:
                if len(compact) % 2 == 1:
                    compact = b"0" + compact
                try:
                    values.append(bytes.fromhex(compact.decode("ascii")))
                except ValueError:
                    pass
            index = hex_end + 1
            continue
        if byte == 47:
            start = index
            index += 1
            while index < length and content[index] not in b" \t\r\n[]()<>\x00":
                index += 1
            values.append(content[start:index].decode("latin-1", errors="ignore"))
            continue

        start = index
        while index < length and content[index] not in b" \t\r\n[]()<>/\x00":
            index += 1
        if start == index:
            index += 1
            continue
        word = content[start:index].decode("latin-1", errors="ignore")
        numeric = _parse_number_token(word)
        if numeric is not None:
            values.append(numeric)
        else:
            values.append(word)

    return values, length


def _parse_number_token(token: str) -> int | float | None:
    if not token:
        return None
    try:
        if "." in token:
            return float(token)
        return int(token)
    except ValueError:
        return None


def _normalize_candidate_text(text: str) -> str:
    normalized = _WHITESPACE_PATTERN.sub(" ", text).strip()
    return normalized


def _decode_pdf_text_token(token: bytes, cmaps: list[PdfCMap | None]) -> str:
    # Keep a raw-byte fallback candidate to avoid forcing a bad cmap decode.
    candidates: list[str] = [token.decode("latin-1", errors="ignore")]
    for cmap in cmaps:
        if cmap is None:
            continue
        decoded = _decode_bytes_with_cmap(token, cmap)
        if decoded:
            candidates.append(decoded)

    best_text = ""
    best_score = float("-inf")
    for candidate in candidates:
        normalized = _normalize_candidate_text(candidate)
        if not normalized:
            continue
        score = _decoded_text_score(normalized)
        if score > best_score:
            best_score = score
            best_text = candidate
    return best_text


def _decode_bytes_with_cmap(token: bytes, cmap: PdfCMap) -> str:
    chars: list[str] = []
    index = 0
    length = len(token)
    while index < length:
        matched = False
        for code_length in cmap.code_lengths:
            if index + code_length > length:
                continue
            code = int.from_bytes(token[index : index + code_length], byteorder="big")
            mapped = cmap.codepoints.get(code)
            if mapped is None:
                continue
            chars.append(mapped)
            index += code_length
            matched = True
            break
        if matched:
            continue

        chars.append(bytes([token[index]]).decode("latin-1", errors="ignore"))
        index += 1

    return "".join(chars)


def _decoded_text_score(text: str) -> float:
    letters = sum(char.isalpha() for char in text)
    if letters == 0:
        return -100.0
    spaces = sum(char.isspace() for char in text)
    punctuation = sum((not char.isalnum()) and (not char.isspace()) for char in text)
    vowels = sum(char.lower() in "aeiouáéíóúü" for char in text if char.isalpha())
    length = len(text)
    vowel_ratio = vowels / letters
    punctuation_ratio = punctuation / length
    space_ratio = spaces / length
    return letters / length + vowel_ratio + space_ratio * 0.5 - punctuation_ratio * 1.5


def _sanitize_text_chunks(chunks: list[str]) -> list[str]:
    sanitized: list[str] = []
    for chunk in chunks:
        cleaned = chunk.replace("\x00", "").replace("\ufeff", "")
        normalized = _normalize_candidate_text(cleaned)
        if not normalized:
            continue
        if sanitized and normalized == sanitized[-1]:
            continue
        if len(normalized) <= 2 and normalized.isalpha():
            sanitized.append(normalized)
            continue

        if _is_readable_text_chunk(normalized):
            sanitized.append(normalized)
    return sanitized


def _is_readable_text_chunk(chunk: str) -> bool:
    if len(chunk) < 3:
        return False

    letters = sum(char.isalpha() for char in chunk)
    digits = sum(char.isdigit() for char in chunk)
    punctuation = sum((not char.isalnum()) and (not char.isspace()) for char in chunk)
    if letters == 0:
        return False

    length = len(chunk)
    letter_ratio = letters / length
    digit_ratio = digits / length
    punctuation_ratio = punctuation / length
    vowels = sum(char.lower() in "aeiouáéíóúü" for char in chunk if char.isalpha())
    vowel_ratio = vowels / letters if letters else 0
    uppercase_letters = sum(char.isupper() for char in chunk if char.isalpha())
    uppercase_ratio = uppercase_letters / letters if letters else 0
    score = _decoded_text_score(chunk)

    if score < 1.1:
        return False
    if letter_ratio < 0.45:
        return False
    if digit_ratio > 0.15:
        return False
    if punctuation_ratio > 0.25:
        return False
    if vowel_ratio < 0.25:
        return False
    if len(chunk) > 12 and uppercase_ratio > 0.8 and vowel_ratio < 0.4:
        return False
    if "'" in chunk and chunk.count("'") > max(1, len(chunk) // 60):
        return False
    if _max_consonant_run(chunk) > 5:
        return False
    return True


def _max_consonant_run(text: str) -> int:
    max_run = 0
    current_run = 0
    vowels = set("aeiouáéíóúüAEIOUÁÉÍÓÚÜ")
    for char in text:
        if not char.isalpha():
            current_run = 0
            continue
        if char in vowels:
            current_run = 0
            continue
        current_run += 1
        if current_run > max_run:
            max_run = current_run
    return max_run


def _stitch_text_chunks(chunks: list[str]) -> str:
    if not chunks:
        return ""

    first = chunks[0].strip()
    if not first:
        return ""

    pieces: list[str] = [first]
    tail = first[-80:]
    for chunk in chunks[1:]:
        current = chunk.strip()
        if not current:
            continue

        if _should_join_without_space(tail, current):
            pieces.append(current)
            tail = (tail + current)[-80:]
        else:
            if tail.endswith((" ", "\n")):
                pieces.append(current)
                tail = (tail + current)[-80:]
            else:
                pieces.append(" ")
                pieces.append(current)
                tail = (tail + " " + current)[-80:]

    stitched = "".join(pieces)
    stitched = re.sub(r"\s+([,.;:!?])", r"\1", stitched)
    stitched = re.sub(r"\(\s+", "(", stitched)
    stitched = re.sub(r"\s+\)", ")", stitched)
    stitched = _WHITESPACE_PATTERN.sub(" ", stitched).strip()
    return stitched


def _should_join_without_space(previous: str, current: str) -> bool:
    if not previous:
        return True
    prev_char = previous[-1]
    cur_char = current[0]

    if cur_char in ",.;:!?)]}":
        return True
    if prev_char in "([{":
        return True
    if prev_char == "-" or cur_char == "-":
        return True

    if prev_char.isalpha() and cur_char.isalpha():
        prev_word_match = re.search(r"([A-Za-zÀ-ÿ]+)$", previous)
        cur_word_match = re.match(r"([A-Za-zÀ-ÿ]+)", current)
        if prev_word_match and cur_word_match:
            prev_word = prev_word_match.group(1)
            cur_word = cur_word_match.group(1)
            if len(prev_word) <= 3 or len(cur_word) <= 2:
                return True
            if prev_word.isupper() and cur_word.isupper():
                return True
    return False


def _parse_pdf_literal_string(blob: bytes, index: int) -> tuple[str, int]:
    raw, next_index = _parse_pdf_literal_string_bytes(blob, index)
    return raw.decode("utf-8", errors="ignore"), next_index


def _parse_pdf_literal_string_bytes(blob: bytes, index: int) -> tuple[bytes, int]:
    result = bytearray()
    depth = 1
    length = len(blob)

    while index < length:
        if _deadline_exceeded():
            return bytes(result), length
        byte = blob[index]
        index += 1

        if byte == 92:  # "\"
            if index >= length:
                break
            escaped = blob[index]
            index += 1
            if escaped in (40, 41, 92):  # "(", ")", "\"
                result.append(escaped)
                continue
            if escaped == 110:  # n
                result.append(10)
                continue
            if escaped == 114:  # r
                result.append(13)
                continue
            if escaped == 116:  # t
                result.append(9)
                continue
            if escaped == 98:  # b
                result.append(8)
                continue
            if escaped == 102:  # f
                result.append(12)
                continue
            if 48 <= escaped <= 55:  # octal sequence
                oct_digits = bytearray([escaped])
                for _ in range(2):
                    if index < length and 48 <= blob[index] <= 55:
                        oct_digits.append(blob[index])
                        index += 1
                    else:
                        break
                result.append(int(oct_digits.decode("ascii"), 8))
                continue
            result.append(escaped)
            continue

        if byte == 40:  # "("
            depth += 1
            result.append(byte)
            continue
        if byte == 41:  # ")"
            depth -= 1
            if depth == 0:
                break
            result.append(byte)
            continue
        result.append(byte)

    return bytes(result), index


def _looks_textual_bytes(payload: bytes) -> bool:
    if not payload:
        return False
    printable = sum((32 <= byte <= 126) or byte in (9, 10, 13) for byte in payload)
    return printable / len(payload) >= 0.75
