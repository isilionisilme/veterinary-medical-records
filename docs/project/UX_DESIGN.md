# UX Design — Project Interaction Contract

This document defines the **project-specific UX and interaction design contract**
for the Veterinary Medical Records Processing system.

It complements the global UX principles defined in `docs/shared/UX_GUIDELINES.md`.

All UI and interaction decisions for this project must comply with this document.
If a design choice conflicts with these rules, it must be reconsidered.

---

## 1. User Roles & UX Goals

### 1.1 Veterinarian — Document Review Under Time Pressure

**Context**  
Veterinarians review medical documents as part of their normal clinical
and operational work.

**UX Goals**
- Reduce cognitive load.
- Minimize context switching.
- Make uncertainty, confidence, and provenance explicit.
- Optimize for scanning, not reading.
- Every screen answers: *“What do I need to decide or fix now?”*

**Mental Model**
- “I am reviewing this document.”
- “I fix what is wrong and move on.”
- I am not managing schemas, learning, or system behavior.

---

### 1.2 Reviewer — System-Level Oversight

**Context**  
Reviewers operate at system level and are responsible for overseeing
global patterns and long-term consistency.

They do not resolve individual documents and do not participate
in operational review workflows.

**UX Goals**
- Make global impact explicit and inspectable.
- Support deliberate, high-stakes decisions.
- Prioritize safety, auditability, and coherence over speed.
- Focus attention on patterns, not individual actions.

**Mental Model**
- “I am reviewing system behavior over time.”
- “I decide what should change globally.”
- My decisions never affect past documents.

---

## 2. Confidence — UX Definition

Confidence is **not correctness**.

From a UX perspective, confidence means:

> “How stable a given interpretation appears across similar documents.”

UX rules:
- Confidence guides **attention**, not decisions.
- Confidence never blocks actions.
- Confidence never overrides human judgment.

---

## 3. Confidence Visibility

### 3.1 Qualitative Signal (Primary)

- Confidence must be visible at a glance.
- Use qualitative signals (e.g. emphasis, grouping, visual weight).
- Low-confidence elements should naturally attract attention first.

Exact thresholds and scoring models are product decisions, not UX logic.

---

### 3.2 Quantitative Signal (Secondary)

- Numeric confidence values may be visible via secondary affordances
  (tooltips, expandable details).
- Quantitative signals must never be required to complete work.
- Domain-intrinsic numbers (dates, amounts, quantities) remain fully usable.

---

## 4. Veterinarian Review Flow

### Step 1 — Document & Interpretation Together

The veterinarian reviews, in a single unified context:
- the original document,
- the structured interpretation,
- confidence indicators per field.

These elements must never be split into separate screens.

---

### Step 2 — Confidence-Guided Attention

- Low-confidence fields stand out visually.
- High-confidence fields recede into the background.

The UI guides *where to look first*, not *what to decide*.

---

### Step 3 — Immediate Local Correction

The veterinarian can:
- edit existing values,
- reassign information,
- create new fields when needed.

UX rules:
- Changes apply immediately to the current document.
- No explicit actions exist to submit feedback or “teach” the system.
- A single explicit action may exist to mark the document as reviewed.

From the veterinarian’s perspective:
> “I am done with this document.”

---

## 5. Structural Effects — UX Consequences Only

Some user actions may have **system-level consequences**.

From a UX standpoint:

### Veterinarian UX Rules
- These consequences are **not exposed** to veterinarians.
- No warnings, confirmations, or explanations are shown.
- No responsibility beyond the current document is implied.
- Workflows remain identical regardless of downstream effects.

### Reviewer UX Rules
- Reviewers may see aggregated effects of repeated actions.
- Signals are presented as patterns, never as individual blame.
- High-impact patterns are visually distinguishable.

---

## 6. Sensitive Changes — UX Rules

Some edits may be considered more sensitive at system level.

UX implications:
- Veterinarians can always edit fields without friction.
- No additional confirmations are introduced.
- Sensitive edits never block completion of review.

Any escalation, prioritization, or governance resulting from these edits
is **not defined by this document** and must not surface in the veterinarian UI.

---

## 7. Reviewer Interaction Model

Reviewers interact with **aggregated patterns**, not individual edits.

UX principles:
- Patterns emerge over time.
- Single actions have no standalone meaning.
- Review focuses on trends, stability, and risk.

Reviewer decisions:
- never block veterinary work,
- never affect past documents,
- apply prospectively only.

---

## 8. Separation of Responsibilities (Non-Negotiable)

- Veterinarians resolve documents.
- Reviewers oversee system-level meaning.
- The workflows are asymmetric and decoupled.

The veterinarian UI must not:
- surface reviewer decisions,
- preempt governance workflows,
- imply responsibility for system behavior.

---

## 9. Final UX Rule

This document defines **how the system feels and behaves to users**.

It does not define:
- product strategy,
- system semantics,
- governance rules,
- learning mechanisms.

If a UX decision cannot be resolved using this document and
`UX_GUIDELINES.md`, it must be escalated to Product Design.
