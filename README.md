# Veterinary Medical Records Processing — Technical Exercise

This repository contains the implementation and supporting materials for a technical exercise focused on **interpreting and processing veterinary medical records**.

The purpose of the exercise is to demonstrate **product thinking, architectural judgment, and a scalable approach to document interpretation in a regulated domain**, rather than to deliver a fully automated system.

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

Preferred target: Docker Compose.

### Prerequisites

- Docker Desktop (or Docker Engine) with Docker Compose v2 (`docker compose`)

### One-command run (Docker-first)

1. Optional: copy defaults to local env file:
   - `cp .env.example .env` (Linux/macOS)
   - `Copy-Item .env.example .env` (PowerShell)
2. Start the full app:
   - `docker compose up --build`

### URLs / ports

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

### Automated tests

- Backend tests:
  - `docker compose --profile test run --rm backend-tests`
- Frontend tests:
  - `docker compose --profile test run --rm frontend-tests`

### Minimal manual smoke test

1. Open `http://localhost:5173`.
2. Upload a PDF document.
3. Verify it appears in the list with status updates.
4. Open the document detail/review view.
5. Preview/download the original PDF.
6. Open structured data and edit at least one field.
7. If available in your current MVP build, toggle "mark reviewed" and verify the state updates.

### Known limitations / assumptions

- Docker-first flow is designed for local evaluation only.
- Persistence is local filesystem + SQLite via mounted paths:
  - `./backend/data`
  - `./backend/storage`
- No external services are required.
- Confidence policy defaults are non-secret and provided in `.env.example`.

### Fallback: local non-Docker run

Prereqs: Python 3.11 and Node.js 18+.

Backend (Windows PowerShell):
- `python -m venv .venv`
- `.\.venv\Scripts\activate`
- `pip install -r requirements-dev.txt`
- `uvicorn backend.app.main:create_app --factory --reload`
- In local dev/reload mode, backend auto-loads `backend/.env` if present.

Frontend (new shell):
- `cd frontend`
- `npm install`
- `npm run dev`

Local one-command startup (Windows PowerShell):
- `./scripts/start-all.ps1`
- This script starts backend + frontend, sets `VET_RECORDS_EXTRACTION_OBS=1`, and loads confidence-policy env vars from `backend/.env` when present.

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

## Implementation status

The current code covers Release 1 user stories (US-01 through US-04). Later releases are defined in [`docs/project/IMPLEMENTATION_PLAN.md`](docs/project/IMPLEMENTATION_PLAN.md) for sequencing and acceptance criteria.

---
