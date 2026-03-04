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


def test_lookup_address_uses_nominatim_after_catalog_miss(monkeypatch) -> None:
    expected_address = "Avinguda del Mar, 12, 12003 Castelló, España"

    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> list[dict[str, str]]:
            return [{"display_name": expected_address}]

    def _fake_get(*_args, **_kwargs):
        return _FakeResponse()

    monkeypatch.setattr(clinic_catalog.httpx, "get", _fake_get)

    result = clinic_catalog.lookup_address_by_name("CLINICA NUEVA")
    assert result["found"] is True
    assert result["address"] == expected_address
    assert result["source"] == "nominatim"


def test_lookup_address_catalog_hit_skips_nominatim(monkeypatch) -> None:
    def _fail_if_called(*_args, **_kwargs):
        raise AssertionError("Nominatim must not be called on catalog hit")

    monkeypatch.setattr(clinic_catalog.httpx, "get", _fail_if_called)

    result = clinic_catalog.lookup_address_by_name(KNOWN_NAME)
    assert result["found"] is True
    assert result["address"] == KNOWN_ADDRESS
    assert result["source"] == "clinic_catalog"


def test_lookup_address_nominatim_timeout_returns_not_found(monkeypatch) -> None:
    def _timeout(*_args, **_kwargs):
        raise clinic_catalog.httpx.TimeoutException("timeout")

    monkeypatch.setattr(clinic_catalog.httpx, "get", _timeout)

    result = clinic_catalog.lookup_address_by_name("CLINICA TIMEOUT")
    assert result["found"] is False
    assert result["address"] is None


def test_lookup_address_nominatim_http_error_returns_not_found(monkeypatch) -> None:
    def _http_error(*_args, **_kwargs):
        raise clinic_catalog.httpx.HTTPError("http error")

    monkeypatch.setattr(clinic_catalog.httpx, "get", _http_error)

    result = clinic_catalog.lookup_address_by_name("CLINICA ERROR")
    assert result["found"] is False
    assert result["address"] is None


def test_lookup_address_nominatim_empty_result_returns_not_found(monkeypatch) -> None:
    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> list[dict[str, str]]:
            return []

    def _fake_get(*_args, **_kwargs):
        return _FakeResponse()

    monkeypatch.setattr(clinic_catalog.httpx, "get", _fake_get)

    result = clinic_catalog.lookup_address_by_name("CLINICA SIN RESULTADOS")
    assert result["found"] is False
    assert result["address"] is None
