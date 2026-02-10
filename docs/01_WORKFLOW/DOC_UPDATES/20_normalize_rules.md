# Normalization Pass

Apply this pass to each changed documentation file.

## Steps
1) Inspect change evidence first:
   - Prefer `git diff -- <path>`.
   - If unavailable, use a user-provided snippet with file path and section context.
2) Classify each change:
   - Rule change (affects behavior or process)
   - Clarification (no behavior change)
   - Navigation (structure or links)
   - Mixed classification is allowed within one file.
3) For each Rule change:
   - determine one owner module (atomic source of truth),
   - update/create owner module before summary output,
   - update `docs/agent_router/00_RULES_INDEX.md` only if:
     - a new rule id is introduced, or
     - owner module changes.
4) Update `docs/agent_router/00_AUTHORITY.md` only if routing/intent changes.
5) Ensure no drift:
   - no duplicated rules across modules,
   - reference docs may link to modules; modules should not depend on reference docs for execution.
6) Run verification: `30_checklist.md`.
7) Emit required summary (`00_entry.md`):
   - include docs table and propagation gaps.
   - if Rule change exists with no propagation and no blocker reason, treat as failure.

## Ambiguity handling
- If multiple owner candidates are plausible, do not auto-pick silently.
- Stop and ask, or record a propagation gap with owner candidates.

## Known mappings
Canonical mapping hints live in `docs/agent_router/00_RULES_INDEX.md` under "Known mapping hints".
Use those hints before escalating ambiguity.

## Drift control
- When a reference doc changes, verify owner modules remain the source of truth.
- If divergence is found, update owner modules first and then align references.
