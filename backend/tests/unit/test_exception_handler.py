from __future__ import annotations


def test_starlette_http_exception_returns_json_only(test_client_factory) -> None:
    with test_client_factory() as client:
        response = client.get(
            "/this-route-does-not-exist?detail=<script>alert(1)</script>",
            headers={"accept": "text/html"},
        )

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"error_code": "NOT_FOUND", "message": "Not Found"}
    assert "<html" not in response.text.lower()
    assert "<script" not in response.text.lower()
