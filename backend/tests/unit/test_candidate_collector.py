"""Unit tests for CandidateCollector behavior."""

from __future__ import annotations

from backend.app.application.processing.candidate_mining import CandidateCollector
from backend.app.application.processing.constants import (
    COVERAGE_CONFIDENCE_FALLBACK,
    COVERAGE_CONFIDENCE_LABEL,
)


def test_add_candidate_basic() -> None:
    collector = CandidateCollector("Diagnóstico: Otitis")

    collector.add_candidate(
        key="diagnosis",
        value="Otitis",
        confidence=COVERAGE_CONFIDENCE_LABEL,
        snippet="Diagnóstico: Otitis",
    )

    assert collector.candidates["diagnosis"] == [
        {
            "value": "Otitis",
            "confidence": COVERAGE_CONFIDENCE_LABEL,
            "anchor": None,
            "anchor_priority": 0,
            "target_reason": None,
            "evidence": {
                "page": 1,
                "snippet": "Diagnóstico: Otitis",
                "offset": 0,
            },
        }
    ]


def test_add_candidate_dedup_is_case_insensitive_per_key() -> None:
    collector = CandidateCollector("Paciente: Luna")

    collector.add_candidate(
        key="pet_name",
        value="Luna",
        confidence=COVERAGE_CONFIDENCE_LABEL,
        snippet="Paciente: Luna",
    )
    collector.add_candidate(
        key="pet_name",
        value="luna",
        confidence=COVERAGE_CONFIDENCE_LABEL,
        snippet="Paciente: Luna",
    )

    assert len(collector.candidates["pet_name"]) == 1


def test_add_candidate_confidence_normalizes_to_project_buckets() -> None:
    collector = CandidateCollector("A\nB")

    collector.add_candidate(
        key="diagnosis",
        value="Otitis",
        confidence=1.7,
        snippet="A",
    )
    collector.add_candidate(
        key="procedure",
        value="Cura ótica",
        confidence=-4.2,
        snippet="B",
    )

    assert collector.candidates["diagnosis"][0]["confidence"] == COVERAGE_CONFIDENCE_LABEL
    assert collector.candidates["procedure"][0]["confidence"] == COVERAGE_CONFIDENCE_FALLBACK


def test_validate_microchip_id_accepts_valid_and_discards_invalid() -> None:
    collector = CandidateCollector("Microchip: 941000024967769\nChip: 12345")

    collector.add_candidate(
        key="microchip_id",
        value="941000024967769",
        confidence=COVERAGE_CONFIDENCE_LABEL,
        snippet="Microchip: 941000024967769",
    )
    collector.add_candidate(
        key="microchip_id",
        value="12345",
        confidence=COVERAGE_CONFIDENCE_LABEL,
        snippet="Chip: 12345",
    )

    assert [item["value"] for item in collector.candidates["microchip_id"]] == ["941000024967769"]


def test_validate_owner_name_vet_context_guard_discards_candidate() -> None:
    collector = CandidateCollector("Veterinario: Ana Pérez")

    collector.add_candidate(
        key="owner_name",
        value="Ana Pérez",
        confidence=COVERAGE_CONFIDENCE_LABEL,
        snippet="Veterinario: Ana Pérez",
    )

    assert "owner_name" not in collector.candidates


def test_validate_clinic_name_address_guard_discards_candidate() -> None:
    collector = CandidateCollector("Dirección clínica: Av. Norte 99")

    collector.add_candidate(
        key="clinic_name",
        value="Hospital Vet Costa",
        confidence=COVERAGE_CONFIDENCE_LABEL,
        snippet="Dirección clínica: Av. Norte 99",
    )

    assert "clinic_name" not in collector.candidates
