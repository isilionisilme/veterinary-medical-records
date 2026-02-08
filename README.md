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


---

## Documentation overview

The repository documentation is intentionally split by audience and purpose.

Start here:

📄 **`docs/README.md`** — reading order + document authority.

---

### Project documentation (authoritative)

📄 **`docs/project/PRODUCT_DESIGN.md`**  
Product intent + semantics summary (with canonical Google Doc link).

---

📄 **`docs/project/UX_DESIGN.md`**  
UX interaction contract (roles, workflow guarantees, confidence UX rules).

📄 **`docs/project/TECHNICAL_DESIGN.md`**  
Architecture + invariants + authoritative contracts (endpoint map, error semantics, state rules, schemas).

---

📄 **`docs/project/IMPLEMENTATION_PLAN.md`**  
MVP scope + story order + acceptance criteria (sequencing authority).

📄 **`docs/project/BACKEND_IMPLEMENTATION.md`**  
Backend implementation details (“how”).

📄 **`docs/project/FRONTEND_IMPLEMENTATION.md`**  
Frontend implementation details (“how”).

---

### Shared engineering rules

📄 **`docs/shared/AGENTS.md`**  
AI Coding Assistant behavior rules for this repo.

📄 **`docs/shared/ENGINEERING_PLAYBOOK.md`**  
Engineering standards for implementation and changes.

📄 **`docs/shared/UX_GUIDELINES.md`**  
Shared UX principles referenced by project UX design.

---

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

### Backend configuration (MVP)

Environment variables:
- `VET_RECORDS_DB_PATH`: override the SQLite database location.
- `VET_RECORDS_STORAGE_PATH`: override the filesystem root for stored documents.
- `VET_RECORDS_CORS_ORIGINS`: comma-separated list of allowed frontend origins.

---

## Quickstart (Docker, recommended)

Docker is the recommended way to run the backend in a reproducible environment.

```bash
docker compose up --build
```

Health check:

```bash
curl http://localhost:8000/health
```

Note:
- The Docker image may include additional system packages intended for post-MVP work; MVP behavior remains PDF-only.

## Notes for evaluators

This exercise is intentionally structured to show:

- how product and technical design inform each other,
- how scope and risk are actively controlled,
- and how a system can scale safely in a sensitive, regulated context.

The focus is on **clarity, judgment, and maintainability**, rather than feature completeness.

---
