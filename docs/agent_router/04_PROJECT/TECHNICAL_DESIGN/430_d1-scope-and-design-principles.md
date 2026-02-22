# D1. Scope and Design Principles

This is a deliberately small contract, **not a full medical ontology**.

- **Assistive, not authoritative**: outputs are explainable and editable.
- **Non-blocking**: confidence and governance never block veterinarians.
- **Run-scoped & append-only**: nothing is overwritten; every interpretation belongs to a processing run.
- **Approximate evidence**: page + snippet; no PDF coordinates in legacy flat contract.
- **Flat structure (legacy flat contract)**: optimize for flexibility and speed, not completeness.

Note (materialization boundary):
- Machine interpretation payloads may be partial with respect to Global Schema.
- Backend contracts here define valid structured payload shape; they do not require backend-side full-schema backfilling.
- UI rendering materializes and displays the full Global Schema, including empty values for missing keys.
