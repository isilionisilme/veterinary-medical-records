# 4. Reprocessing Rules

- Reprocessing is **manual only** (explicit user action).
- The system must not automatically create new runs.
- Reprocessing:
  - creates a new processing run
  - never overwrites previous data
- Retries inside a run (e.g. transient step retry) are allowed, but must not create new runs.

---
