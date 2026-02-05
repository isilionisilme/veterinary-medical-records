 # Frontend Implementation Notes

## Purpose

This document describes **how the frontend implements the existing product and UX design**.

It does **not** redefine:
- product scope,
- user stories,
- acceptance criteria,
- or UX principles.

Those are defined in:
- `IMPLEMENTATION_PLAN.md`
- `UX_GUIDELINES.md`
- `TECHNICAL_DESIGN.md`

This document exists solely to clarify **technical frontend decisions** and **implementation strategies** for complex requirements.

---

## Frontend Stack Decision

The frontend is implemented using:

- **React + TypeScript (Vite)**  
  Chosen to explicitly satisfy the “Frontend (ReactJS)” requirement and to keep setup fast and standard.

- **Tailwind CSS**  
  Enables rapid iteration and consistent styling with minimal custom CSS.

- **shadcn/ui (Radix UI)**  
  Provides accessible, composable UI primitives suitable for review-heavy interfaces.

- **TanStack Query**  
  Manages server state (loading, error, invalidation) cleanly without introducing global state complexity.

- **Lucide React**  
  Lightweight, consistent iconography.

- **Framer Motion (minimal usage)**  
  Used only for subtle transitions (e.g. skeleton → content).

- **PDF.js (`pdfjs-dist`)**  
  Used to render PDFs and support evidence-based review and highlighting.

Explicitly excluded from MVP:
- global state libraries (Redux, Zustand),
- coordinate-based PDF overlays,
- advanced annotation systems.

---

## Key Implementation Decisions

### PDF Review and Evidence Rendering

The frontend implements document review using **evidence-based navigation**, not precise spatial annotation.

For each structured field, the backend provides:
- a page number,
- and a text snippet.

Frontend behaviour:
- when a field is selected, the PDF viewer navigates to the relevant page,
- the snippet is displayed as explicit evidence,
- review remains fully usable even if no highlight is possible.

This guarantees:
- traceability,
- explainability,
- and zero blocking of the review flow.

---

### Highlight Strategy (Progressive Enhancement)

Highlighting text inside the PDF is implemented as **progressive enhancement**, never as a dependency for usability.

Implementation approach:
- use PDF.js text layer,
- attempt to locate the snippet text on the target page,
- highlight the closest or first matching occurrence.

If matching fails:
- no highlight is shown,
- page navigation and snippet evidence remain visible,
- the UI does not attempt to fake precision.

Bounding boxes and exact coordinates are deliberately excluded from MVP.

---

### Confidence Rendering

Confidence is rendered as a **visual attention signal**, not as a control mechanism.

Frontend representation:
- qualitative signal first (e.g. red / yellow / green),
- numeric confidence value visible (inline or via tooltip).

Confidence:
- never blocks editing,
- never triggers confirmation flows,
- and never implies correctness.

The frontend treats confidence as **guidance for attention**, not as validation logic.

---

## API Integration Notes

Server state is managed exclusively via **TanStack Query**.

Patterns:
- `useQuery` for fetching document status and interpretations.
- `useMutation` for:
  - persisting field edits,
  - marking documents as reviewed.
- query invalidation is used to keep UI state consistent after edits.

No client-side caching logic is duplicated manually.

---

## Suggested Implementation Order

This order is advisory and intended to reduce risk:

1. Scaffold frontend and basic layout.
2. Implement API wiring with mocked data.
3. Build review UI shell (PDF + fields).
4. Integrate real backend data.
5. Add editing and persistence.
6. Add PDF page navigation.
7. Add snippet-based highlight.
8. Polish transitions, skeletons, and dark mode.

---

## Explicit Non-Goals (MVP)

The following are intentionally out of scope:

- exact PDF coordinate highlighting,
- historical reprocessing in the UI,
- advanced annotation or markup tools,
- frontend-driven inference or automation.

These constraints preserve clarity and reduce implementation risk.
