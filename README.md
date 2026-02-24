# Veterinary Medical Records Processing — Technical Exercise

This repository contains the implementation and supporting materials for a technical exercise focused on **interpreting and processing veterinary medical records**.

The purpose of the exercise is to demonstrate **product thinking, architectural judgment, and a scalable approach to document interpretation in a regulated domain**, rather than to deliver a fully automated system.

---

## TL;DR / Evaluator Quickstart

Prerequisites:
- Docker Desktop with Docker Compose v2 (`docker compose`)

Run evaluation mode:
- `docker compose up --build`

Open:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

Stop:
- `docker compose down`

Scope and sequencing source of truth:
- [`docs/project/IMPLEMENTATION_PLAN.md`](docs/project/IMPLEMENTATION_PLAN.md)

---

## Problem context

Barkibu processes veterinary insurance claims based on **heterogeneous, unstructured medical documents**, typically PDFs originating from different clinics, countries, and formats.

The core operational challenge is not claim decision logic, but:

- interpreting documents consistently,
- extracting relevant medical and financial information,
- and reducing repetitive manual work for veterinarians,
while preserving safety, traceability, and trust.

This project explores an approach that assists veterinarians during document review and improves incrementally over time without disrupting existing workflows.

---

## Repository structure

- `backend/` — FastAPI API + persistence (SQLite + filesystem) + tests
- `frontend/` — React app for document upload/list/review flows
- [`docs/`](docs/) — authoritative documentation (start at [`docs/README.md`](docs/README.md))

## Architecture at a glance

- Architectural style: modular monolith with clear application/domain/infrastructure boundaries.
- Backend pattern: ports-and-adapters with explicit use cases and append-only review/processing artifacts.
- Frontend pattern: feature-oriented React modules centered on upload, review workspace, and structured data editing.
- Runtime model: Docker-first local environment with deterministic evaluation mode and optional dev overlay.

Key design references:
- [`docs/project/TECHNICAL_DESIGN.md`](docs/project/TECHNICAL_DESIGN.md)
- [`docs/project/PRODUCT_DESIGN.md`](docs/project/PRODUCT_DESIGN.md)
- [`docs/project/UX_DESIGN.md`](docs/project/UX_DESIGN.md)

Key technical decisions (ADRs):
- [`docs/adr/ADR-ARCH-0001-modular-monolith.md`](docs/adr/ADR-ARCH-0001-modular-monolith.md) — modular monolith over microservices.
- [`docs/adr/ADR-ARCH-0002-sqlite-database.md`](docs/adr/ADR-ARCH-0002-sqlite-database.md) — SQLite trade-offs and PostgreSQL migration path.
- [`docs/adr/ADR-ARCH-0003-raw-sql-repository-pattern.md`](docs/adr/ADR-ARCH-0003-raw-sql-repository-pattern.md) — raw SQL + repository pattern, no ORM.
- [`docs/adr/ADR-ARCH-0004-in-process-async-processing.md`](docs/adr/ADR-ARCH-0004-in-process-async-processing.md) — in-process async scheduler over external queue.
- ADR index: [`docs/adr/README.md`](docs/adr/README.md)

---

## Documentation overview

The repository documentation is intentionally split by audience and purpose.

Start here:

📄 **[`docs/README.md`](docs/README.md)** — reading order + document authority.

---

### Project documentation (authoritative)

📄 **[`docs/project/PRODUCT_DESIGN.md`](docs/project/PRODUCT_DESIGN.md)**  
Product intent + semantics summary (with canonical Google Doc link).

---

📄 **[`docs/project/UX_DESIGN.md`](docs/project/UX_DESIGN.md)**  
UX interaction contract (roles, workflow guarantees, confidence UX rules).

📄 **[`docs/shared/BRAND_GUIDELINES.md`](docs/shared/BRAND_GUIDELINES.md)**  
Visual identity and tone of user-facing copy.

📄 **[`docs/project/TECHNICAL_DESIGN.md`](docs/project/TECHNICAL_DESIGN.md)**  
Architecture + invariants + authoritative contracts (endpoint map, error semantics, state rules, schemas).

---

📄 **[`docs/project/IMPLEMENTATION_PLAN.md`](docs/project/IMPLEMENTATION_PLAN.md)**  
Scope + story order + acceptance criteria.

📄 **[`docs/project/BACKEND_IMPLEMENTATION.md`](docs/project/BACKEND_IMPLEMENTATION.md)**  
Backend implementation details (“how”).

📄 **[`docs/project/FRONTEND_IMPLEMENTATION.md`](docs/project/FRONTEND_IMPLEMENTATION.md)**  
Frontend implementation details (“how”).

---

### Shared engineering rules

📄 **[`AGENTS.md`](AGENTS.md)**  
Canonical AI assistant entrypoint for this repo.

📄 **[`docs/shared/ENGINEERING_PLAYBOOK.md`](docs/shared/ENGINEERING_PLAYBOOK.md)**  
Engineering standards for implementation and changes.

📄 **[`docs/shared/UX_GUIDELINES.md`](docs/shared/UX_GUIDELINES.md)**  
Shared UX principles referenced by project UX design.

---

### Optional / Repo internals

- Operational router (AI assistants): `docs/agent_router/00_AUTHORITY.md`
- Token optimization benchmarks: `metrics/llm_benchmarks/`

### Delivery evidence and audit trail

- 12-factor architecture audit: [`docs/project/12_FACTOR_AUDIT.md`](docs/project/12_FACTOR_AUDIT.md)
- Maintainability/codebase audit: [`docs/project/codebase_audit.md`](docs/project/codebase_audit.md)
- Iterative execution log and decisions: [`docs/project/AI_ITERATIVE_EXECUTION_PLAN.md`](docs/project/AI_ITERATIVE_EXECUTION_PLAN.md)
- Future roadmap (2/4/8 weeks): [`docs/project/FUTURE_IMPROVEMENTS.md`](docs/project/FUTURE_IMPROVEMENTS.md)
- Extraction strategy and ADRs: [`docs/extraction/`](docs/extraction/)
- Extraction tracking and risk matrix: [`docs/extraction-tracking/`](docs/extraction-tracking/)

---

## Evaluation & Dev details

Preferred target: Docker Compose (evaluation mode by default).

### Evaluation mode (default, stable)

Evaluation mode is production-like for local validation:
- no source-code bind mounts,
- deterministic image builds,
- local persistence for SQLite/files via mounted data/storage paths.

### Reset / persistence

By default, evaluation mode persists local state in:
- `backend/data`
- `backend/storage`

To fully reset local persisted state:
- stop services: `docker compose down`
- delete those directories (`backend/data` and `backend/storage`)

### Windows / WSL2 notes (minimal)

- On Windows, prefer running this repo from WSL2 for more reliable local filesystem behavior.
- Dev-mode file watcher polling is enabled in `docker-compose.dev.yml` (`CHOKIDAR_USEPOLLING=true`, `WATCHPACK_POLLING=true`).
- If ports are busy, change `.env` values for `FRONTEND_PORT` and `BACKEND_PORT`.

### Minimal manual smoke test

1. Open `http://localhost:5173`.
2. Upload a PDF document.
3. Verify the document appears in list/status views.
4. Open review view and preview/download the source PDF.
5. Open structured data and edit at least one field.
6. If available in your current MVP build, toggle "mark reviewed" and verify state updates.

### Dev mode (hot reload, no local toolchain install)

Dev mode is explicit and keeps evaluation mode untouched.
It mounts `backend/`, `frontend/`, and `shared/` into containers for live code reload.

Commands:
- Start dev mode:
  - `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`
- Stop dev mode:
  - `docker compose -f docker-compose.yml -f docker-compose.dev.yml down`

Notes:
- Backend runs with `uvicorn --reload`.
- Frontend runs with Vite dev server and polling watchers for Windows/WSL2 friendliness.
- Code changes do not require image rebuild in dev mode (except dependency or Dockerfile changes).

### Automated tests (Compose profile)

- Backend tests:
  - `docker compose --profile test run --rm backend-tests`
- Frontend tests:
  - `docker compose --profile test run --rm frontend-tests`

### Local quality gates (before pushing)

- Backend tests: `python -m pytest --tb=short -q`
- Frontend tests: `cd frontend && npm test`
- Frontend lint/types: `cd frontend && npm run lint`
- Frontend format check: `cd frontend && npm run format:check`
- Optional pre-commit hook run: `pre-commit run --all-files`

### Administrative commands

- Ensure DB schema: `python -m backend.app.cli db-schema`
- Check DB readability and table count: `python -m backend.app.cli db-check`
- Print resolved runtime config: `python -m backend.app.cli config-check`
- Commands are idempotent and intended for one-off local maintenance/diagnostics.

### Rebuild guidance after changes

- If you changed code only and are in dev mode: no rebuild needed.
- If you changed code and are in evaluation mode:
  - `docker compose up --build`
- If you changed dependencies or Dockerfiles:
  - `docker compose build --no-cache`
  - `docker compose up`

### Troubleshooting

- `Global Schema contract file not found` or frontend import errors for `global_schema_contract.json`:
  - Both images now copy `shared/` to `/app/shared` during build.
  - Rebuild without cache to rule out stale images:
    - `docker compose build --no-cache backend frontend`
    - `docker compose up`

- Docker Desktop starts but containers fail unexpectedly:
  - Confirm daemon health: `docker info`
  - Validate compose config: `docker compose config`
  - Tail logs: `docker compose logs -f backend frontend`

### Global Schema migration note

- API payloads now expose canonical `active_interpretation.data.global_schema` only.
- Versioned schema keys are not supported.
- Consumers must read `global_schema` only.

## Backend implementation

The backend is implemented using:

- **Python**
- **FastAPI**
- **SQLite** (metadata and structured artifacts)
- **Filesystem storage** (original documents and large artifacts)

The system follows a **modular monolith architecture** with clear separation of concerns and explicit state transitions.

Key characteristics include:
- append-only persistence for extracted and structured data,
- explicit processing runs and failure modes,
- and full traceability from document upload to review.

### Backend configuration

Environment variables:
- `VET_RECORDS_DB_PATH`: override the SQLite database location.
- `VET_RECORDS_STORAGE_PATH`: override the filesystem root for stored documents.
- `VET_RECORDS_CORS_ORIGINS`: comma-separated list of allowed frontend origins.
Confidence policy:
- `VET_RECORDS_CONFIDENCE_POLICY_VERSION`
- `VET_RECORDS_CONFIDENCE_LOW_MAX`
- `VET_RECORDS_CONFIDENCE_MID_MAX`

For backend configuration and local runtime details, see [`docs/project/BACKEND_IMPLEMENTATION.md`](docs/project/BACKEND_IMPLEMENTATION.md).

---

## Notes for evaluators

This exercise is intentionally structured to show:

- how product and technical design inform each other,
- how scope and risk are actively controlled,
- and how a system can scale safely in a sensitive, regulated context.

The focus is on **clarity, judgment, and maintainability**, rather than feature completeness.

## How to contribute

1. Create a branch from `main` (or continue work in the designated delivery branch).
2. Keep changes scoped and update docs when behavior/contracts change.
3. Run local quality gates listed above before opening/updating PR.
4. Prefer Docker Compose commands in examples to preserve evaluator parity.
