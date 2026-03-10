from __future__ import annotations

from .candidate_collector import CandidateCollector
from .constants import (
    _ADDRESS_LIKE_PATTERN,
    _WHITESPACE_PATTERN,
    COVERAGE_CONFIDENCE_FALLBACK,
    COVERAGE_CONFIDENCE_LABEL,
)
from .field_patterns import AddressPatterns, ClinicPatterns, FieldLabelPatterns, OwnerPatterns

_POSTAL_HINT_RE = AddressPatterns.POSTAL_HINT_RE
_SIMPLE_FIELD_LABEL_RE = FieldLabelPatterns.SIMPLE_FIELD_LABEL_RE
_CLINIC_ADDRESS_LABEL_LINE_RE = FieldLabelPatterns.CLINIC_ADDRESS_LABEL_LINE_RE
_AMBIGUOUS_ADDRESS_LABEL_LINE_RE = FieldLabelPatterns.AMBIGUOUS_ADDRESS_LABEL_LINE_RE
_OWNER_ADDRESS_LABEL_LINE_RE = FieldLabelPatterns.OWNER_ADDRESS_LABEL_LINE_RE
_OWNER_NAME_LIKE_LINE_RE = OwnerPatterns.NAME_LIKE_LINE_RE
_OWNER_LOCALITY_LINE_RE = OwnerPatterns.LOCALITY_LINE_RE
_OWNER_LOCALITY_SECTION_BLACKLIST = OwnerPatterns.LOCALITY_SECTION_BLACKLIST
_OWNER_BLOCK_IDENTIFICATION_CONTEXT_RE = OwnerPatterns.BLOCK_IDENTIFICATION_CONTEXT_RE
_OWNER_ADDRESS_CONTEXT_RE = OwnerPatterns.ADDRESS_CONTEXT_RE
_CLINIC_ADDRESS_CONTEXT_RE = ClinicPatterns.ADDRESS_CONTEXT_RE


def _collect_multiline_labeled_address_parts(
    lines: list[str], index: int, inline_value: str
) -> list[str]:
    address_parts: list[str] = []
    if inline_value:
        address_parts.append(inline_value)
    elif index + 1 < len(lines):
        next_line = lines[index + 1]
        if not _SIMPLE_FIELD_LABEL_RE.match(next_line):
            address_parts.append(next_line.strip(" .,:;\t\r\n"))

    if address_parts and index + 2 < len(lines):
        maybe_second_line = lines[index + 2]
        if not _SIMPLE_FIELD_LABEL_RE.match(maybe_second_line) and _POSTAL_HINT_RE.search(
            maybe_second_line
        ):
            address_parts.append(maybe_second_line.strip(" .,:;\t\r\n"))
    return address_parts


def _owner_address_pair_matches(owner_line: str, address_line: str) -> bool:
    if _SIMPLE_FIELD_LABEL_RE.match(owner_line) is not None:
        return False
    if _SIMPLE_FIELD_LABEL_RE.match(address_line) is not None:
        return False
    if _OWNER_NAME_LIKE_LINE_RE.match(owner_line) is None:
        return False
    return _ADDRESS_LIKE_PATTERN.search(address_line) is not None and any(
        ch.isdigit() for ch in address_line
    )


def _owner_address_context_is_valid(context_text: str) -> bool:
    has_owner_context = _OWNER_ADDRESS_CONTEXT_RE.search(context_text) is not None
    has_identification_context = (
        _OWNER_BLOCK_IDENTIFICATION_CONTEXT_RE.search(context_text) is not None
    )
    has_clinic_context = _CLINIC_ADDRESS_CONTEXT_RE.search(context_text) is not None
    if has_clinic_context and not has_owner_context:
        return False
    return has_owner_context or has_identification_context


def _collect_owner_address_tail_parts(lines: list[str], index: int) -> list[str]:
    address_parts = [lines[index + 1].strip(" .,:;\t\r\n")]
    tail_index = index + 2
    tail_limit = min(len(lines), index + 5)
    while tail_index < tail_limit:
        tail_line = lines[tail_index]
        if _SIMPLE_FIELD_LABEL_RE.match(tail_line) is not None:
            break
        tail_clean = tail_line.strip(" .,:;\t\r\n")
        if not tail_clean:
            break
        if _WHITESPACE_PATTERN.sub(" ", tail_line).startswith("- "):
            break
        if _OWNER_NAME_LIKE_LINE_RE.match(tail_clean) is not None:
            break

        is_postal_like = _POSTAL_HINT_RE.search(tail_clean) is not None
        is_locality_like = _OWNER_LOCALITY_LINE_RE.fullmatch(tail_clean) is not None
        if tail_clean.casefold() in _OWNER_LOCALITY_SECTION_BLACKLIST:
            break
        if not (is_postal_like or is_locality_like):
            break

        address_parts.append(tail_clean)
        tail_index += 1
    return address_parts


def _extract_adjacent_owner_address_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    add_candidate = collector.add_candidate
    for index in range(len(lines) - 1):
        owner_line = lines[index]
        address_line = lines[index + 1]
        if not _owner_address_pair_matches(owner_line, address_line):
            continue

        context_window = lines[max(0, index - 3) : min(len(lines), index + 4)]
        context_text = " ".join(context_window).casefold()
        if not _owner_address_context_is_valid(context_text):
            continue

        address_parts = _collect_owner_address_tail_parts(lines, index)
        candidate_value = " ".join(part for part in address_parts if part)
        if candidate_value:
            add_candidate(
                key="owner_address",
                value=candidate_value,
                confidence=COVERAGE_CONFIDENCE_FALLBACK,
                snippet="\n".join(lines[index : min(len(lines), index + 3)]),
            )


def _extract_labeled_owner_address_candidates(
    collector: CandidateCollector,
    lines: list[str],
) -> None:
    add_candidate = collector.add_candidate
    for index, line in enumerate(lines):
        owner_address_label_match = _OWNER_ADDRESS_LABEL_LINE_RE.match(line)
        if owner_address_label_match is None:
            continue

        inline_value = (owner_address_label_match.group(1) or "").strip(" .,:;\t\r\n")
        address_parts = _collect_multiline_labeled_address_parts(lines, index, inline_value)
        if address_parts:
            add_candidate(
                key="owner_address",
                value=" ".join(part for part in address_parts if part),
                confidence=COVERAGE_CONFIDENCE_LABEL,
                snippet="\n".join(lines[index : min(len(lines), index + 3)]),
            )


def _route_labeled_address_candidate(
    collector: CandidateCollector,
    line: str,
    index: int,
    candidate_value: str,
    snippet_block: str,
    explicit_clinic_label: bool,
) -> None:
    add_candidate = collector.add_candidate
    context_decision = collector._classify_address_context(index)
    is_ambiguous_generic_label = (
        not explicit_clinic_label and _AMBIGUOUS_ADDRESS_LABEL_LINE_RE.match(line) is not None
    )

    if explicit_clinic_label:
        add_candidate(
            key="clinic_address",
            value=candidate_value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=snippet_block,
        )
    elif context_decision == "owner" and is_ambiguous_generic_label:
        add_candidate(
            key="owner_address",
            value=candidate_value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=snippet_block,
        )
    elif context_decision == "clinic" and is_ambiguous_generic_label:
        add_candidate(
            key="clinic_address",
            value=candidate_value,
            confidence=COVERAGE_CONFIDENCE_LABEL,
            snippet=snippet_block,
        )
    else:
        add_candidate(
            key="clinic_address",
            value=candidate_value,
            confidence=COVERAGE_CONFIDENCE_FALLBACK,
            snippet=snippet_block,
        )


def _extract_owner_address_candidates(collector: CandidateCollector, lines: list[str]) -> None:
    _extract_adjacent_owner_address_candidates(collector, lines)
    _extract_labeled_owner_address_candidates(collector, lines)


def _extract_labeled_address_candidates(collector: CandidateCollector, lines: list[str]) -> None:
    for index, line in enumerate(lines):
        address_label_match = _CLINIC_ADDRESS_LABEL_LINE_RE.match(line)
        if address_label_match is None:
            continue

        raw_label = address_label_match.group(1).strip().casefold()
        inline_value = (address_label_match.group(2) or "").strip(" .,:;\t\r\n")
        address_parts = _collect_multiline_labeled_address_parts(lines, index, inline_value)
        if address_parts:
            _route_labeled_address_candidate(
                collector,
                line,
                index,
                " ".join(part for part in address_parts if part),
                "\n".join(lines[index : min(len(lines), index + 3)]),
                "clínica" in raw_label or "clinica" in raw_label,
            )
