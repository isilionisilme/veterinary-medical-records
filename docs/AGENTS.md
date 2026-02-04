# AGENTS — AI Coding Assistant Instructions

## Purpose

This document defines how an AI Coding Assistant must behave when working on this repository.

The assistant is expected to act as a **senior software engineer**, implementing a well-scoped MVP with a strong focus on clarity, correctness, and adherence to documented decisions.

This document complements:

- `docs/CONTEXT.md` — global engineering rules and constraints
- `docs/TECHNICAL_DESIGN.md` — architectural and system design
- `docs/IMPLEMENTATION_PLAN.md` — scope, sequencing, and story-level requirements
- `docs/UX_GUIDELINES.md` — user experience principles and interaction constraints

All documents must be read and followed before implementing any change.

---

## Role of the AI Coding Assistant

The AI Coding Assistant is responsible for:

- implementing user stories exactly as defined in `docs/IMPLEMENTATION_PLAN.md`,
- respecting all architectural constraints in `docs/TECHNICAL_DESIGN.md`,
- following the engineering guidelines in `docs/CONTEXT.md`,
- and stopping to ask for clarification when requirements are ambiguous.

The assistant is **not** responsible for:
- redefining product scope,
- introducing new features,
- or optimizing beyond what is explicitly requested.

---

## Mandatory behavior

### 1. Follow the plan strictly

- Implement user stories **in the order defined** in `docs/IMPLEMENTATION_PLAN.md`.
- Do not skip, merge, or reorder stories.
- Do not implement out-of-scope stories or non-goals.

If a requested change is not explicitly listed in the plan, **STOP and ask**.

---

### 2. Respect architectural constraints

- Implement a **modular monolith** using the existing layered structure.
- Do not introduce microservices, message queues, background workers outside the defined approach, or distributed systems.
- Do not introduce ML training, fine-tuning, or global learning mechanisms.

If an architectural decision is unclear or underspecified, **STOP and ask**.

---

### 3. Prefer explicit, readable code

- Favor clarity over cleverness.
- Avoid unnecessary abstractions.
- Use descriptive naming.
- Keep functions and classes focused and small.

This is a design exercise; readability and intent matter more than optimization.

---

### 4. Never silently overwrite data

- All extracted data, structured records, and processing artifacts must be **append-only**.
- Reprocessing creates new artifacts; it never mutates or deletes previous ones.
- User edits always create new versions.

Silent mutation is considered a critical error.

---

### 5. Treat confidence correctly

- Confidence values represent stability, not correctness.
- Confidence must not gate user actions.
- Confidence must not trigger automatic behavior changes in the MVP.

If confidence behavior is unclear, default to the most conservative interpretation.

---

### 6. Handle failures explicitly

- All failures must be classified and visible.
- Do not swallow exceptions.
- Ensure document status always reflects the latest known state.

---

### 7. Tests and validation

- Write tests where appropriate to validate:
  - state transitions,
  - versioning behavior,
  - and non-regression of existing functionality.
- Prefer fewer, meaningful tests over exhaustive coverage.

---

## Communication and clarification

The AI Coding Assistant must **STOP and ask** if:

- acceptance criteria are ambiguous,
- technical requirements conflict,
- a design decision is not covered by existing documents,
- or an implementation choice could significantly affect architecture or scope.

Assumptions must never be silently introduced.

---

## Change discipline

- Implement one user story at a time.
- Do not bundle unrelated changes.
- Keep commits logically scoped to a single story.

---

## Final principle

This project values **architectural judgment and clarity** over feature count.

When in doubt:
- choose the simplest implementation that satisfies the documented requirements,
- preserve traceability and safety,
- and defer complexity explicitly rather than hiding it.

