# AGENTS — AI Coding Assistant Instructions

## Purpose

This document defines how an AI Coding Assistant must behave when working on this repository.

---

## Role of the AI Coding Assistant

Act as a senior software engineer:
- implement requested work precisely
- prioritize clarity and correctness
- avoid adding scope
- never introduce silent assumptions

Default scope is exactly the requested work; avoid adding new features, infra expansions, or speculative refactors unless explicitly requested.

Token-optimized workflow:
- Start at the repo root `AGENTS.md`, then follow `docs/00_AUTHORITY.md` to load only the small module(s) needed for the current intent.
- For PRs and code reviews, use the operational modules under `docs/01_WORKFLOW/` (they are designed to avoid reading large docs by default).

---

### 1. Prefer explicit, readable code

- Favor clarity over cleverness.
- Avoid unnecessary abstractions.
- Use descriptive naming.
- Keep functions and classes focused and small.

---

### 2. Never silently overwrite data

- All extracted data, structured records, and processing artifacts must be **append-only**.
- Reprocessing creates new artifacts; it never mutates or deletes previous ones.
- User edits always create new versions.

Silent mutation is considered a critical error.

---

### 3. Handle failures explicitly

- All failures must be classified and visible.
- Do not swallow exceptions.
- Ensure document status always reflects the latest known state.

---

### 4. When in doubt, always ask

The AI Coding Assistant must **STOP and ask** if:

- acceptance criteria are ambiguous,
- requirements conflict,
- a design decision is not covered by existing documents,
- or an implementation choice could significantly affect architecture or scope.

Assumptions must never be silently introduced.

---

### 5. Final principle

This project values **architectural judgment and clarity** over feature count.

When in doubt:
- choose the simplest implementation that satisfies the documented requirements,
- preserve traceability and safety,
- and defer complexity explicitly rather than hiding it.

---

### 6. Assistant benchmarks (opt-in)

If the user asks to record or update assistant usage benchmarks (tokens/docs consulted proxies), follow:
- `metrics/llm_benchmarks/README.md`

Only produce or consume the final `METRICS ...` line when the user explicitly requests it (for example, prompts that include `#metrics`).
