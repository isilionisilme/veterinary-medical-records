# 1.4 Persistence Strategy (Intent)

Intent:  
Persist the **minimum set of artifacts** required to make the system debuggable, auditable, and safe for human-in-the-loop workflows.

Persistence moments:
- On ingestion: persist document metadata and initial lifecycle state.
- After each pipeline stage: persist produced artifacts and state transitions.
- On human edits: persist new append-only revisions; never overwrite silently.

Storage mapping and invariants are defined normatively in **Appendix B**.

---
