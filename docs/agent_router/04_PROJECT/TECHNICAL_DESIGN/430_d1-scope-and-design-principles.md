# D1. Scope and Design Principles

This is a deliberately small contract, **not a full medical ontology**.

- **Assistive, not authoritative**: outputs are explainable and editable.
- **Non-blocking**: confidence and governance never block veterinarians.
- **Run-scoped & append-only**: nothing is overwritten; every interpretation belongs to a processing run.
- **Approximate evidence**: page + snippet; no PDF coordinates in v0.
- **Flat structure (v0)**: optimize for flexibility and speed, not completeness.
