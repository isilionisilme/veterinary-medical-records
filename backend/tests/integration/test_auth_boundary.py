from __future__ import annotations


def test_api_routes_are_open_when_auth_token_is_unset(test_client_factory) -> None:
    with test_client_factory(auth_token=None) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_routes_require_bearer_token_when_auth_token_is_set(test_client_factory) -> None:
    with test_client_factory(auth_token="secret-token") as client:
        response = client.get("/api/health")

    assert response.status_code == 401
    payload = response.json()
    assert payload["error_code"] == "UNAUTHORIZED"


def test_api_routes_reject_invalid_bearer_token(test_client_factory) -> None:
    with test_client_factory(auth_token="secret-token") as client:
        response = client.get(
            "/api/health",
            headers={"Authorization": "Bearer wrong-token"},
        )

    assert response.status_code == 401
    payload = response.json()
    assert payload["error_code"] == "UNAUTHORIZED"


def test_api_routes_allow_valid_bearer_token(test_client_factory) -> None:
    with test_client_factory(auth_token="secret-token") as client:
        response = client.get(
            "/api/health",
            headers={"Authorization": "Bearer secret-token"},
        )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_non_api_routes_remain_unauthenticated_even_when_auth_enabled(
    test_client_factory,
) -> None:
    with test_client_factory(auth_token="secret-token") as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
