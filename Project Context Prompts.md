# Engineering Playbook: Engineering Guidelines

You are implementing production-quality software and must strictly follow the Engineering Guidelines described below.  
These guidelines apply by default across the codebase unless explicitly overridden by an initiative-specific prompt.

If an implementation decision conflicts with any of these guidelines, stop and explain the conflict instead of proceeding.

## Code style & consistency
- Follow PEP 8 conventions consistently across the codebase.
- Use clear, readable naming over brevity.
- Prefer explicitness to cleverness.
- Use type hints where they add clarity, especially in:
  - Public APIs
  - Domain services
  - Schemas and data transfer objects

## Structure & separation of concerns
- Keep domain logic independent from frameworks and infrastructure.
- FastAPI routes must act as thin adapters (validation + orchestration only).
- Business rules must live in domain services, not in API handlers.
- Access persistence, file storage, and external services through explicit interfaces or adapters.

## Explicit contracts & schemas
- Define and validate all API inputs and outputs using schemas.
- Internal data passed between components must follow explicit, well-defined contracts.
- Structured domain records must be schema-validated and versioned.

## State management & workflow safety
- Model lifecycle states explicitly and persist them.
- State transitions must be deterministic and safe to retry.
- Every state change must be observable and auditable.

## Traceability & human control
- Never silently overwrite human edits.
- Persist human corrections as append-only revisions with before/after values and timestamps.
- Preserve the ability to distinguish machine-generated data from human-validated data.

## Error handling & observability
- Classify errors clearly (user-facing vs internal).
- Fail explicitly and early when inputs or states are invalid.
- Log key operations and state transitions using correlation identifiers.

## Observability & metrics
- Key pipeline stages must be measurable (e.g. processing time per stage).
- Failures must be attributable to specific workflow stages.

## Testing discipline
- Domain logic must be testable independently from frameworks and infrastructure.
- Automated tests must cover:
  - Happy paths
  - Meaningful failure scenarios
- Integration tests must validate critical end-to-end flows.

## Data handling & safety
- Treat external inputs as untrusted by default.
- Validate type and size before processing files.
- Store raw files outside the database; persist only references.
- Persist metadata, states, structured outputs, and audit information in the database.

## Configuration & environment separation
- Configuration must be environment-driven.
- No environment-specific values are hardcoded.
- Secrets are never committed to the repository.

## Versioning & evolution
- APIs and schemas are versioned from the start.
- Prefer backward-compatible changes over breaking ones.
- Schema evolution must be explicit and intentional.

## Dependency management
- Keep the dependency footprint minimal.
- Do not introduce new third-party dependencies by default.
- Prefer standard library solutions when reasonable.
- Any new dependency must be explicitly justified.

## Naming conventions
Use these naming conventions by default to ensure consistency across projects and AI-assisted workflows.

### Git and delivery workflow
- Branch format: `feature/slice-<N>-<short-slug>`
- Allowed prefixes:
  - `feat/...`
  - `fix/...`
  - `docs/...`
  - `chore/...`

- Commit format: `Slice <N>: <short description>`
  - Descriptions must be imperative and specific.

- Pull request title format: `Slice <N> — <short description>`

### API and endpoints
Use clear, predictable REST conventions, for example:
- `POST /documents/upload`
- `GET /documents/{id}`
- `GET /documents/{id}/download`
- `GET /documents/{id}/text`
- `PUT /documents/{id}/structured-data`

### Domain concepts and models
Use explicit, domain-oriented names for core concepts, such as:
- `Document`
- `ProcessingStatus`
- `ExtractedText`
- `StructuredMedicalRecord`
- `FieldEvidence`
- `RecordRevision`

### Lifecycle states
- States are enums and must use `UPPERCASE_SNAKE_CASE`.
- Examples:
  - `UPLOADED`
  - `TEXT_EXTRACTED`
  - `STRUCTURED`
  - `READY_FOR_REVIEW`

### Persistence artifacts
Use consistent, descriptive table names, for example:
- `documents`
- `document_status_history`
- `document_text_artifacts`
- `document_structured_artifacts`
- `field_evidence`
- `record_revisions`

## Final instruction
Generate code that is easy to understand, safe to modify, and consistent with these guidelines.  
Long-term maintainability and clarity take precedence over short-term convenience.

All generated code **must strictly adhere** to the following Engineering Guidelines.

These guidelines define non-negotiable constraints that apply across the entire codebase.  
If a requested implementation would violate any of these principles, you must stop and explain the conflict instead of proceeding.

## Code style & consistency
- Follow PEP 8 conventions consistently across the codebase.
- Use clear, readable naming over brevity.
- Prefer explicitness to cleverness.
- Use type hints where they add clarity, especially in:
  - Public APIs
  - Domain services
  - Schemas and data transfer objects

## Structure & separation of concerns
- Keep domain logic independent from frameworks and infrastructure.
- FastAPI routes must act as thin adapters only:
  - Input validation
  - Orchestration
  - Response mapping
- Business rules must live in domain services, never in API handlers.
- Access persistence, file storage, and external services only through explicit interfaces or adapters.

## Explicit contracts & schemas
- Define and validate all API inputs and outputs using explicit schemas.
- Internal data passed between components must follow well-defined contracts.
- Structured domain records must be schema-validated and versioned.

## State management & workflow safety
- Model lifecycle states explicitly and persist them.
- State transitions must be deterministic and safe to retry.
- No duplicated artifacts or corrupted state on retries.
- Every state change must be observable and auditable.

## Traceability & human control
- Never silently overwrite human edits.
- Persist human corrections as append-only revisions.
- Store before/after values and timestamps for revisions.
- Preserve a clear distinction between:
  - Machine-generated data
  - Human-validated or human-edited data

## Error handling & observability
- Classify errors clearly:
  - User-facing errors
  - Internal system errors
- Fail explicitly and early when inputs or states are invalid.
- Log key operations and state transitions.
- Include correlation identifiers (e.g. `document_id`) in logs.

## Observability & metrics
- Key pipeline stages must be measurable (e.g. processing time per stage).
- Failures must be attributable to specific workflow stages.

## Testing discipline
- Domain logic must be testable independently from frameworks and infrastructure.
- Automated tests must cover:
  - Happy paths
  - Meaningful failure scenarios
- Integration tests must validate critical end-to-end flows.

## Data handling & safety
- Treat all external inputs as untrusted by default.
- Validate file type and size before processing.
- Store raw files outside the database; persist only references.
- Persist metadata, states, structured outputs, and audit information in the database.
- Never store binary files in the database.

## Configuration & environment separation
- Configuration must be environment-driven.
- No environment-specific values are hardcoded.
- Secrets are never committed to the repository.

## Versioning & evolution
- APIs and schemas are versioned from the start.
- Prefer backward-compatible changes over breaking ones.
- Schema evolution must be explicit and intentional.

## Dependency management
- Keep the dependency footprint minimal.
- Do not introduce new third-party dependencies by default.
- Prefer standard library solutions when reasonable.
- Any new dependency must be explicitly justified:
  - Why the existing stack is insufficient
  - What would break or degrade without it

Always optimize for correctness, clarity, maintainability, and long-term evolvability.

# Engineering Playbook: Way of Working

You are implementing work for this initiative and must strictly follow the Way of Working described below.  
If an implementation conflicts with any of these rules, stop and explain the conflict instead of proceeding.

## Delivery Model (Releases)
- Work is delivered using vertical slices, referred to as releases.
- A release represents a complete increment of user-facing value.
- A release may span multiple user stories across different epics.
- Each release must be coherent, end-to-end, and meaningful from a user perspective.
- Releases must not be isolated technical components.

Each release must result in:
- A runnable and testable system state
- Clear, observable user-facing behavior
- Explicitly persisted data and state transitions
- Automated test coverage for the delivered functionality

## Commit Discipline
- Commits must be small and scoped to a single logical change or release increment.
- Each commit must represent a coherent step toward completing a release.
- Commit messages must be descriptive and follow a consistent convention.
- Commit history must remain readable to support reasoning and review.

## Code Reviews
- Code reviews are a core quality and learning mechanism, not just a merge gate.
- Reviews must focus on:
  - Correctness and alignment with intended behavior
  - Clarity, readability, and maintainability
  - Adherence to the Engineering Guidelines and architectural intent
  - Explicit handling of edge cases, errors, and state transitions
  - Test coverage and test quality
- Reviews should be constructive and pragmatic.
- Prioritize shared understanding and long-term code health over stylistic preferences.

## Definition of Done
A user story is considered done only when all of the following are true:
- It delivers a complete vertical slice of user-facing value.
- It is documented (README and/or ADR if a design decision was made).
- Automated tests cover the expected behavior, including:
  - The happy path
  - At least one meaningful failure scenario
- All tests pass.
- The resulting code remains easy to understand, extend, and evolve without refactoring core logic.

## Execution Rule
When implementing any task:
- Structure the work so it can be completed as part of a single release.
- Validate the implementation explicitly against the Definition of Done.
- Prefer completing a smaller release over partially implementing a larger one.

# Exercise 2: System Design

You are implementing this system based on the following system design.  
All implementation decisions must be consistent with this design.  
If a requested change conflicts with it, stop and explain the conflict instead of proceeding.

## Design intent
The system is designed to enable incremental, human-in-the-loop automation.

Key principles:
- Deterministic checks can be automated with high confidence.
- Interpretative reasoning is delivered as assistive suggestions, never as silent decisions.
- Human confirmation is required for high-stakes actions.
- Auditability, observability, and data capture are first-class concerns.
- The system must safely support increasing levels of automation over time.

The workflow is modeled as an explicit pipeline with clear state transitions, where each stage produces structured outputs that can be observed, measured, and audited.

## Deployment model
The system is implemented as a modular monolith.

- Logical boundaries must be preserved in code (modules, explicit interfaces).
- Domain logic must remain independent from infrastructure.
- The design must remain evolvable into independent services in the future.
- Do not introduce infrastructure complexity that is not strictly required for this exercise.

## Logical pipeline
The implementation follows a logical pipeline that mirrors a future event-driven workflow, without introducing distributed infrastructure.

### Upload / Ingestion
- Receive veterinary documents.
- Generate a `document_id`.
- Persist basic document metadata.
- Ensure idempotent behavior on retries.

### Canonicalisation
- Extract raw text from documents.
- Attach standard metadata.
- Produce a canonical representation suitable for downstream processing.

### Extraction
- Convert free text into a structured medical record.
- Attach basic confidence or evidence metadata where applicable.

### State management
- Model explicit document lifecycle states (e.g. `UPLOADED`, `PROCESSED`, `READY_FOR_REVIEW`).
- Persist all state transitions.
- Provide clear visibility into progress and failures.

### Human review & feedback
- Allow veterinarians to review and edit extracted fields.
- Capture all corrections as structured, append-only feedback.

## Domain model and persisted artifacts
The system is built around a small set of explicit, persistent domain concepts.  
All relevant domain concepts must be persisted to support auditability, traceability, and human-in-the-loop workflows.

Core domain concepts:
- Document: submitted medical document, including identity, metadata, lifecycle state, and a reference to the raw file.
- ProcessingStatus: explicit lifecycle states representing progress through the pipeline.
- ExtractedText: extracted text with provenance and extraction diagnostics.
- StructuredMedicalRecord: normalized medical information represented as schema-validated JSON (MVP).
- FieldEvidence: lightweight links between structured fields and their source in the original document (page/snippet).
- RecordRevisions: append-only records of human edits, storing before/after values and timestamps.

## Persistence strategy
Intent:
Persist the minimum set of artifacts required to make the system debuggable, auditable, and safe for human-in-the-loop workflows.

Persistence moments:
- On ingestion: persist document metadata and initial lifecycle state.
- After each pipeline stage: persist produced artifacts and state transitions.
- On human edits: persist new append-only revisions; never overwrite silently.

Storage mapping:
- Map domain concepts to explicit storage artifacts (documents, state history, text artifacts, structured records, revisions).
- Do not over-specify database details unless required by the implementation.

## Database choice
Use SQLite for this exercise to keep the solution lightweight and self-contained.
The schema should mirror what would later exist in a production database (e.g. Postgres), without introducing premature complexity.

In a real production scenario, this choice would be revisited with the team in the context of the existing tech stack.

## Guardrails for implementation
- Do not collapse logical stages into opaque code paths.
- Do not bypass explicit state transitions.
- Do not silently merge machine-generated data with human-validated data.
- Prefer clarity and traceability over performance or abstraction.
- Preserve the ability to evolve this modular monolith into independent services.

Implement the system so that its structure reflects the pipeline, domain model, and human-in-the-loop intent described above.

# Exercise 2: # Way of Working
You are implementing this initiative and must follow the shared Way of Working defined in the Engineering Playbook by default.

The rules below explicitly define where this initiative overrides or refines the Engineering Playbook.  
If an implementation conflicts with these rules, stop and explain the conflict instead of proceeding.

## Baseline
- The Delivery Model, Commit Discipline, Code Review principles, and Definition of Done defined in the Engineering Playbook apply by default.
- All practices not explicitly overridden below must be assumed to follow the Engineering Playbook.

## Delivery Model
- Follow the Delivery Model defined in the Engineering Playbook.
- Work is delivered as vertical slices (releases).
- Each release must be coherent, end-to-end, and result in a runnable, testable system state.

## Git Branching Strategy (Initiative Override)
Several branching strategies were considered. Given the team size (a single developer), the limited scope of the MVP, and the objectives of this exercise, **Feature Branching** is used as a pragmatic balance between clarity, safety, and minimal process overhead.

- Feature branching on top of a stable `main` branch
- `main` must always reflect a runnable, test-passing state
- Each release is implemented in a dedicated feature branch
- Feature branches are short-lived and merged once the release is complete

## Commit Discipline
- Follow the Commit Discipline defined in the Engineering Playbook.
- Commits must remain small, scoped, and readable.

## Pull Requests (Initiative Clarification)
- Open one pull request per release.
- Pull requests are opened only when the release is complete and all automated tests are passing.

## Code Reviews (Initiative Override)
- Apply the Code Review principles defined in the Engineering Playbook.
- For this initiative, code reviews are performed **once per release**, when the full release can be reviewed end-to-end.
- In a real production environment, code reviews would typically happen more frequently and incrementally.
- Review frequency is intentionally limited here to reduce effort and scope, as increasing review frequency would not add meaningful value to this evaluation.

## Definition of Done
- Follow the Definition of Done defined in the Engineering Playbook.
- A release is complete only when all Definition of Done criteria are met.

## Linting (Initiative Deviation)
- Automated linting is intentionally omitted for this exercise.
- In a real production environment, linting and formatting would be enforced via tooling (e.g. pre-commit hooks and CI).
- This omission is intentional to focus on domain modeling, architecture, and incremental delivery.

## Safety and Guardrails
These guardrails are inherited from the original design proposal and apply to this initiative.

- Deterministic automation is allowed only for clearly rule-based checks (future scope).
- Interpretative outputs must always be assistive, never silently applied.
- No irreversible actions are allowed without explicit human confirmation.
- Any AI-generated output must conform to structured, schema-validated JSON contracts.

## Execution Rule
- Always prefer completing a smaller, well-defined release over expanding scope.
- Validate each release explicitly against the Definition of Done.
- Do not bypass or weaken safety guardrails to accelerate delivery.

# Exercise 2: Planning, Scope & Delivery

You are implementing this initiative and must follow the planning principles, user stories, and release plan described below.  
Implementation must proceed incrementally, release by release.  
If a requested change conflicts with the defined scope or exit criteria of a release, stop and explain the conflict instead of proceeding.

## Planning principles
- Prioritize low-risk, high-leverage reductions in manual work while building foundational capabilities.
- Sequence automation by confidence:
  - Start with deterministic decisions.
  - Expand to assistive reasoning only once confidence, data quality, and feedback loops are in place.
- Instrument first (or in parallel) so impact and regressions are measurable from day one.
- Ship in small increments using progressive delivery patterns when applicable.

## User stories & acceptance criteria
Implement functionality strictly according to the user stories and acceptance criteria below.  
Do not implement features that are not explicitly covered.

### Epic A – Document upload and management

As a user, I want to upload a medical record document so the system can process it.
- Acceptance:
  - PDF, Word, or image files are supported.
  - Successful upload returns explicit confirmation.
- Technical requirements:
  - Implement `POST /documents/upload`
  - Validate supported file types and size limits.
  - Persist document metadata (id, filename, content type).
  - Persist initial lifecycle state `UPLOADED`.

As a user, I want to be notified when a file is not supported.
- Acceptance:
  - Clear error message is returned.
  - Document is not created if validation fails.
- Technical requirements:
  - Reject unsupported types and sizes before persistence.
  - Return explicit validation errors from the API.

As a user, I want to see the document processing status.
- Acceptance:
  - Document state is visible (uploaded, processing, ready, failed).
- Technical requirements:
  - Persist document lifecycle states.
  - Expose state via `GET /documents/{id}`.

As a user, I want to retry processing if it fails.
- Acceptance:
  - Retry does not require re-upload.
  - No duplicated data or corrupted state.
- Technical requirements:
  - Retry only advances the document to the next valid state.
  - Ensure idempotent state transitions.

### Epic B – Preview and text extraction

As a user, I want to preview the uploaded document.
- Acceptance:
  - Original document can be viewed or downloaded.
- Technical requirements:
  - Store uploaded files on disk or file storage.
  - Persist file path reference.
  - Implement `GET /documents/{id}/download`.

As a user, I want to see extracted text.
- Acceptance:
  - Raw extracted text is visible.
- Technical requirements:
  - Implement text extraction step (stub acceptable).
  - Persist extracted text linked to the document.
  - Advance state to `TEXT_EXTRACTED`.

As a user, I want to see extraction errors.
- Acceptance:
  - Extraction failures or limitations are visible.
- Technical requirements:
  - Persist extraction errors.
  - Expose errors via API responses.

### Epic C – Medical information structuring

As a user, I want medical information extracted into a standardized structure.
- Acceptance:
  - Medical fields are extracted into a consistent structure.
- Technical requirements:
  - Convert extracted text into structured JSON.
  - Validate output against a schema.

As a user, I want structured medical information clearly organized.
- Acceptance:
  - Key data is easy to scan.
- Technical requirements:
  - Expose structured data via `GET /documents/{id}`.
  - Group fields logically (dates, diagnoses, treatments).

As a user, I want to support documents in different languages.
- Acceptance:
  - Documents in different languages process without errors.
  - Detected language is visible in UI and APIs.
- Technical requirements:
  - Detect language during extraction or canonicalisation.
  - Persist detected language as document metadata.
  - Expose language via retrieval APIs.

### Epic D – Human-in-the-loop correction

As a user, I want to edit structured medical information.
- Acceptance:
  - Extracted fields can be modified.
- Technical requirements:
  - Implement `PUT /documents/{id}/structured-data`.
  - Validate edits against schema.

As a user, I want to understand what changed.
- Acceptance:
  - Original and edited values are distinguishable.
- Technical requirements:
  - Persist edits as append-only revisions.
  - Store before/after values with timestamps.

### Epic F – Evaluation and local execution

As an evaluator, I want to run the system locally.
- Acceptance:
  - Clear setup and execution instructions.
- Technical requirements:
  - Provide Dockerfile (and docker-compose if needed).
  - Document run instructions in README.

As an evaluator, I want to run automated tests easily.
- Acceptance:
  - Single command to run tests.
- Technical requirements:
  - Provide a test command (e.g. `pytest`).
  - Document test execution in README.

## Release plan
Implement the system incrementally following the release sequence below.

### Release 0 – Baseline: explicit workflow & persistence
Goal:
- Make document lifecycle explicit, traceable, and observable.
Scope:
- Document entity and metadata.
- Explicit lifecycle states.
- SQLite persistence.
- Append-only status history.
- Minimal logging.
Exit criteria:
- Documents can be created and retrieved.
- Lifecycle states are persisted and inspectable.
- System is runnable and tests pass.

### Release 1 – File storage & preview
Goal:
- Enable document access and preview.
Scope:
- File storage on disk or file storage.
- File path persistence.
- Download / preview endpoint.
Exit criteria:
- Uploaded files are retrievable.
- Preview/download works.
- Missing-file errors handled explicitly.

### Release 2 – Text extraction (stub) & visibility
Goal:
- Make document interpretation visible and debuggable.
Scope:
- Text extraction step (stub acceptable).
- `TEXT_EXTRACTED` / `TEXT_FAILED` states.
- Persist extracted text and errors.
Exit criteria:
- Extracted text visible via API.
- Extraction failures are persisted and exposed.
- State transitions are deterministic and idempotent.

### Release 3 – Structured medical data (stub)
Goal:
- Standardize medical information for review.
Scope:
- `StructuredMedicalRecord` schema v1.
- Transformation from text to structured JSON (stub).
- Schema validation and retrieval endpoint.
Exit criteria:
- Structured data is schema-valid and retrievable.
- Invalid outputs are rejected safely.
- Data is clearly organized.

### Release 4 – Language detection & visibility
Goal:
- Support multilingual documents transparently.
Scope:
- Language detection during extraction.
- Persist and expose detected language.
Exit criteria:
- Documents in different languages process without errors.
- Detected language visible in document list and review UI.

### Release 5 – Human-in-the-loop edits & revisions
Goal:
- Keep humans in control while preserving auditability.
Scope:
- Editable structured medical data.
- Append-only revisions with before/after values.
- Revision history or diff exposure.
Exit criteria:
- Human edits never overwrite data silently.
- Original vs edited values are distinguishable.
- Revisions are persisted and auditable.

### Release 6 – Evaluator readiness
Goal:
- Enable easy local evaluation.
Scope:
- Docker-based local execution.
- Clear run and test instructions.
Exit criteria:
- System runs locally with minimal setup.
- Automated tests can be executed easily.

## Execution rules
- Implement one release at a time.
- Do not partially implement future releases.
- Validate each release explicitly against its exit criteria.
- Prefer completing a smaller release over expanding scope.

