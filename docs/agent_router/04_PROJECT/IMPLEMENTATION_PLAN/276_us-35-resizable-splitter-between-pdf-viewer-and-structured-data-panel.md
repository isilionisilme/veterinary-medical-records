# US-35 — Resizable splitter between PDF Viewer and Structured Data panel

**User Story**
As a veterinarian reviewer, I want to resize the PDF and structured-data panels so that I can optimize my workspace for reading the document or validating fields.

**Objective**
- Make side-by-side review adaptable to desktop monitor sizes and reviewer tasks without introducing new workflow modes.

**Acceptance Criteria**
- A vertical splitter handle allows pointer drag resizing between the PDF Viewer and Structured Data panels.
- The splitter has a generous hit area and resize cursor.
- Sane width constraints are enforced:
  - PDF panel has a minimum width that preserves readability.
  - Structured panel has a minimum width that preserves field readability.
  - Neither panel can be resized to fully collapse the other.
- Default layout can be restored via double-click on the splitter handle.
- Preferred behavior: include an explicit reset affordance near the splitter.
- Preferred behavior: persist split ratio in local storage so it survives page refresh on the same device.
- Resizing keeps Global Schema rendering deterministic (field order/position remains canonical).
- Resizing does not break panel scroll/focus behavior and does not interfere with PDF interactions or structured data filtering/search.
- Any icon-only control introduced for splitter actions includes an accessible name.

**Scope Clarification**
- This story keeps the existing three-area layout (documents sidebar, PDF Viewer, structured data panel).
- This story is limited to review-layout resizing behavior and local persistence.
- This story does not change endpoint contracts, persistence schema, or interpretation semantics.

**Out of Scope**
- New review modes, alternate workflows, or additional panel types.
- Reordering/redefining Global Schema fields.
- Non-desktop-specific layout redesign.

**UX Notes**
- The splitter should be subtle at rest and more visible on hover/focus.
- Dragging must feel stable and avoid jitter or layout jumps.
- Interaction should remain fast and tool-like.

**Edge Cases**
- Very narrow container widths should gracefully clamp to a safe split.
- Loading/empty/error states must keep layout integrity and not break splitter behavior.
- Pinned source panel mode must keep splitter behavior stable for PDF vs Structured Data.

**Authoritative References**
- UX: Side-by-side review interaction baseline: [`docs/project/UX_DESIGN.md`](../UX_DESIGN/00_entry.md) Sections 2–4.
- Product: Global Schema canonical ordering invariants: [`docs/project/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md) section **Global Schema v0 (Canonical Field List)**.
- Frontend context: review rendering backbone and deterministic structure: [`docs/project/FRONTEND_IMPLEMENTATION.md`](../FRONTEND_IMPLEMENTATION/00_entry.md) section **Review Rendering Backbone (Global Schema v0)**.

**Test Expectations**
- Splitter drag updates panel widths while honoring min/max constraints.
- Default reset behavior restores baseline split.
- Stored split ratio is restored on reload when available and valid.
- Structured panel keeps deterministic Global Schema order under resize and existing filters.

**Definition of Done (DoD)**
- Acceptance criteria satisfied.
- Unit + integration tests per [docs/project/TECHNICAL_DESIGN.md](../TECHNICAL_DESIGN/00_entry.md) Appendix B7.
- Follow UX guidance from [docs/shared/UX_GUIDELINES.md](../../03_SHARED/UX_GUIDELINES/00_entry.md) and [docs/project/UX_DESIGN.md](../UX_DESIGN/00_entry.md), if applicable.
- Apply [docs/shared/BRAND_GUIDELINES.md](../../03_SHARED/BRAND_GUIDELINES/00_entry.md), if applicable.

---
