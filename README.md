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

---

## Documentation overview

The repository documentation is intentionally split by audience and purpose.

Start here:

📄 **[`docs/README.md`](docs/README.md)** — reading order + document authority.

Operational router (AI assistants):
- `docs/agent_router/00_AUTHORITY.md`

---

### Token optimization (exercise)

The repository includes in-repo assistant usage benchmarks (docs consulted + token proxies) under:
- `metrics/llm_benchmarks/`

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
Scope + story order + acceptance criteria (sequencing authority).

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

## Quickstart (Evaluator)

Preferred target: Docker Compose (evaluation mode by default).

### Prerequisites

- Docker Desktop with Docker Compose v2 (`docker compose`)
- On Windows, Docker Desktop uses WSL2. Ensure virtualization is enabled in firmware (BIOS/UEFI).
- Optional local env file:
  - `cp .env.example .env` (Linux/macOS)
  - `Copy-Item .env.example .env` (PowerShell)

### Evaluation mode (default, stable)

Evaluation mode is production-like for local validation:
- no source-code bind mounts,
- deterministic image builds,
- local persistence for SQLite/files via mounted data/storage paths.

Commands:
- Build and run:
  - `docker compose up --build`
- Stop:
  - `docker compose down`

### URLs / ports

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

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

### Rebuild guidance after changes

- If you changed code only and are in dev mode: no rebuild needed.
- If you changed code and are in evaluation mode:
  - `docker compose up --build`
- If you changed dependencies or Dockerfiles:
  - `docker compose build --no-cache`
  - `docker compose up`

### Troubleshooting

- `Global Schema v0 contract file not found` or frontend import errors for `global_schema_v0_contract.json`:
  - Both images now copy `shared/` to `/app/shared` during build.
  - Rebuild without cache to rule out stale images:
    - `docker compose build --no-cache backend frontend`
    - `docker compose up`

- Docker Desktop starts but containers fail unexpectedly:
  - Confirm daemon health: `docker info`
  - Validate compose config: `docker compose config`
  - Tail logs: `docker compose logs -f backend frontend`

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
- Confidence policy (required to avoid degraded confidence mode in veterinarian UI):
  - `VET_RECORDS_CONFIDENCE_POLICY_VERSION`
  - `VET_RECORDS_CONFIDENCE_LOW_MAX`
  - `VET_RECORDS_CONFIDENCE_MID_MAX`
  - Local setup:
    1. Copy `backend/.env.example` to `backend/.env`.
    2. Start backend in dev/reload mode (`uvicorn ... --reload` or `./scripts/start-all.ps1`).
    3. Backend auto-loads `backend/.env` in dev/reload mode only; production/non-dev runtime does not auto-load this file.

---

## Notes for evaluators

This exercise is intentionally structured to show:

- how product and technical design inform each other,
- how scope and risk are actively controlled,
- and how a system can scale safely in a sensitive, regulated context.

The focus is on **clarity, judgment, and maintainability**, rather than feature completeness.
