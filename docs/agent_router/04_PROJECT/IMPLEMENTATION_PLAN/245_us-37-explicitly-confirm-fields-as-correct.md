# US-37 — Explicitly confirm fields as correct (1-click, reversible, selective)

**User Story**
As a veterinary reviewer, I want to explicitly mark an extracted field as correct without editing it so that I can leave a clear review trail, reduce ambiguity between “not edited” and “reviewed”, and support auditability and extraction quality feedback.

**Context / Principles**
- The Structured Data panel continues to render the fixed Global Schema in deterministic order.
- Confirmation is per-field and inline; no global edit/review mode is introduced.
- Confirmation must be low-friction and must not change field/section ordering.

**Acceptance Criteria**
- Confirm is shown only when at least one condition is true: field confidence bucket is Low/Medium, or the field is CRITICAL (including CRITICAL with High confidence).
- Confirm is not shown for fields that are High confidence and not CRITICAL.
- Clicking Confirm sets field review status to `confirmed`, updates UI immediately to a reviewed/confirmed state, keeps value unchanged, and does not open an editor.
- Confirmed fields expose inline Undo; Undo returns the field to `unreviewed`.
- Editing + saving a field (US-08) sets status to `corrected`.
- If a field was confirmed and is later edited + saved, status becomes `corrected` (editing precedence).
- If a field is `corrected`, Confirm is not shown.
- Confirmed/corrected review statuses persist across reload and are restored correctly.
- Confirm/Confirmed/Undo controls are rendered in the existing `FieldRow` status cluster area on the label line, preserving layout alignment.
- Once confirmed, Confirmed/Reviewed is the dominant status signal; original confidence remains accessible but not primary.

**Scope Clarification**
- In scope: explicit per-field confirmation without editing, undo for confirmed fields, and deterministic precedence with editing.
- In scope: persistence metadata for field-level review status:
  - `review_status`: `unreviewed | confirmed | corrected`
  - `reviewed_at`: timestamp
  - `reviewed_by`: user identity when available; otherwise null/omitted per current auth model
- In scope (implementation notes): extend the field-level persistence contract and review payload serialization to include review metadata; update read/write API behavior used by Structured Data review for confirm/undo/edit precedence.
- Out of scope: bulk confirmation actions (`confirm all`, `confirm pending`).
- Out of scope: conditional confirmation rules by claim type beyond confidence + CRITICAL.
- Out of scope: advanced audit workflows beyond storing `review_status` metadata.

**Authoritative References**
- Product: Canonical field order and schema constraints: [`docs/project/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md) section **Global Schema v0 (Canonical Field List)**.
- UX: Review rendering contract and confidence semantics: [`docs/project/UX_DESIGN.md`](../UX_DESIGN/00_entry.md) sections **Review UI Rendering Rules (Global Schema v0 Template)** and Sections 2–4.
- Frontend context: review rendering and `FieldRow` alignment baseline: [`docs/project/FRONTEND_IMPLEMENTATION.md`](../FRONTEND_IMPLEMENTATION/00_entry.md) section **Review Rendering Backbone (Global Schema v0)**.
- Tech: Interpretation/editing persistence and versioning constraints: [`docs/project/TECHNICAL_DESIGN.md`](../TECHNICAL_DESIGN/00_entry.md) Appendix A3 + Appendix B2.4 + Appendix B2.5.

**Test Expectations**
- Unit/component tests verify Confirm visibility rules (Low/Medium OR CRITICAL; hidden for High + non-CRITICAL).
- Interaction tests cover `confirm -> confirmed` and `confirmed -> undo -> unreviewed` transitions without opening field editor.
- Precedence tests cover `confirmed -> edit+save -> corrected` and ensure corrected fields do not show Confirm.
- Persistence tests verify confirmed/corrected statuses survive reload (via mocked API/store state rehydration).
- Layout tests/snapshots verify FieldRow alignment remains stable after introducing Confirm/Undo controls.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/project/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/project/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../../03_SHARED/BRAND_GUIDELINES/00_entry.md), if applicable.

---
