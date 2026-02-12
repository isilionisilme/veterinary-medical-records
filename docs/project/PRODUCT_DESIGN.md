# Product Design — Document Interpretation & Layout Evolution

## Note for readers

This repository includes a minimal summary of the product approach for technical context only.

The complete product design — including problem framing, user experience, rationale, and business considerations — is maintained as a single source of truth in the following document:

https://docs.google.com/document/d/1eUCXDTYX3Vw_EJ_nfiJKlRghMO7mZOfitVpMrM5kjFc

Readers interested in the full product and user experience design should refer to that document.

---

## High-level product approach

The product approach focuses on improving the interpretation of unstructured veterinary medical documents in a **safe, incremental, and non-disruptive way**.

Instead of attempting full automation, the system:

- assists veterinarians during document review,
- makes uncertainty and confidence explicit,
- and passively captures corrections as signals for gradual improvement.

The key principle is to convert **inevitable human review work into cumulative system learning**, without changing how veterinarians work or introducing operational risk.

This high-level approach informs the technical and implementation decisions described elsewhere in the repository.


## 1. Core Product Strategy

The system is designed to enable **incremental, human-in-the-loop automation**
without disrupting existing veterinary workflows.

The product assumes that:
- deterministic checks can eventually be automated safely,
- interpretative reasoning must remain **assistive**, never authoritative,
- high-stakes or irreversible decisions always require **explicit human action**.

The long-term goal is to convert **inevitable human corrections**
into **cumulative system improvement**, without asking users to:
- change how they work,
- provide explicit feedback,
- or take responsibility for system behavior.

This strategy deliberately prioritizes:
- safety over speed,
- clarity over automation depth,
- evolvability over premature optimization.

---

## 2. Human-in-the-Loop Philosophy (Product-Level)

Human involvement is not a fallback mechanism; it is a **first-class design choice**.

Product-level rules:
- The system may suggest, highlight, and assist.
- The system must never silently decide or override.
- All meaningful changes remain observable and auditable.
- Human judgment always has the final word.

Automation is introduced **incrementally**, and only where its behavior is
well understood, explainable, and reversible.

---

## 2.1 Confidence Principles (Product-Level)

Confidence is a **signal about interpretation stability**, not a decision or a truth claim.

Product guarantees:
- Confidence guides attention and prioritization; it never blocks decisions or actions.
- Confidence reflects consistency over time/context for similar interpretations.
- Confidence may decrease faster than it increases when new contradictory evidence appears.

---

## 3. Structural Signals & Pending Review

Some human actions carry **system-level meaning** beyond a single document.

These actions generate **structural signals**.

### 3.1 Definition

A structural signal represents a **repeated, semantically similar correction**
observed across multiple documents under comparable conditions.

Structural signals:
- are accumulated over time,
- are evaluated in aggregate,
- never trigger automatic system changes.

They exist to support **deliberate, informed human governance**.

---

### 3.2 Pending Review State

Structural signals may enter a `pending_review` state when they indicate a
potential need for system-level intervention.

Rules:
- `pending_review` is an **internal system state**.
- It never blocks or alters veterinary workflows.
- It never affects previously processed documents.
- It never triggers implicit reprocessing.

Pending review exists solely to surface **candidates for human review**.

---

### 3.3 Scope of Impact

Any decision derived from structural signals:
- applies **prospectively only**,
- never modifies past interpretations,
- never silently alters system behavior.

The system must remain explainable at all times.

---

## 4. Critical Concepts

Some concepts are inherently **high-risk or high-impact** if misinterpreted.

These are referred to as **critical concepts**.

Examples include (non-exhaustive):
- patient or pet identity,
- species,
- visit or invoice dates,
- monetary amounts.

---

### 4.1 Semantics

Critical concepts:
- are defined explicitly by product policy,
- are not inferred dynamically by the system,
- may evolve only through deliberate human review.

The classification of a concept as “critical” is:
- intentional,
- explicit,
- conservative by design.

---

### 4.2 Interaction with Structural Signals

Edits affecting critical concepts:
- always apply **locally and immediately**,
- generate **high-priority structural signals**,
- never block document review or completion.

No additional friction is introduced for operational users.

---

### 4.3 Governance Boundary

Critical concepts introduce a stricter governance threshold:

- No automatic promotion to system-wide behavior.
- Explicit human review is required before any global effect.
- Decisions affect **future interpretations only**.

Criticality is a governance concern, not a workflow constraint.

---

### 4.4 Critical / Non-Reversible Changes Policy

Some system-level changes are treated as **critical/non-reversible** because they can
reshape future interpretation semantics and are costly to safely undo.

Critical/non-reversible changes include (non-exhaustive):
- schema-level key add/remove/rename decisions,
- key remapping that changes canonical meaning,
- changes affecting the definition/classification of critical concepts.

Product guarantees:
- Veterinarian workflow remains local to single-document resolution and never carries governance burden.
- Reviewer governance handles cross-document/system-level policy decisions explicitly and prospectively.
- Stricter handling applies only to governance decisions, never as added friction for veterinarians.

---

### CRITICAL_KEYS_V0 (Authoritative, closed set)

This list is the source of truth for Appendix D7.4.

CRITICAL_KEYS_V0 = [
  "pet_name",
  "species",
  "breed",
  "sex",
  "age",
  "weight",
  "visit_date",
  "diagnosis",
  "medication",
  "procedure"
]


## 5. Separation of Responsibilities (Product-Level)

The product enforces a strict separation of responsibility:

- **Veterinarians**
  - Resolve individual documents.
  - Correct and validate information locally.
  - Never manage system behavior or learning.

- **Reviewers**
  - Oversee system-level meaning and evolution.
  - Review aggregated patterns and signals.
  - Never participate in operational document workflows.

This separation is:
- intentional,
- asymmetric,
- non-negotiable.

No user is responsible for both document resolution
and system governance within the same workflow.

---

## 6. Learning & Governance

This project is designed to keep veterinary workflows operational and safe while enabling deliberate, auditable system-level evolution over time.

Any change that affects global behavior or schema meaning should be introduced via explicit governance and corresponding product, UX, and technical design updates.

---

## 7. Final Product Rule

This document defines **what the system means and why**.

It does not define UI layout or interaction patterns, architectural or implementation details, or API/persistence contracts.

If a decision cannot be justified using:
- this document,
- UX Design,
- or Technical Design,

**STOP and clarify before proceeding.**
