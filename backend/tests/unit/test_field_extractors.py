"""Focused unit tests for candidate mining extractors."""

from __future__ import annotations

from backend.app.application.field_normalizers import SPECIES_TOKEN_TO_CANONICAL
from backend.app.application.processing.candidate_mining import (
    CandidateCollector,
    _extract_clinic_candidates,
    _extract_labeled_address_candidates,
    _extract_labeled_field_candidates,
    _extract_language_candidates,
    _extract_owner_address_candidates,
    _extract_pet_name_candidates,
    _extract_sex_candidates,
    _extract_species_breed_candidates,
    _extract_weight_candidates,
)


def _collector_for(*lines: str) -> CandidateCollector:
    return CandidateCollector("\n".join(lines))


def _values_for(collector: CandidateCollector, key: str) -> list[str]:
    return [str(item["value"]) for item in collector.candidates.get(key, [])]


def test_extract_labeled_field_candidates_adds_diagnosis() -> None:
    collector = _collector_for("Diagnóstico: Otitis externa")

    _extract_labeled_field_candidates(collector, collector.lines)

    assert _values_for(collector, "diagnosis") == ["Otitis externa"]


def test_extract_labeled_field_candidates_ignores_irrelevant_line() -> None:
    collector = _collector_for("Observación general sin etiquetas")

    _extract_labeled_field_candidates(collector, collector.lines)

    assert collector.candidates == {}


def test_extract_sex_candidates_detects_keyword() -> None:
    collector = _collector_for("Paciente hembra esterilizada")

    _extract_sex_candidates(collector, collector.lines)

    assert _values_for(collector, "sex") == ["hembra"]


def test_extract_sex_candidates_requires_context_for_single_letter() -> None:
    collector = _collector_for("M")

    _extract_sex_candidates(collector, collector.lines)

    assert "sex" not in collector.candidates


def test_extract_species_breed_candidates_detects_species_and_breed() -> None:
    collector = _collector_for("Canina", "Labrador retriever")

    _extract_species_breed_candidates(
        collector,
        collector.lines,
        SPECIES_TOKEN_TO_CANONICAL,
        ("labrador", "retriever", "bulldog"),
    )

    assert _values_for(collector, "species") == ["canino"]
    assert _values_for(collector, "breed") == ["Labrador retriever"]


def test_extract_species_breed_candidates_rejects_overlong_breed_line() -> None:
    collector = _collector_for(
        "Labrador con descripción muy extensa que supera claramente los ochenta "
        "caracteres para activar la guarda"
    )

    _extract_species_breed_candidates(
        collector,
        collector.lines,
        SPECIES_TOKEN_TO_CANONICAL,
        ("labrador",),
    )

    assert "breed" not in collector.candidates


def test_extract_clinic_candidates_detects_header_and_address_block() -> None:
    collector = _collector_for(
        "HOSPITAL VETERINARIO COSTA",
        "Calle Mayor 12",
        "28001 MADRID",
        "Datos del cliente",
    )

    _extract_clinic_candidates(collector, collector.lines, {"paciente"})

    assert "HOSPITAL VETERINARIO COSTA" in _values_for(collector, "clinic_name")
    assert "Calle Mayor 12" in _values_for(collector, "clinic_address")


def test_extract_clinic_candidates_rejects_generic_header_blacklist() -> None:
    collector = _collector_for("HISTORIAL", "Calle Mayor 12", "28001 MADRID", "Datos del cliente")

    _extract_clinic_candidates(collector, collector.lines, {"paciente"})

    assert "clinic_name" not in collector.candidates


def test_extract_owner_address_candidates_detects_adjacent_owner_block() -> None:
    collector = _collector_for(
        "Datos del cliente",
        "Ana Perez",
        "Calle Mayor 12",
        "28001 MADRID",
        "Paciente: Luna",
    )

    _extract_owner_address_candidates(collector, collector.lines)

    assert "Calle Mayor 12 28001 MADRID" in _values_for(collector, "owner_address")


def test_extract_owner_address_candidates_rejects_clinic_context_without_owner() -> None:
    collector = _collector_for(
        "Clínica Veterinaria Costa",
        "Ana Perez",
        "Calle Mayor 12",
        "28001 MADRID",
    )

    _extract_owner_address_candidates(collector, collector.lines)

    assert "owner_address" not in collector.candidates


def test_extract_labeled_address_candidates_routes_ambiguous_label_to_owner() -> None:
    collector = _collector_for(
        "Propietario: Ana Perez",
        "Dirección: Calle Mayor 12",
        "28001 MADRID",
    )

    _extract_labeled_address_candidates(collector, collector.lines)

    assert _values_for(collector, "owner_address") == ["Calle Mayor 12"]


def test_extract_labeled_address_candidates_routes_explicit_clinic_label() -> None:
    collector = _collector_for(
        "Dirección de la clínica: Calle Mayor 12",
        "28001 MADRID",
    )

    _extract_labeled_address_candidates(collector, collector.lines)

    assert _values_for(collector, "clinic_address") == ["Calle Mayor 12"]


def test_extract_pet_name_candidates_detects_birthline_name() -> None:
    collector = _collector_for("Luna - Nacimiento: 01/02/2020", "Especie: Canina")

    _extract_pet_name_candidates(collector, collector.lines)

    assert _values_for(collector, "pet_name") == ["Luna"]


def test_extract_pet_name_candidates_rejects_stopword_like_name() -> None:
    collector = _collector_for("Nombre", "Especie: Canina")

    _extract_pet_name_candidates(collector, collector.lines)

    assert "pet_name" not in collector.candidates


def test_extract_weight_candidates_requires_temporal_context() -> None:
    collector = _collector_for("Visita 12/02/2026", "7.2 kg")

    _extract_weight_candidates(collector, collector.lines)

    assert _values_for(collector, "weight") == ["7.2 kg"]


def test_extract_weight_candidates_ignores_global_weight_without_context() -> None:
    collector = _collector_for(
        "Resumen clínico",
        "Paciente estable",
        "Tratamiento ambulatorio",
        "Sin incidencias reseñables",
        "Observaciones generales",
        "7.2 kg",
    )

    _extract_weight_candidates(collector, collector.lines)

    assert "weight" not in collector.candidates


def test_extract_language_candidates_infers_spanish() -> None:
    collector = _collector_for("Paciente con tratamiento y diagnóstico compatible")

    _extract_language_candidates(collector, collector.compact_text)

    assert _values_for(collector, "language") == ["es"]


def test_extract_language_candidates_respects_existing_language() -> None:
    collector = _collector_for("Paciente con tratamiento y diagnóstico compatible")
    collector.add_candidate(
        key="language",
        value="ca",
        confidence=0.66,
        snippet="Idioma: ca",
    )

    _extract_language_candidates(collector, collector.compact_text)

    assert _values_for(collector, "language") == ["ca"]
