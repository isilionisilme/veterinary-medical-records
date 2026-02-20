# D2. Versioning

- `schema_version` is a string. Current value: `"v0"`.
- Future versions must be explicit and intentional.
- Additive changes are preferred; breaking changes require a new version.
- Version `"v1"` introduces deterministic visit grouping via a `visits[]` container while preserving `StructuredField` semantics. v0 remains supported.
