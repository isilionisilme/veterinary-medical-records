# D2. Versioning

- `schema_contract` is a string. Current value: `"legacy-flat"`.
- Future versions must be explicit and intentional.
- Additive changes are preferred; breaking changes require a new version.
- The canonical visit-grouped contract introduces deterministic visit grouping via a `visits[]` container while preserving `StructuredField` semantics. legacy flat remains supported.
