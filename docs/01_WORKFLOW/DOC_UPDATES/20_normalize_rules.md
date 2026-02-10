# Normalization Pass

Apply this pass to each changed documentation file.

## Steps
1) Classify each change:
   - R = rule change (affects behavior or process)
   - C = clarification (no behavior change)
   - N = navigation, structure, or links
2) For each R:
   - determine the single owner module (atomic module) where the rule must live,
   - update or create that module (source of truth),
   - update `docs/agent_router/00_RULES_INDEX.md` with the rule id + owner module.
3) Update routing only if needed:
   - update `docs/agent_router/00_AUTHORITY.md` if a new intent/module is added or routing changes.
4) Ensure no drift:
   - no duplicated rules across modules,
   - reference docs may link to modules; modules should not depend on reference docs for execution.
5) Run verification: `30_checklist.md`.
