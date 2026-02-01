# Engineering Playbook: Engineering Guidelines

**Purpose**  
These guidelines define the **mandatory engineering standards** for this project.  
They apply to **all approved implementations** and must be followed consistently by the AI Coding Assistant.

If any guideline cannot be satisfied, **STOP and explain the blocker before proceeding**.

---

## Code style & consistency
- Follow **PEP 8** conventions consistently across the codebase.
- Prefer **clear, readable naming** over brevity.
- Prefer **explicitness to cleverness**.
- Use **type hints** where they add clarity, especially in:
  - Public APIs
  - Domain services
  - Schemas and data transfer objects

---

## Structure & separation of concerns
- Keep **domain logic independent** from frameworks and infrastructure.
- FastAPI routes must act as **thin adapters only**, limited to:
  - Input validation
  - Orchestration
  - Response mapping
- **Business rules must live in domain services**, never in API handlers.
- Access persistence, file storage, and external services **only through explicit interfaces or adapters**.

---

## Explicit contracts & schemas
- Define and validate **all API inputs and outputs** using explicit schemas.
- Internal data passed between components must follow **well-defined contracts**.
- Structured domain records must be **schema-validated and versioned**.

---

## State management & workflow safety
- Model **lifecycle states explicitly** and persist them.
- State transitions must be **deterministic and safe to retry**.
- Every state change must be **observable and auditable**.

---

## Traceability & human control
- **Never silently overwrite human edits**.
- Persist human corrections as **append-only revisions**, including:
  - Before value
  - After value
  - Timestamp
- Preserve the ability to **distinguish machine-generated data from human-validated data**.

---

## Error handling & observability
- Classify errors clearly:
  - User-facing errors
  - Internal/system errors
- **Fail explicitly and early** when inputs or states are invalid.
- Log key operations and state transitions using **correlation identifiers**.

---

## Observability & metrics
- Key pipeline stages must be **measurable** (e.g. processing time per stage).
- Failures must be **attributable to specific workflow stages**.

---

## Testing discipline
- Domain logic must be **testable independently** from frameworks and infrastructure.
- Automated tests must cover:
  - Happy paths
  - Meaningful failure scenarios
- Integration tests must validate **critical end-to-end flows**.

---

## Data handling & safety
- Treat **external inputs as untrusted by default**.
- Validate file **type and size before processing**.
- Store **raw files outside the database**; persist only references.
- Persist metadata, states, structured outputs, and audit information in the database.

---

## Configuration & environment separation
- Configuration must be **environment-driven**.
- No environment-specific values are hardcoded.
- **Secrets are never committed** to the repository.

---

## Versioning & evolution
- APIs and schemas must be **versioned from the start**.
- Prefer **backward-compatible changes** over breaking ones.
- Schema evolution must be **explicit and intentional**.

---

## Dependency management
- Keep the dependency footprint **minimal**.
- Do **not introduce new third-party dependencies by default**.
- Prefer **standard library solutions** when reasonable.
- Any new dependency must be **explicitly justified**.

---

## Documentation guidelines
- Documentation is a **mandatory code quality rule** and must be applied whenever code is created or modified.
- Goal: document **intent, contracts, constraints, and rationale**, not obvious behavior.
- The AI Coding Assistant must generate and maintain:
  - In-code documentation (docstrings / structured comments)
  - Public interface documentation
- The AI must **not invent or modify architecture or design decision documents** unless explicitly instructed.

### Docstring standard
- Use a **single consistent structured docstring style** across the codebase: **Google-style**.
- Follow **PEP 257–equivalent structure**:
  - First line: short summary sentence.
  - Blank line.
  - Structured sections when relevant: Args/Parameters, Returns, Raises, Side Effects, Notes.
- Use precise, technical wording.

### Where docstrings are required
Add structured docstrings to:
- Public modules and components
- Domain and business services
- Public functions and methods
- Non-trivial orchestration logic
- Public adapters and integration boundaries

When relevant, document:
- Purpose and responsibility
- Inputs and outputs
- Contracts and invariants
- Error conditions and exceptions
- Side effects and state changes

### Where documentation must not be added
Do not add docstrings or comments for:
- Trivial helpers
- Self-explanatory one-liners
- Code fully expressed by clear names and types
- Simple pass-through logic

### Types and contracts
- Treat **type annotations, signatures, and schemas** as part of the documentation contract.
- Ensure all public interfaces include explicit types or schemas when supported.
- Do not duplicate type information already present in signatures.

### Public interface documentation
For any public interface (API, service, adapter, or module boundary):
- Add a short summary.
- Add a behavior description if not obvious.
- Document input/output contracts.
- Add parameter/field descriptions where they add clarity.
- Prefer metadata compatible with automatic documentation generators when available.

### Comments policy
Write comments only to explain:
- Rationale and why-decisions
- Domain assumptions
- Non-obvious constraints
- Tradeoffs and rejected alternatives

Do not restate the code. Remove or update outdated comments when modifying code.

### Style and maintenance
- Keep documentation consistent and aligned with project code style.
- Keep summaries concise and imperative.
- When changing public behavior, contracts, schemas, or responsibilities, update documentation in the same change.

---

## Naming conventions

### Git and delivery workflow
- **Branches**:
  `feature/story-<ID>-<short-representative-slug>`
  *The slug must directly represent the specific capability being implemented.*
- **Commits**:
  `Story <ID>: <short imperative description>`
- **Pull Requests**:
  `Story <ID> — <Full User Story Title>`
  *The PR title must match the User Story title exactly as defined in the planning section.*

---

### API and endpoints
- Use clear, predictable REST conventions, for example:
  - `POST /documents/upload`
  - `GET /documents/{id}`
  - `GET /documents/{id}/download`
  - `GET /documents/{id}/text`
  - `PUT /documents/{id}/structured-data`

---

### Domain concepts and models
- Use explicit, domain-oriented names, such as:
  - `Document`
  - `ProcessingStatus`
  - `ExtractedText`
  - `StructuredMedicalRecord`
  - `FieldEvidence`
  - `RecordRevision`

---

### Lifecycle states
- States are enums and must use **UPPERCASE_SNAKE_CASE**, for example:
  - `UPLOADED`
  - `TEXT_EXTRACTED`
  - `STRUCTURED`
  - `READY_FOR_REVIEW`

---

### Persistence artifacts
- Use consistent, descriptive table names, such as:
  - `documents`
  - `document_status_history`
  - `document_text_artifacts`
  - `document_structured_artifacts`
  - `field_evidence`

# Engineering Playbook: Way of Working – Execution Prompt

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

## Branching Strategy
- The default branching strategy is Feature Branching.
- Work is developed in short-lived feature branches on top of a stable `main` branch.
- `main` always reflects a runnable, test-passing state.
- Each user story is implemented in a dedicated feature branch.
- Feature branches are merged once the user story is complete and reviewed.
- Teams are encouraged to adopt a different strategy if they believe it better suits their context.

## Commit Discipline
- Commits are small and scoped to a single logical change.
- A commit must never span multiple user stories.
- A user story may be implemented through multiple commits.
- Each commit represents a coherent step toward completing a user story.
- Commit messages are descriptive and follow a consistent convention.
- Commit history must remain readable to support reasoning and review.

## Pull Requests
- A pull request is opened for each user story.
- Pull requests are opened once the user story is fully implemented and all automated tests are passing.
- Each pull request must be small enough to be reviewed comfortably in isolation.

## Code Reviews
- Code reviews are performed for every pull request.
- Reviews focus on:
  - Correctness and alignment with the intended behavior
  - Clarity, readability, and maintainability
  - Adherence to the Engineering Guidelines and architectural intent
  - Explicit handling of edge cases, errors, and state transitions
  - Test coverage and test quality
- Reviews must be constructive and pragmatic.
- Prioritize shared understanding and long-term code health over stylistic preferences.

## Definition of Done
A user story is considered done only when all of the following are true:
- It delivers a complete vertical slice of user-facing value.
- It is documented (README and/or ADR if a design decision was made).
- All tests pass.
- Automated tests cover the expected behavior, including:
  - The happy path
  - At least one meaningful failure scenario
- The resulting code remains easy to understand, extend, and evolve without refactoring core logic.
- The change is merged into main via Pull Request.
- Continuous Integration (CI) has run and passed successfully.
- main remains in a green (passing) state after the merge.

## Execution Rule
- Always prefer completing a smaller, well-defined user story over partially implementing a larger one.
- Validate every implementation explicitly against the Definition of Done.
- Do not bypass reviews, tests, or workflow rules to accelerate delivery.


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

