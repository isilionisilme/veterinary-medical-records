# Track Plan T6 (AUDIT-01-T6): Observability — Correlation IDs & Structured Logging

> **Operational rules:** See [plan-execution-protocol.md](../../../03-ops/plan-execution-protocol.md) for agent execution protocol, scope boundary, and validation gates.
>
> **Master plan:** [AUDIT-01 Master](PLAN_2026-03-12_AUDIT-01-CODEBASE-QUALITY-MASTER.md)

**Branch:** improvement/audit-01-t6-observability
**Worktree:** D:/Git/worktrees/codex-permanent-1
**Execution Mode:** Autonomous
**Model Assignment:** Claude Opus 4.6 (C1), GPT-5.4 (C2 + C3)
**PR:** Pending (PR created on explicit user request)
**Related item ID:** `AUDIT-01-T6`
**Prerequisite:** None (independent track)

---

## TL;DR

Three observability improvements: (1) Add correlation ID middleware that generates/propagates `X-Request-ID` across all request handling and log output; (2) configure JSON structured logging with `logging.config.dictConfig`; (3) add `LOG_LEVEL` environment variable for runtime log level configuration.

---

## Context

### Audit Findings (Observability: 3.0/10)

| Sub-dimension | Score | Issue |
|---------------|-------|-------|
| Metrics collection | 0/10 | No Prometheus/StatsD — out of scope (ARCH-20) |
| Correlation IDs | 0/10 | No request tracing across log lines |
| Structured logging | 2/10 | Key=value convention exists but no JSON formatter; inconsistent across modules |
| Log level config | 0/10 | No `LOG_LEVEL` env var; hardcoded in code |
| Health probes | 4/10 | Single `/health` endpoint — addressed in T3 |

This track addresses correlation IDs (0→8), structured logging (2→7), and log level config (0→8).

### Current State

- **Logging convention:** `logger = logging.getLogger(__name__)` with `key=value` message format
- **No middleware** for request tracing
- **No JSON formatter** configured — default `StreamHandler` with plain text
- **`settings.py`:** No `LOG_LEVEL` field

---

## Scope Boundary

- **In scope:** C1 (correlation ID middleware), C2 (JSON structured logging config), C3 (LOG_LEVEL env var)
- **Out of scope:** Prometheus metrics (ARCH-20), distributed tracing (OpenTelemetry), Sentry integration, adding new log statements to existing functions (covered by ARCH-05), frontend error reporting

---

## Design Decisions

### DD-1: `contextvars` for correlation ID propagation
**Approach:** Use Python `contextvars.ContextVar` to store the request ID. A custom `logging.Filter` injects it into every log record. ASGI middleware sets the context var on request entry.
**Rationale:** Zero-overhead for non-web contexts (background tasks get a generated ID). No need to pass request ID through function parameters. Standard library only — no external dependencies.

### DD-2: JSON formatter via `python-json-logger`
**Approach:** Add `python-json-logger` to requirements. Configure via `logging.config.dictConfig` in a new `backend/app/logging_config.py`.
**Rationale:** `python-json-logger` is the de-facto standard (14M downloads/month). Produces one JSON object per line, compatible with all log aggregators. Existing `key=value` messages become JSON fields automatically.

### DD-3: `LOG_LEVEL` env var with fallback to INFO
**Approach:** Add `log_level: str = "INFO"` to `Settings` dataclass. Read in `logging_config.py` to set root logger level.
**Rationale:** Simple, standard pattern. Allows setting `LOG_LEVEL=DEBUG` in development and `LOG_LEVEL=WARNING` in production.

### DD-4: Middleware ordering — correlation ID before auth
**Approach:** Register correlation ID middleware before the existing auth middleware so that auth failure logs include the request ID.
**Rationale:** Request ID should be the first thing set on every request.

---

## PR Partition Gate

| Criterion | Value | Threshold | Result |
|-----------|-------|-----------|--------|
| Estimated diff (LOC) | ~150 | 400 | ✅ |
| Code files changed | 5 | 15 | ✅ |
| Scope classification | code + config + dependency | — | ✅ |
| Semantic risk | MEDIUM (middleware + logging config change) | — | ✅ |

**Decision:** Single PR. No split needed.

---

## DOC-1

`no-doc-needed` — Infrastructure logging changes. No user-facing documentation needed.

---

## Steps

### Phase 1 — C1: Correlation ID Middleware (Claude)

#### Step 1: Create correlation ID module

Create `backend/app/infra/correlation.py`:

```python
"""Request correlation ID propagation via contextvars."""

from __future__ import annotations

import contextvars
import uuid

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)


def get_request_id() -> str:
    """Return the current request correlation ID."""
    return request_id_var.get()


def generate_request_id() -> str:
    """Generate a new UUID4 correlation ID."""
    return uuid.uuid4().hex[:16]
```

#### Step 2: Create correlation ID logging filter

In the same module (or a separate `logging_filter.py`):

```python
import logging

class CorrelationIdFilter(logging.Filter):
    """Inject request_id into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()  # type: ignore[attr-defined]
        return True
```

#### Step 3: Create ASGI middleware

Create `backend/app/infra/middleware.py`:

```python
"""ASGI middleware stack."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.app.infra.correlation import (
    generate_request_id,
    request_id_var,
)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Set X-Request-ID on every request and propagate via contextvars."""

    async def dispatch(self, request: Request, call_next) -> Response:
        incoming_id = request.headers.get("x-request-id", "")
        req_id = incoming_id if incoming_id else generate_request_id()
        token = request_id_var.set(req_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_var.reset(token)
```

#### Step 4: Register middleware in `main.py`

In `create_app()`, add the correlation ID middleware **before** the auth middleware:

```python
from backend.app.infra.middleware import CorrelationIdMiddleware

app.add_middleware(CorrelationIdMiddleware)
```

#### Step 5: Add tests for correlation ID

Create `backend/tests/unit/test_correlation_id.py`:
- Test that responses include `X-Request-ID` header
- Test that incoming `X-Request-ID` is preserved
- Test that missing `X-Request-ID` generates a new one
- Test that `get_request_id()` returns the correct value during request handling

### Phase 2 — C2: JSON Structured Logging (GPT-5.4)

#### Step 6: Add `python-json-logger` dependency

Add to `backend/requirements.txt`:
```
python-json-logger>=3.0.0
```

#### Step 7: Create logging configuration module

Create `backend/app/logging_config.py`:

```python
"""Centralized logging configuration."""

from __future__ import annotations

import logging.config

from backend.app.infra.correlation import CorrelationIdFilter


def configure_logging(log_level: str = "INFO") -> None:
    """Configure JSON structured logging with correlation ID injection."""
    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {
            "correlation_id": {
                "()": lambda: CorrelationIdFilter(),
            },
        },
        "formatters": {
            "json": {
                "()": "pythonjsonlogger.json.JsonFormatter",
                "format": "%(asctime)s %(levelname)s %(name)s %(request_id)s %(message)s",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "json",
                "filters": ["correlation_id"],
                "stream": "ext://sys.stdout",
            },
        },
        "root": {
            "level": log_level.upper(),
            "handlers": ["console"],
        },
    }
    logging.config.dictConfig(config)
```

#### Step 8: Call `configure_logging` in app startup

In `main.py`, call `configure_logging()` at the top of the `lifespan` function (before any logging):

```python
from backend.app.logging_config import configure_logging
from backend.app.settings import get_settings

# Inside lifespan():
configure_logging(get_settings().log_level)
```

### Phase 3 — C3: LOG_LEVEL Environment Variable (GPT-5.4)

#### Step 9: Add `log_level` to Settings

In `backend/app/settings.py`, add to the `Settings` dataclass:

```python
log_level: str = _getenv("LOG_LEVEL") or "INFO"
```

#### Step 10: Add test for LOG_LEVEL

- Test that default log level is `INFO`
- Test that setting `LOG_LEVEL=DEBUG` environment variable changes the configured level

### Phase 4 — Validation

#### Step 11: Full test suite

- `python -m pytest backend/tests/ -x --tb=short -q` — all 709+ pass
- `ruff check backend/` — 0 errors
- `ruff format --check backend/` — 0 diffs
- Manual smoke test: start the app and verify JSON log output with `request_id` field

---

## Execution Status

### Phase 0 — Preflight

- [ ] P0-A 🔄 — Create branch `improvement/audit-01-t6-observability` from latest `main`. Verify clean worktree.

### Phase 1 — C1: Correlation ID (Claude)

- [ ] P1-A 🔄 — Create `correlation.py` with contextvars.
- [ ] P1-B 🔄 — Create `CorrelationIdFilter` logging filter.
- [ ] P1-C 🔄 — Create `CorrelationIdMiddleware` in `middleware.py`.
- [ ] P1-D 🔄 — Register middleware in `main.py`.
- [ ] P1-E 🔄 — Add correlation ID tests.
- [ ] P1-F 🚧 — Checkpoint: present diff for user review.

### Phase 2 — C2: JSON Logging (GPT-5.4)

- [ ] P2-A 🔄 — Add `python-json-logger` to requirements.
- [ ] P2-B 🔄 — Create `logging_config.py`.
- [ ] P2-C 🔄 — Call `configure_logging()` in lifespan.
- [ ] P2-D 🚧 — Checkpoint: present diff for user review.

### Phase 3 — C3: LOG_LEVEL (GPT-5.4)

- [ ] P3-A 🔄 — Add `log_level` to Settings.
- [ ] P3-B 🔄 — Add test for LOG_LEVEL env var.
- [ ] P3-C 🚧 — Checkpoint: present diff for user review.

### Phase 4 — Final

- [ ] P4-A 🔄 — Full validation (tests + lint).
- [ ] P4-B 🚧 — Present commit proposal to user.

---

## Relevant Files

| File | Action |
|------|--------|
| `backend/app/infra/correlation.py` | CREATE (C1) |
| `backend/app/infra/middleware.py` | CREATE (C1) |
| `backend/app/main.py` | MODIFY (C1 — register middleware; C2 — call configure_logging) |
| `backend/app/logging_config.py` | CREATE (C2) |
| `backend/app/settings.py` | MODIFY (C3 — add log_level) |
| `backend/requirements.txt` | MODIFY (C2 — add python-json-logger) |
| `backend/tests/unit/test_correlation_id.py` | CREATE (C1) |
| `backend/tests/unit/test_log_level.py` | CREATE (C3) |

---

## Acceptance Criteria

- [ ] All HTTP responses include `X-Request-ID` header
- [ ] Incoming `X-Request-ID` is preserved; missing one is generated
- [ ] All log lines include `request_id` field (visible in JSON output)
- [ ] Log output is JSON-formatted one-object-per-line
- [ ] `LOG_LEVEL` env var controls root log level (default: `INFO`)
- [ ] 709+ tests pass, ≥91% coverage
- [ ] `ruff check` + `ruff format` clean
- [ ] `python-json-logger` added to requirements.txt
