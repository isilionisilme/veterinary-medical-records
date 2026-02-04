# UX Contract — Document Interpretation & Governance-Aware Review

This document defines the **UX and product interaction contract** for the system.

It is not a technical or implementation specification.

Its purpose is to ensure that all UI and interaction design:
- aligns with the core product strategy,
- preserves veterinary workflows,
- and supports safe, scalable system evolution.

All UI and interaction decisions must comply with this contract.
If a design choice conflicts with these principles, it must be reconsidered.

---

## 0. Global UI Principles (All Users)

These principles apply to all users and all screens:

- Progressive disclosure: show summaries first, details on demand.
- Side-by-side comparison whenever review or correction is needed.
- One primary action per screen.
- System uncertainty must be visible when relevant.
- Evidence must always be accessible in ≤ 1 interaction.

---

## 1. Core Product Strategy (UX-Relevant)

The system is designed to:

> **Convert inevitable human corrections into cumulative system improvement,
> without adding friction or changing how people work.**

UX implications:

- The UI must not require explicit actions “to help the system”.
- System improvement is a consequence of normal use.
- Learning must not introduce extra steps, confirmations, or workflow changes.
- Users may understand that the system improves over time,
  as long as this understanding does not affect how they work.

---

## 2. User Roles & UX Goals

### 2.1 Veterinarian — Document Review Under Time Pressure

**Context**  
Veterinarians review medical documents as part of their normal clinical and operational work.

**UX Goals**
- Reduce cognitive load.
- Minimize context switching.
- Make uncertainty, confidence, and provenance explicit.
- Optimize for scanning, not reading.
- Every screen answers: *“What do I need to decide or fix now?”*

**Mental Model**
- “I am reviewing this document.”
- “I fix what is wrong and move on.”
- I am not managing schemas, learning, or system behaviour.

---

### 2.2 Reviewer — System-Level Meaning & Governance

**Context**  
Reviewers are responsible for governing how the system’s shared structure
and behaviour evolve over time.

They do not resolve documents and do not participate in operational review workflows.

**UX Goals**
- Make global impact explicit and inspectable.
- Support deliberate, high-stakes decisions.
- Prioritize safety, auditability, and coherence over speed.
- Focus attention on risk, stability, and systemic meaning.

**Mental Model**
- “I am reviewing patterns across many documents.”
- “I decide what the system is allowed to mean in the future.”
- Decisions are global, explicit, and intentional.

---

## 3. Confidence — UX Definition

Confidence is **not correctness**.

Confidence means:

> “How stable a given interpretation has been across similar documents.”

UX rules:

- Confidence guides **attention**, not decisions.
- Confidence does not block or disable actions.
- Confidence never overrides human judgment.

---

## 4. Confidence Visibility

### 4.1 Qualitative Signal (Primary)

Confidence must be visible at a glance using qualitative signals
(e.g. color, emphasis, grouping).

Exact thresholds are product decisions, not UX logic.

### 4.2 Quantitative Signal (Secondary)

- Exact confidence values may be visible (tooltip, expandable detail).
- Abstract numeric signals (e.g. probabilities, confidence scores)
  must not be required to complete work.
- Numeric information intrinsic to the domain
  (e.g. costs, quantities, dates) must always be fully usable.

---

## 5. Veterinarian Review Flow

### Step 1 — Document & Interpretation Together

The veterinarian sees, in the same context:

- the original document,
- the structured interpretation,
- confidence indicators per field.

These must never be split into separate screens.

---

### Step 2 — Confidence-Guided Attention

- Low-confidence fields stand out.
- High-confidence fields fade into the background.

The UI guides *where to look first*, not *what to decide*.

---

### Step 3 — Immediate Local Correction

The veterinarian can:

- edit values,
- reassign information,
- create new fields when needed.

UX constraints:

- Changes apply immediately to the current document.
- No explicit actions exist to submit feedback, approve learning,
  or confirm system behaviour.
- A single explicit action may exist to mark the document as reviewed
  or completed.
- This action closes the veterinarian’s work on the current document only
  and must not reference learning, schema evolution, or global impact.

From the veterinarian’s perspective:
> “I am done with this document.”

---

## 6. Structural Signals & Pending Review

Some veterinarian corrections generate **structural signals**.

System behaviour:
- Structural signals are accumulated and marked as pending review.
- Signals may carry metadata such as affected concepts,
  confidence evolution, and risk level.

### Veterinarian UX Rules

- Pending review states are **not exposed to veterinarians**.
- No warnings about global or future impact are shown.
- No responsibility beyond the current document is implied.

From the veterinarian’s perspective:
> “I fixed this document and continued my work.”

---

### Reviewer UX Rules

- Reviewers have full visibility of all pending review signals.
- Signals are visible at field and concept level.
- Signals affecting **critical concepts** are explicitly identifiable.

When a veterinarian edits a critical concept:
- The change applies locally and immediately.
- A high-priority signal is generated for reviewers.
- The signal is surfaced with higher urgency than non-critical changes.

Reviewer UX must support:
- prioritisation by concept criticality,
- confidence and stability over time,
- and potential downstream impact.

---

## 7. Reviewer Interaction Model

Reviewers interact with **aggregated structural patterns**, not individual actions.

UX principles for reviewers:

- Signals represent repeated behaviour under similar conditions.
- Individual corrections have no standalone meaning.
- Review is pattern-based, not task-based.

Reviewers may:

- inspect context and stability of patterns,
- prioritise by risk, impact, and confidence,
- accept, reject, or defer global schema evolution.

These decisions:

- never block veterinary work,
- never affect past documents,
- only influence interpretation of future documents.

---

## 8. Critical Concepts

Some concepts are inherently sensitive
(medical meaning, coverage, economic interpretation).

UX implications:

- Veterinarians can always edit critical concepts without friction.
- Editing critical concepts never alters veterinary workflow.
- Edits to critical concepts generate high-priority review signals.
- Reviewer involvement is always required before global promotion.

Safety is enforced through system behaviour and reviewer governance,
not through veterinarian UX constraints.

---

## 9. Separation of Responsibilities (Non-Negotiable)

- Veterinarians resolve documents.
- Reviewers govern system meaning.
- The two workflows are asymmetric and decoupled.

The veterinarian UI must not:
- surface reviewer decisions,
- preempt governance workflows,
- or imply responsibility for system-level behaviour.
