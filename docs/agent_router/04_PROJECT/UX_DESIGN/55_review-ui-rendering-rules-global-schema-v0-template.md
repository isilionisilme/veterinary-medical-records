# Review UI Rendering Rules (Structured panel: v0 and v1)

Panel naming:
- The main right panel remains **Datos extraidos**.
- The first subsection label is **Datos de la clinica**.

1) Schema-aware rendering mode (deterministic)
- If `schema_version = "v0"`: render the current flat Global Schema template by fixed sections/order.
- If `schema_version = "v1"`: render fixed non-visit sections plus a dedicated **Visitas** grouping block sourced from `visits[]` (per `docs/project/TECHNICAL_DESIGN.md`, Appendix D9).
- No heuristics grouping in UI; grouping comes from schema v1 `visits[]`.

2) Visit rendering rules for `schema_version = "v1"`
- Render one visual unit per `VisitGroup` (accordion or collapsible list).
- Ordering: `visit_date` descending (most recent first); synthetic `unassigned` is always last.
- Visit header content order:
  1. `Fecha`
  2. `Admision` and `Alta` when present
  3. `Motivo` when present
- Inside each visit, render only visit-scoped clinical/cost fields associated with that visit.
- Recommended field order inside each visit:
  1. `Sintomas`
  2. `Diagnostico`
  3. `Procedimientos`
  4. `Medicacion`
  5. `Plan de tratamiento`
  6. Cost fields (`invoice_total`, `covered_amount`, `non_covered_amount`, `line_item`)
  7. Other visit-scoped items when present (`allergies`, `vaccinations`, `lab_result`, `imaging`)
- If a field is missing, do not add noisy placeholder blocks; follow standard missing-value placeholder behavior.
- Synthetic unassigned group copy is fixed: **Sin asignar / Sin fecha**.

3) Missing vs loading (deterministic)
- While structured data is loading, show a clear loading state (skeleton/spinner) and do not show missing placeholders yet.
- Once the run is ready, any absent/non-extracted value must render an explicit placeholder.

4) Placeholders must be explicit and consistent
- Use a consistent empty placeholder (for example `-`) and optionally a small hint such as `No encontrado`.
- Do not leave blank space without a placeholder.

5) Repeatable fields render as lists
- Repeatable fields MUST render as lists.
- If empty, render an explicit list-empty state (`Sin elementos` or `-`) distinct from scalar placeholders.

6) User journey (MVP)
- Upload document -> open review view -> inspect grouped visits when `schema_version = "v1"` -> review the full document -> mark the full document as reviewed.
- Review state remains document-level in MVP, even when multiple visits are present.
- If a later document introduces additional visits, it is treated as a separate document in MVP (no cross-document visit reconciliation).

7) Clarity criteria
- Do not mix items from different visits in the same rendered group.
- When `schema_version = "v1"`, avoid a flat standalone **Clinico** list; clinical/cost data should be shown inside each visit group.
- Extracted keys outside the active schema template MUST appear in **Other extracted fields**.

8) No governance terminology in veterinarian UX
- The veterinarian UI copy must not expose terms such as `pending_review`, `governance`, or `reviewer`.
