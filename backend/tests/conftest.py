from __future__ import annotations

import pytest

from backend.app.settings import clear_settings_cache


@pytest.fixture(autouse=True)
def clear_cached_settings() -> None:
    clear_settings_cache()
    yield
    clear_settings_cache()
