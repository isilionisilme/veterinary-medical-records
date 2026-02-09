# PDF Review and Evidence Rendering

Document review is implemented using **evidence-based navigation**, not precise spatial annotation.

The frontend must consume the "evidence" fields exactly as defined by backend contracts
in the authoritative documentation (see [`docs/README.md`](../README.md)) (do not invent fields or semantics here).

Frontend behavior:
- when a field is selected, the PDF viewer navigates to the referenced page,
- the snippet is displayed as explicit evidence,
- the review flow remains usable even if highlighting fails.

This ensures:
- traceability,
- explainability,
- and zero blocking of the review experience.

---
