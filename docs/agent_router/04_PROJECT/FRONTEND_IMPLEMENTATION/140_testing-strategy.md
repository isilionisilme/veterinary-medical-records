# Testing Strategy

Use Vitest + React Testing Library (already used by the repository frontend).

Minimum coverage:
- Continuous scroll: Next/Previous navigation scrolls to the correct page container.
- Active page tracking: scrolling updates the active page label deterministically.
- Progressive enhancement: highlight failures do not block review (no crashes; snippet still visible).
- Error states: UI branches on `error_code` and `details.reason` only (e.g., `CONFLICT` with `NO_COMPLETED_RUN`).

---
