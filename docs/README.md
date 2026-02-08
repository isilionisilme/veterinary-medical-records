This file defines:
- what each document is in this repository
- reading order

# Folder structure

This folder is split into two areas:
- `docs/shared/`: company-wide, project-agnostic standards and guidelines
- `docs/project/`: documents specific to this initiative (if applicable) 

## Reading order (mandatory)
### Documentation shared across projects
- `docs/shared/AGENTS.md` —
- `docs/shared/ENGINEERING_PLAYBOOK.md` —
- `docs/shared/UX_GUIDELINES.md` —

### Documentation specific to the project
- `docs/project/PRODUCT_DESIGN.md` — product summary for technical context (project-specific)
- `docs/project/UX_DESIGN.md` — project UX interaction contract (project-specific)
- `docs/project/TECHNICAL_DESIGN.md` — architecture + constraints + invariants (project-specific)
- `docs/project/BACKEND_IMPLEMENTATION.md` — backend implementation details (if applicable) (project-specific)
- `docs/project/FRONTEND_IMPLEMENTATION.md` — frontend implementation details (if applicable) (project-specific)
- `docs/project/IMPLEMENTATION_PLAN.md` — scope + story order + acceptance criteria (if applicable) (project-specific)

## Running the MVP (Evaluator Path)

The MVP requires OCR support (Tesseract) for image documents.
Use the Docker quickstart in `README.md` to run the backend with all system dependencies installed.
