# Release 7 — Edit workflow hardening

## Goal
Make field editing robust and predictable, preventing data loss and ensuring correct modification semantics.

## Scope
- Dirty state tracking and discard confirmation in field edit dialog
- Reset individual fields or all fields to originally detected values
- Correct modification tracking when saving the originally suggested value
- Confidence refresh after editing a reopened reviewed document

## User Stories (in order)
- US-47 — Prevent losing unsaved field edits (dirty state + confirm discard)
- US-48 — Reset field(s) to original detected value
- US-49 — Treat save of originally suggested value as unmodified
- US-59 — Refresh visible confidence after edits on reopened document

---
