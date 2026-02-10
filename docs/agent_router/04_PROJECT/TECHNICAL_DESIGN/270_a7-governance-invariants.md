# A7. Governance Invariants

- Governance operates **only at schema level**.
- Governance decisions:
  - never modify existing documents,
  - never trigger reprocessing implicitly,
  - apply prospectively only.
- All governance decisions are:
  - append-only,
  - auditable,
  - reviewer-facing only.

---
