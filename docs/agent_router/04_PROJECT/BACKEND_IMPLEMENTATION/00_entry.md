# BACKEND_IMPLEMENTATION — Modules

This content was split into smaller modules for token-optimized assistant reads.

Start with `AGENTS.md` (repo root) and `docs/agent_router/00_AUTHORITY.md` for intent routing.

## Index
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/10_preamble.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/20_purpose.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/30_scope.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/40_running-the-backend.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/50_backend-architecture.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/60_persistence-model-sqlite.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/70_filesystem-storage.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/80_processing-execution-model-in-process.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/90_step-model.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/100_structured-interpretation-schema.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/110_api-implementation.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/120_text-extraction-language-detection.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/130_logging-structured.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/140_testing-expectations.md`
- `docs/agent_router/04_PROJECT/BACKEND_IMPLEMENTATION/150_stop-rule.md`

## Propagated updates
- Review-event contracts (`mark_reviewed`, `unmark_reviewed`, `field_edited`, `field_reassigned`) are authoritative in this module set.
- Calibration-store contracts for (`context_key`, `field_key`, `mapping_id`) ownership are maintained under backend implementation modules.
- Confidence-calibration observability requirements (old/new confidence and policy-state transitions) are owned in backend implementation modules.
- Naming alignment propagated: canonical layer label is `infra (infrastructure)` and must match code location under `backend/app/infra/`.
