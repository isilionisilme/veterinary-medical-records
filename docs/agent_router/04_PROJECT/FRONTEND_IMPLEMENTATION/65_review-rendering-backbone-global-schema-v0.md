# Review Rendering Backbone (Global Schema v0)

Rendering authority for the full key universe, ordering, section grouping, repeatability, and fallback rules is
[`docs/project/PRODUCT_DESIGN.md`](../PRODUCT_DESIGN/00_entry.md) (Global Schema v0).

Frontend implementation guidance:
- Use Global Schema v0 as the review rendering backbone.
- Render all keys in stable order, grouped by the same sections (A-G), even when values are missing.
- Show explicit empty states/placeholders for missing values; do not hide keys only because the model omitted them.
- If `document_date` is missing, display the Product Design fallback to `visit_date`.

Repeatable keys (v0): `medication`, `diagnosis`, `procedure`, `lab_result`, `line_item`, `symptoms`, `vaccinations`, `imaging`.
- Always render the repeatable field container.
- Render an explicit empty-list state when there are no items.

Value typing (v0):
- Respect the existing v0 value types: `string | date | number | boolean | unknown`.
- For ambiguous or unit-bearing values, default to `string`.
- Do not introduce new parsing obligations beyond existing backend/frontend contracts.
