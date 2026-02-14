from __future__ import annotations

from backend.app.application.global_schema_v0 import GLOBAL_SCHEMA_V0_KEYS, REPEATABLE_KEYS_V0
from backend.app.application.processing_runner import (
    _build_interpretation_artifact,
    _mine_interpretation_candidates,
)


def test_interpretation_artifact_contains_full_global_schema_v0_shape() -> None:
    raw_text = """
    Paciente: Luna
    Especie: Canina
    Raza: Mestiza
    Sexo: Hembra
    Edad: 7 años
    Peso: 22 kg
    Fecha de visita: 10/02/2026
    Diagnóstico: Gastroenteritis aguda
    Tratamiento: Omeprazol 10mg cada 24h
    Procedimiento: Ecografía abdominal
    """

    payload = _build_interpretation_artifact(
        document_id="doc-test",
        run_id="run-test",
        raw_text=raw_text,
    )

    data = payload["data"]
    assert isinstance(data, dict)

    global_schema_v0 = data.get("global_schema_v0")
    assert isinstance(global_schema_v0, dict)
    assert list(global_schema_v0.keys()) == list(GLOBAL_SCHEMA_V0_KEYS)

    for repeatable_key in REPEATABLE_KEYS_V0:
        assert isinstance(global_schema_v0[repeatable_key], list)


def test_interpretation_artifact_empty_raw_text_keeps_global_schema_shape() -> None:
    payload = _build_interpretation_artifact(
        document_id="doc-empty",
        run_id="run-empty",
        raw_text="   \n\t  ",
    )

    data = payload["data"]
    global_schema_v0 = data.get("global_schema_v0")
    assert isinstance(global_schema_v0, dict)
    assert list(global_schema_v0.keys()) == list(GLOBAL_SCHEMA_V0_KEYS)
    assert data["summary"]["warning_codes"] == ["EMPTY_RAW_TEXT"]


def test_candidate_bundle_is_not_persisted_by_default(monkeypatch) -> None:
    monkeypatch.delenv("VET_RECORDS_INCLUDE_INTERPRETATION_CANDIDATES", raising=False)
    payload = _build_interpretation_artifact(
        document_id="doc-no-candidates",
        run_id="run-no-candidates",
        raw_text="Paciente: Luna\nEspecie: Canina",
    )

    assert "candidate_bundle" not in payload["data"]


def test_candidate_bundle_is_persisted_when_debug_flag_enabled(monkeypatch) -> None:
    monkeypatch.setenv("VET_RECORDS_INCLUDE_INTERPRETATION_CANDIDATES", "true")
    payload = _build_interpretation_artifact(
        document_id="doc-with-candidates",
        run_id="run-with-candidates",
        raw_text="Paciente: Luna\nEspecie: Canina",
    )

    candidate_bundle = payload["data"].get("candidate_bundle")
    assert isinstance(candidate_bundle, dict)


def test_microchip_heuristic_extracts_digits_from_keyworded_line() -> None:
    candidates = _mine_interpretation_candidates(
        "Microchip: 00023035139 NHC\nPaciente: Luna"
    )

    microchip_candidates = candidates.get("microchip_id", [])
    assert microchip_candidates
    assert microchip_candidates[0]["value"] == "00023035139"


def test_microchip_heuristic_skips_owner_address_without_chip_digits() -> None:
    candidates = _mine_interpretation_candidates("BEATRIZ ABARCA C/ ORTEGA")

    assert candidates.get("microchip_id", []) == []


def test_microchip_heuristic_extracts_digits_from_ocr_n_prefix_line() -> None:
    candidates = _mine_interpretation_candidates(
        "N�: 941000024967769\nPaciente: Luna"
    )

    microchip_candidates = candidates.get("microchip_id", [])
    assert microchip_candidates
    assert microchip_candidates[0]["value"] == "941000024967769"


def test_microchip_heuristic_rejects_generic_no_reference_without_chip_context() -> None:
    candidates = _mine_interpretation_candidates(
        "No: 941000024967769\nFactura: 2026-02"
    )

    assert candidates.get("microchip_id", []) == []


def test_vet_name_label_heuristic_extracts_name_candidate() -> None:
    candidates = _mine_interpretation_candidates(
        "Centro Veterinario Norte\nVeterinario: Dr. Juan Pérez\nPaciente: Luna"
    )

    vet_candidates = candidates.get("vet_name", [])
    assert vet_candidates
    assert vet_candidates[0]["value"] == "Dr. Juan Pérez"


def test_owner_name_label_heuristic_extracts_owner_candidate() -> None:
    candidates = _mine_interpretation_candidates(
        "Propietario: BEATRIZ ABARCA\nPaciente: Luna"
    )

    owner_candidates = candidates.get("owner_name", [])
    assert owner_candidates
    assert owner_candidates[0]["value"] == "BEATRIZ ABARCA"


def test_owner_name_heuristic_drops_address_suffix_after_split() -> None:
    candidates = _mine_interpretation_candidates(
        "Propietario: BEATRIZ ABARCA C/ ORTEGA 12\nPaciente: Luna"
    )

    owner_candidates = candidates.get("owner_name", [])
    assert owner_candidates
    assert owner_candidates[0]["value"] == "BEATRIZ ABARCA"


def test_owner_name_nombre_line_uses_datos_del_cliente_context() -> None:
    candidates = _mine_interpretation_candidates(
        "Datos del Cliente\nNombre: BEATRIZ ABARCA\nPaciente: Luna"
    )

    owner_candidates = candidates.get("owner_name", [])
    assert owner_candidates
    assert owner_candidates[0]["value"] == "BEATRIZ ABARCA"


def test_owner_name_nombre_line_rejects_patient_labeled_block() -> None:
    candidates = _mine_interpretation_candidates(
        "Datos del Cliente\nPaciente: LUNA BELLA\nNombre: LUNA BELLA"
    )

    assert candidates.get("owner_name", []) == []


def test_owner_name_tabular_nombre_header_extracts_owner_from_following_lines() -> None:
    candidates = _mine_interpretation_candidates(
        "Datos del Cliente\n"
        "MARLEY\n"
        "Canino\n"
        "Labrador Retriever\n"
        "04/10/19\n"
        "941000024967769\n"
        "Nombre\n"
        "Especie\n"
        "Raza\n"
        "F/Nto\n"
        "Capa\n"
        "Nº Chip\n"
        "BEATRIZ ABARCA\n"
        "C/ ORTEGA Y GASSET 1"
    )

    owner_candidates = candidates.get("owner_name", [])
    assert owner_candidates
    assert owner_candidates[0]["value"] == "BEATRIZ ABARCA"


def test_vet_name_heuristic_rejects_address_like_line() -> None:
    candidates = _mine_interpretation_candidates(
        "Veterinario: Calle Mayor 123\nCentro Veterinario Central"
    )

    assert candidates.get("vet_name", []) == []
