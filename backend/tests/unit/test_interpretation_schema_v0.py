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
