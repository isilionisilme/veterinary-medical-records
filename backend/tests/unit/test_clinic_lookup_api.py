"""Tests for the clinic address lookup API endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_lookup_clinic_address_found() -> None:
    response = client.post(
        "/clinics/lookup-address",
        json={"clinic_name": "CENTRO COSTA AZAHAR"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["found"] is True
    assert data["address"] == "Rosa Molas 6, Bajo, 12003 Castelló"
    assert data["source"] == "clinic_catalog"


def test_lookup_clinic_address_case_insensitive() -> None:
    response = client.post(
        "/clinics/lookup-address",
        json={"clinic_name": "centro costa azahar"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["found"] is True
    assert data["address"] == "Rosa Molas 6, Bajo, 12003 Castelló"


def test_lookup_clinic_address_alias() -> None:
    response = client.post(
        "/clinics/lookup-address",
        json={"clinic_name": "HV COSTA AZAHAR"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["found"] is True
    assert data["address"] == "Rosa Molas 6, Bajo, 12003 Castelló"


def test_lookup_clinic_address_not_found() -> None:
    response = client.post(
        "/clinics/lookup-address",
        json={"clinic_name": "CLINICA DESCONOCIDA"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["found"] is False
    assert data["address"] is None


def test_lookup_clinic_address_empty_name() -> None:
    response = client.post(
        "/clinics/lookup-address",
        json={"clinic_name": ""},
    )
    # Pydantic enforces min_length=1
    assert response.status_code == 422
