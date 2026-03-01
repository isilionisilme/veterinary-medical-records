# UX_DESIGN — Modules

This content was split into smaller modules for token-optimized assistant reads.

Start with `AGENTS.md` (repo root) and `docs/agent_router/00_AUTHORITY.md` for intent routing.

## Index
- `docs/agent_router/04_PROJECT/UX_DESIGN/10_preamble.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/20_1-user-roles-ux-goals.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/30_2-confidence-ux-definition.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/40_3-confidence-visibility.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/50_4-veterinarian-review-flow.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/55_review-ui-rendering-rules-global-schema-template.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/60_5-structural-effects-ux-consequences-only.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/70_6-sensitive-changes-ux-rules.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/80_7-reviewer-interaction-model.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/90_8-separation-of-responsibilities-non-negotiable.md`
- `docs/agent_router/04_PROJECT/UX_DESIGN/100_9-final-ux-rule.md`

## Propagated updates
- UX confidence semantics distinguish `candidate_confidence` (diagnostic) from `field_mapping_confidence` (veterinarian-facing signal).
- Reviewed-toggle behavior and implicit unchanged-field weak-positive signal contracts are reflected in UX owner modules.
- Medical Record panel rendering remains contract-driven (`medical_record_view`, `field_slots`, `visits[]`, `other_fields[]`) with no UI-side heuristics.
