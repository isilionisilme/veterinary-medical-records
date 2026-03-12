from __future__ import annotations

import asyncio
from unittest.mock import Mock

from backend.app.infra.scheduler_lifecycle import SchedulerLifecycle


def test_scheduler_stop_uses_timeout_and_cancels_task(monkeypatch) -> None:
    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def _stuck_scheduler(*, repository, storage, stop_event) -> None:
        _ = repository
        _ = storage
        _ = stop_event
        started.set()
        while True:
            try:
                await asyncio.sleep(1)
            except asyncio.CancelledError:
                cancelled.set()
                raise

    lifecycle = SchedulerLifecycle(scheduler_fn=_stuck_scheduler)

    async def _exercise() -> None:
        await lifecycle.start(repository=Mock(), storage=Mock())
        await asyncio.wait_for(started.wait(), timeout=1.0)
        await lifecycle.stop()

    monkeypatch.setattr(
        "backend.app.infra.scheduler_lifecycle.SCHEDULER_STOP_TIMEOUT_SECONDS",
        0.01,
    )

    asyncio.run(_exercise())

    assert cancelled.is_set()
    assert not lifecycle.is_running
