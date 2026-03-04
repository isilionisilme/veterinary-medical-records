from __future__ import annotations

from backend.app.application import clinic_catalog

KNOWN_NAME = "CENTRO COSTA AZAHAR"
KNOWN_ADDRESS = "Rosa Molas 6, Bajo, 12003 Castelló"


def test_lookup_address_exact_match() -> None:
    result = clinic_catalog.lookup_address_by_name(KNOWN_NAME)
    assert result["found"] is True
    assert result["address"] == KNOWN_ADDRESS
    assert result["source"] == "clinic_catalog"


def test_lookup_address_case_insensitive() -> None:
    result = clinic_catalog.lookup_address_by_name("centro costa azahar")
    assert result["found"] is True
    assert result["address"] == KNOWN_ADDRESS


def test_lookup_name_exact_match() -> None:
    assert clinic_catalog.lookup_name_by_address(KNOWN_ADDRESS) == KNOWN_NAME


def test_lookup_name_case_insensitive() -> None:
    assert clinic_catalog.lookup_name_by_address("rosa molas 6, bajo, 12003 castelló") == KNOWN_NAME


def test_lookup_address_no_match() -> None:
    result = clinic_catalog.lookup_address_by_name("CLINICA DESCONOCIDA")
    assert result["found"] is False
    assert result["address"] is None


def test_lookup_name_no_match() -> None:
    assert clinic_catalog.lookup_name_by_address("Avenida Inexistente 999, 99999 Ciudad") is None


def test_lookup_address_ambiguous(monkeypatch) -> None:
    monkeypatch.setattr(
        clinic_catalog,
        "_CLINIC_CATALOG",
        [
            {"names": ["CLINICA DUPLICADA"], "address": "Dir 1"},
            {"names": ["CLINICA DUPLICADA", "CLINICA DUP"], "address": "Dir 2"},
        ],
    )

    result = clinic_catalog.lookup_address_by_name("CLINICA DUPLICADA")
    assert result["found"] is False
    assert result["address"] is None


def test_lookup_name_ambiguous(monkeypatch) -> None:
    monkeypatch.setattr(
        clinic_catalog,
        "_CLINIC_CATALOG",
        [
            {"names": ["CLINICA A"], "address": "Calle Repetida 1"},
            {"names": ["CLINICA B"], "address": "Calle Repetida 1"},
        ],
    )

    assert clinic_catalog.lookup_name_by_address("Calle Repetida 1") is None
