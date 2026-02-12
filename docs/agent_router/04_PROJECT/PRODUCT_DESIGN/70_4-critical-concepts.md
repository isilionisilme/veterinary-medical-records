# 4. Critical Concepts

Some concepts are inherently **high-risk or high-impact** if misinterpreted.

These are referred to as **critical concepts**.

Examples include (non-exhaustive):
- patient or pet identity,
- species,
- visit or invoice dates,
- monetary amounts.

---

## 4.1 Semantics

Critical concepts:
- are defined explicitly by product policy,
- are not inferred dynamically by the system,
- may evolve only through deliberate human review.

The classification of a concept as “critical” is:
- intentional,
- explicit,
- conservative by design.

---

## 4.2 Interaction with Structural Signals

Edits affecting critical concepts:
- always apply **locally and immediately**,
- generate **high-priority structural signals**,
- never block document review or completion.

No additional friction is introduced for operational users.

---

## 4.3 Governance Boundary

Critical concepts introduce a stricter governance threshold:

- No automatic promotion to system-wide behavior.
- Explicit human review is required before any global effect.
- Decisions affect **future interpretations only**.

Criticality is a governance concern, not a workflow constraint.
