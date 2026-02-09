# A5. API Contract Principles

These principles apply to **all endpoints**:

- APIs are **internal**.
- Contracts are explicit and deterministic.
- Responses always include enough context for the UI to explain:
  - current state,
  - latest run,
  - failure category (if any).
- No endpoint:
  - triggers implicit schema changes,
  - blocks veterinarian workflows.

## A5.1 Run Resolution Rule

- UI obtains `run_id` via document endpoints.
- “Latest completed run” is used for review.
- “Latest run” is used for status and processing visibility.

---
