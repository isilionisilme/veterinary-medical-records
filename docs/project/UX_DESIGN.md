# UX Design — Project Interaction Contract

This document defines the **project-specific UX and interaction design contract**
for the Veterinary Medical Records Processing system.

It complements the global UX principles defined in [`docs/shared/UX_GUIDELINES.md`](../shared/UX_GUIDELINES.md).

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
- `candidate_confidence` and `field_mapping_confidence` are distinct and must not be conflated in UX copy.

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
- No explicit per-field confirmation is required in the current phase.
- A single explicit action may exist to mark the document as reviewed.

- If the veterinarian marks the document as reviewed and a field remains unchanged, that outcome is treated as a weak positive signal for mapping stability.
- This implicit signal must not introduce extra steps or friction in veterinarian flow.

From the veterinarian’s perspective:
> “I am done with this document.”

---

### Step 4 — Mark document as reviewed (toggle)

The veterinarian can explicitly toggle review state from document view.

UX rules:
- A single action button `Mark as reviewed` is available in document view.
- `Mark as reviewed` is the canonical user action that completes review for a document.
- When marked as reviewed, the document list shows a checkmark indicator and the status label `Reviewed`.
- The veterinarian can unmark/reopen the document, returning it to the review queue and restoring the non-reviewed list indicator/label state.
- Unmark/reopen does not delete extracted values, corrections, or prior edits.
- Implicit review signal fires when the veterinarian marks reviewed and a field remains unchanged.

---

## 4.1 Review-in-Context Contract

The review experience must remain usable and explainable even when evidence rendering is imperfect.

Normative behavior:
- Selecting a field must navigate the document viewer to the field evidence context (at minimum, page jump).
- `View evidence` must always present useful context (page + snippet), including when precise highlighting is unavailable.
- Highlighting should be treated as progressive enhancement (best effort only), and failure to highlight must not block review flow.
- Low confidence should guide attention and inspection priority.
- Low confidence must not block editing, marking reviewed, or any other veterinarian action.

---

## Review UI Rendering Rules (Structured panel: v0 and v1)

Panel naming:
- The main right panel remains **Datos extraídos**.
- The first subsection label is **Datos de la clínica**.

1) Schema-aware rendering mode (deterministic)
- If `schema_version = "v0"`: render the current flat Global Schema template by fixed sections/order.
- If `schema_version = "v1"`: render fixed non-visit sections plus a dedicated **Visitas** grouping block sourced from `visits[]` (per [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md), Appendix D9).
- No heuristics grouping in UI; grouping comes from schema v1 `visits[]`.

2) Visit rendering rules for `schema_version = "v1"`
- Render one visual unit per `VisitGroup` (accordion or collapsible list).
- Ordering: `visit_date` descending (most recent first); synthetic `unassigned` is always last.
- Visit header content order:
  1. `Fecha`
  2. `Admisión` and `Alta` when present
  3. `Motivo` when present
- Inside each visit, render only visit-scoped clinical/cost fields associated with that visit.
- Recommended field order inside each visit:
  1. `Síntomas`
  2. `Diagnóstico`
  3. `Procedimientos`
  4. `Medicación`
  5. `Plan de tratamiento`
  6. Cost fields (`invoice_total`, `covered_amount`, `non_covered_amount`, `line_item`)
  7. Other visit-scoped items when present (`allergies`, `vaccinations`, `lab_result`, `imaging`)
- If a field is missing, do not add noisy placeholder blocks; follow standard missing-value placeholder behavior.
- Synthetic unassigned group copy is fixed: **Sin asignar / Sin fecha**.

3) Missing vs loading (deterministic)
- While structured data is loading, show a clear loading state (skeleton/spinner) and do not show missing placeholders yet.
- Once the run is ready, any absent/non-extracted value must render an explicit placeholder.

4) Placeholders must be explicit and consistent
- Use a consistent empty placeholder (for example `—`) and optionally a small hint such as `No encontrado`.
- Do not leave blank space without a placeholder.

5) Repeatable fields render as lists
- Repeatable fields MUST render as lists.
- If empty, render an explicit list-empty state (`Sin elementos` or `—`) distinct from scalar placeholders.

6) User journey (MVP)
- Upload document -> open review view -> inspect grouped visits when `schema_version = "v1"` -> review the full document -> mark the full document as reviewed.
- Review state remains document-level in MVP, even when multiple visits are present.
- If a later document introduces additional visits, it is treated as a separate document in MVP (no cross-document visit reconciliation).

7) Clarity criteria
- Do not mix items from different visits in the same rendered group.
- When `schema_version = "v1"`, avoid a flat standalone **Clínico** list; clinical/cost data should be shown inside each visit group.
- Extracted keys outside the active schema template MUST appear in **Other extracted fields**.

8) No governance terminology in veterinarian UX
- The veterinarian UI copy must not expose terms such as `pending_review`, `governance`, or `reviewer`.

## 4.2 Confidence Propagation & Calibration (UX Contract)

- `candidate_confidence` is an extraction-time diagnostic signal for a local candidate.
- `field_mapping_confidence` is a context stability signal used over time for the same semantic mapping.
- `field_mapping_confidence` is the primary UX signal; `candidate_confidence` is diagnostic and should not be shown by default.
- Veterinarian-facing review UI shows only `field_mapping_confidence` by default.
- `field_mapping_confidence` propagates continuously with smoothing; UI state should remain stable and avoid abrupt visual churn.
- Product policy actions (for example default suggestion or demotion) occur only via thresholds + hysteresis + minimum volume; UX should reflect outcomes, not expose calibration mechanics.

## 4.3 Confidence Tooltip Breakdown (Veterinarian UI)

- The veterinarian UI must show `field_mapping_confidence` as the default confidence signal.
- Numeric confidence values are secondary and may appear only inside tooltip details.
- `candidate_confidence` and `field_mapping_confidence` must not be conflated in UI copy or semantics.

Tooltip structure (Spanish, standard copy):
- First line: `Confianza: 72% (Media)`
- Explanation sentence: `Indica qué tan fiable es el valor extraído automáticamente.`
- `Desglose:`
  - `Fiabilidad de la extracción de texto: 65%`
  - `Ajuste por histórico de revisiones: +7%`

Semantic rules:
- `Fiabilidad de la extracción de texto` is a per-document diagnostic component tied to extraction quality for the current run.
- `Ajuste por histórico de revisiones` is an aggregated cross-document, system-level adjustment and is not about this single document only.
- The displayed confidence remains a field-level result; no document-level confidence policy UI is shown.

Visual rule:
- Adjustment value color is green when `> 0`, red when `< 0`, and neutral/muted when `= 0`.

Edge cases:
- If there is no review history, show `Ajuste por histórico de revisiones: 0%`.
- If extraction reliability is unavailable, show `Fiabilidad de la extracción de texto: No disponible`.

The rule "No governance terminology in veterinarian UX" remains in force for confidence tooltip copy.

### Future Improvements

- Random audit sampling support for occasional spot checks.
- Explicit per-field confirmation as an optional strong positive signal, stronger than implicit unchanged-on-complete signals.
- Fields proposed by veterinarians from **Other extracted fields** become high-priority reviewer proposals; naming reconciliation is expected future complexity.

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
[`docs/shared/UX_GUIDELINES.md`](../shared/UX_GUIDELINES.md), it must be escalated to Product Design.
