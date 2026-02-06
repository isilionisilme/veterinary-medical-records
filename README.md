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

### Product design (human-oriented)

📄 **`docs/PRODUCT_DESIGN.md`**

Provides a short summary and a direct link to the **canonical product design document** (Google Docs), which contains the full problem framing, user experience design, and business rationale.

This is the recommended starting point for reviewers interested in product and UX decisions.

---

### Technical design (human-oriented)

📄 **`docs/TECHNICAL_DESIGN.md`**

Describes the system architecture, processing model, data versioning strategy, confidence handling, and explicit non-goals.

A narrative, human-oriented version of the technical design is linked from this document and maintained separately as a single source of truth.

---

### Implementation plan (operational)

📄 **`docs/IMPLEMENTATION_PLAN.md`**

Defines:
- the MVP scope,
- user-facing releases,
- detailed user stories with acceptance criteria,
- and story-level technical requirements.

This document is the **source of truth for implementation sequencing and scope**.

---

### AI-assisted development context

📄 **`docs/CONTEXT.md`**  
📄 **`docs/AGENTS.md`**

These documents define engineering rules, architectural constraints, and working instructions for AI-assisted development.

They are operational in nature and not intended as narrative documentation.

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

## Notes for evaluators

This exercise is intentionally structured to show:

- how product and technical design inform each other,
- how scope and risk are actively controlled,
- and how a system can scale safely in a sensitive, regulated context.

The focus is on **clarity, judgment, and maintainability**, rather than feature completeness.

---
