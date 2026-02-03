# Note for readers:
This document is intended to provide structured context to an AI Coding Assistant during implementation.

The version of this document written for evaluators and reviewers is available here:
https://docs.google.com/document/d/1b1rvBJu9bGjv8Z42OdDz9qwjecbqDbpilkn0KkYuD-M


# Implementation Plan — Incremental Document Processing MVP

## Purpose

This document defines the implementation plan for the Veterinary Medical Records Processing MVP.

It is the **primary source of truth for development sequencing, scope, and user story requirements** and must be followed by the AI Coding Assistant (Codex).

All architectural and system-level decisions referenced in this plan are defined in:

- `docs/TECHNICAL_DESIGN.md`

If any requirement in this plan conflicts with the technical design, **STOP and ask before implementing**.

---

## How to use this document

The AI Coding Assistant must implement user stories **strictly in the order and scope defined in this plan**.

- User-facing intent is expressed in the user story descriptions and acceptance criteria.
- Technical constraints and implementation rules are defined in `docs/TECHNICAL_DESIGN.md`.
- Story-specific technical requirements are defined in the **User Story Details** section of this document.
- Features or behaviors not explicitly listed here are considered **out of scope**.

If any story is unclear or appears underspecified, **STOP and ask before proceeding**.

---

## Release 1 — Document upload & access

### Goal

Allow users to upload documents and download them.

### Scope

- Upload PDF documents
- Persist original documents
- View document status
- Download / preview original documents

### User Stories

- **US-01 - Upload document**
- **US-02 - View document status**
- **US-03 - Download / preview original document**

---

## Release 2 — Document interpretation & visualization

### Goal

Extract information from uploaded documents and show it.

### Scope

- Automatic document processing after upload
- Explicit processing states and failure types
- Raw text extraction
- Detected language visibility
- Structured data visualization
- Confidence indicators per field
- Original document shown side-by-side with extracted data

### User Stories

- **US-05 - Process document**
- **US-06 - View extracted text**
- **US-07 - Review document in context**

---

## Release 3 — Document correction & closure

### Goal

Allow veterinarians to edit extracted information.

### Scope

- Edit structured data
- Create new structured fields
- Visual indicators for modified fields
- Reset all changes via document reprocessing
- Passive capture of confidence signals
- Explicit document review completion

### User Stories

- **US-08 - Edit structured data**
- **US-09 - Capture confidence signals**
- **US-12 - Mark document as reviewed**

---

## Out of scope (explicit)

The following user stories and capabilities are intentionally excluded from the MVP:

- **US-10 - Change document language and reprocess**
- **US-11 - Add review comments**

Additional non-goals:

- Operator review workflows
- Automatic layout evolution
- Confidence-driven automation
- Model retraining or fine-tuning
- Field-level undo functionality

These items are deliberately deferred to avoid over-engineering and reduce implementation risk.

---

## Implementation principles

- Favor clarity and explicitness over cleverness.
- Keep all intermediate artifacts explicit and inspectable.
- Use append-only persistence for extracted and structured data.
- Avoid global side effects derived from individual user actions.
- Never silently overwrite data.
- If a requirement or expected behavior is unclear, **STOP and ask before implementing**.

---

# User Story Details

This section defines the **complete, authoritative specification** for each user story in scope of the MVP.

---

## US-01 — Upload document

**User Story**  
As a user, I want to upload a PDF document so that it is stored and available for processing.

**Acceptance Criteria**
- I can upload a PDF document.
- I receive immediate confirmation that the document was uploaded.
- The document appears in the system with an initial status.

**Technical Requirements**
- Accept only PDF files.
- Validate file size and content type.
- Persist document metadata in the database.
- Store the original file in filesystem storage.
- Initialize document state as `UPLOADED`.
- Record initial status in status history.

---

## US-02 — View document status

**User Story**  
As a user, I want to see the current status of a document so that I understand its processing state.

**Acceptance Criteria**
- I can view the current status of a document at any time.
- I can see whether processing has succeeded or failed.

**Technical Requirements**
- Expose document status via API.
- Persist status transitions explicitly.
- Ensure status reflects the latest processing run.

---

## US-03 — Download / preview original document

**User Story**  
As a user, I want to download or preview the original uploaded document so that I can view it.

**Acceptance Criteria**
- I can download the original document.
- I receive a clear error if the document is unavailable.

**Technical Requirements**
- Retrieve files from filesystem storage.
- Handle missing files gracefully.
- Expose download endpoint.

---

## US-05 — Process document

**User Story**  
As a veterinarian, I want uploaded PDF documents to be processed automatically so that I can review how the system interprets them without changing my workflow.

**Acceptance Criteria**
- Document processing starts automatically after upload.
- I can see when a document is being processed.
- I can see whether processing succeeded or failed.
- If processing fails, I can see the type of failure (e.g. extraction vs interpretation).
- I can manually reprocess a document at any time.

**Technical Requirements**
- Trigger processing automatically after upload.
- Transition document state through `PROCESSING` to a terminal state.
- Classify and persist failure types.
- Create a new processing run on each (re)processing attempt.
- Never overwrite artifacts from previous runs.
- Expose a reprocess endpoint.

---

## US-06 — View extracted text

**User Story**  
As a veterinarian, I want to view the raw text extracted from a document so that I understand what the system has read.

**Acceptance Criteria**
- I can view the extracted raw text.
- I can see the detected language of the document.
- Raw text is hidden by default and shown on demand.

**Technical Requirements**
- Persist extracted raw text as a first-class artifact.
- Detect and persist document language.
- Expose an API endpoint to retrieve extraction artifacts.
- Ensure extracted text is linked to a specific processing run.

---

## US-07 — Review document in context

**User Story**  
As a veterinarian, I want to review the system’s interpretation of a document while viewing the original document at the same time so that I can verify it.

**Acceptance Criteria**
- I can see structured extracted data.
- I can see the original document side-by-side.
- I can clearly identify the confidence of each field.
- Low-confidence fields are visually distinguishable.
- When I select a field, I can see where it comes from in the original document.
- I can optionally view the raw extracted text.

**Technical Requirements**
- Generate structured interpretations with per-field confidence.
- Persist structured data as versioned records.
- Persist approximate source mappings per field.
- Allow source highlighting to be approximate and non-blocking.
- Aggregate interpretation data into a single review API response.

---

## US-08 — Edit structured data

**User Story**  
As a veterinarian, I want to edit the structured information extracted from a document so that it accurately reflects the original document.

**Acceptance Criteria**
- I can edit existing fields.
- I can create new fields.
- I can see which fields I have modified.
- I can reset all my changes by reprocessing the document.

**Technical Requirements**
- Accept structured data edits via API.
- Create a new structured record version for each edit.
- Persist a field-level change log.
- Mark structural changes as `pending_review`.
- Never mutate existing structured records.

---

## US-09 — Capture confidence signals

**User Story**  
As a veterinarian, I want the system to learn from my normal corrections without asking me for feedback.

**Acceptance Criteria**
- My corrections do not require extra steps.
- My corrections do not change system behavior immediately.
- The system becomes more confident only through repeated evidence.

**Technical Requirements**
- Record learning signals for each correction.
- Associate signals with context and field identity.
- Adjust confidence conservatively and locally.
- Do not trigger global behavior changes in the MVP.

---

## US-12 — Mark document as reviewed

**User Story**  
As a veterinarian, I want to mark a document as reviewed once I have finished checking it.

**Acceptance Criteria**
- I can explicitly mark a document as reviewed.
- Reviewed documents are clearly identifiable.
- Editing a reviewed document reopens it for review.

**Technical Requirements**
- Persist review status separately from processing state.
- Expose mark-reviewed endpoint.
- Ensure review status remains consistent with edits.

---
