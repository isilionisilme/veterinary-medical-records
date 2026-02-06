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

This document exists solely to clarify:
- frontend technology choices,
- architectural decisions,
- and implementation strategies for complex UI requirements.

---

## Frontend Stack

The frontend is implemented using:

- **React + TypeScript (Vite)**  
  Chosen to explicitly satisfy the React frontend requirement while keeping setup fast and standard.

- **Tailwind CSS**  
  Used for styling, layout, responsiveness, and dark mode support with minimal custom CSS.

- **shadcn/ui (Radix UI)**  
  Provides accessible, composable UI primitives suitable for review-heavy interfaces.

- **TanStack Query**  
  Used for server state management (loading, error, invalidation) without introducing global client state complexity.

- **Lucide React**  
  Lightweight and consistent iconography.

- **Framer Motion (minimal usage)**  
  Used only for subtle transitions (e.g. skeleton → content), never for core logic.

- **PDF.js (`pdfjs-dist`)**  
  Used to render PDFs and support evidence-based review and highlighting.

---

## Project Structure

The repository uses a single repo with explicit separation:

- `/frontend` contains all React code.
- `/backend` remains the FastAPI application.
- `/docs` contains all design, plan, and guideline documents.

The frontend is built and served independently but lives in the same repository.

---

## Key Implementation Decisions

## PDF Review and Evidence Rendering

Document review is implemented using **evidence-based navigation**, not precise spatial annotation.

For each structured field, the backend provides (when available):
- a page number,
- a text snippet representing the origin of the value.

Frontend behaviour:
- when a field is selected, the PDF viewer navigates to the referenced page,
- the snippet is displayed as explicit evidence,
- the review flow remains usable even if highlighting fails.

This ensures:
- traceability,
- explainability,
- and zero blocking of the review experience.

---

## Continuous Scroll Preview

The document preview renders all PDF pages in a single vertical scroll so users
can read continuously without manual page switching.

Navigation buttons remain available:
- **Next** scrolls to the top of the next page in the continuous stack.
- **Previous** scrolls to the top of the previous page.

The viewer tracks the active page based on scroll position, keeping the page
index in sync with what is visible.

---

## Highlight Strategy (Progressive Enhancement)

Text highlighting inside the PDF is implemented as **progressive enhancement**, never as a dependency for usability.

Implementation approach:
- render the PDF using PDF.js,
- use the text layer to search for the provided snippet on the target page,
- highlight the closest or first matching occurrence.

If matching fails:
- no highlight is shown,
- page navigation and snippet evidence remain visible,
- the UI does not attempt to fake precision.

Bounding boxes and exact coordinates are deliberately excluded from MVP.

---

## Confidence Rendering

Confidence values are rendered as **visual attention signals**, not as control mechanisms.

Frontend representation:
- qualitative signal first (e.g. color or emphasis),
- numeric confidence value visible inline or via tooltip.

The frontend must treat confidence as:
- non-blocking,
- non-authoritative,
- and purely assistive.

No frontend logic may interpret confidence as correctness or validation.

---

## API Integration

Server state is managed exclusively via **TanStack Query**.

Patterns:
- `useQuery` for fetching:
  - document lists,
  - document status,
  - document interpretations.
- `useMutation` for:
  - persisting field edits,
  - marking documents as reviewed.
- query invalidation is used to keep UI state consistent after mutations.

No custom caching or duplication of server state logic is introduced.

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

## Installation Notes (for Codex)

The frontend must install and configure the following dependencies:

```bash
npm install react react-dom
npm install -D typescript @types/react @types/react-dom
npm install tailwindcss postcss autoprefixer
npm install @tanstack/react-query
npm install lucide-react
npm install framer-motion
npm install pdfjs-dist

---

## Explicit Non-Goals (MVP)

The following are intentionally out of scope:

- exact PDF coordinate highlighting,
- historical reprocessing in the UI,
- advanced annotation or markup tools,
- frontend-driven inference or automation.

These constraints preserve clarity and reduce implementation risk.
