from __future__ import annotations

from backend.app.application.global_schema_v0 import GLOBAL_SCHEMA_V0_KEYS, REPEATABLE_KEYS_V0
from backend.app.application.processing_runner import _build_interpretation_artifact


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
