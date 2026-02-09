# A3. Interpretation & Versioning Invariants

## A3.1 Structured Interpretations

- Interpretations are versioned records linked to a run.
- Any edit creates a **new interpretation version**.
- Previous versions are retained and immutable.
- Exactly one interpretation version is **active** at a time per run.

### Active version invariant (Operational, normative)
- When creating a new InterpretationVersion for a run:
  - It MUST be done in a single transaction:
    1) set all previous versions for that `run_id` to `is_active = false`
    2) insert the new version with `is_active = true` and `version_number = previous_max + 1`
- At no point may two rows be active for the same `run_id`.

---

## A3.2 Field-Level Changes

- All edits produce field-level change log entries.
- Change logs are append-only.
- Structural changes (add/remove/rename field):
  - set internal `pending_review = true`,
  - do **not** affect veterinarian workflow.

---
