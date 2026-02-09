# Frontend Architecture

The frontend is implemented as a small set of explicit, testable modules.

Suggested structure:

- `/frontend/src/lib/`
  - API client (one fetch wrapper that normalizes errors).
  - Query keys and TanStack Query helpers.
- `/frontend/src/components/`
  - View components (document list, review layout).
  - PDF viewer + evidence navigation helpers.
- `/frontend/src/components/ui/`
  - Small, reusable UI primitives (buttons, badges, panels).

State rules:
- **Server state** (documents, status, review payloads, raw text) lives in TanStack Query only.
- **Local UI state** (selected field, raw text panel open, current active page) lives in the view component(s).
- Avoid introducing a global client-state store.

---
