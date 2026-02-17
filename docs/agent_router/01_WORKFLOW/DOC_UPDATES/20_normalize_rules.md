# Normalization Pass

Apply this pass to each changed documentation file.

## Steps
1) Inspect change evidence first:
   - Must inspect local working tree (staged + unstaged), unpushed commits (`@{upstream}..HEAD`), and branch-vs-base diff (`<base_ref>...HEAD`).
   - For file-level inspection, evaluate each target doc across those same three evidence sources.
   - If git evidence is unavailable, use a user-provided snippet with file path and section context.
2) Classify each change:
   - R = rule change (affects behavior or process)
   - C = clarification (no behavior change)
   - N = navigation, structure, or links
   - Rule change / Clarification / Navigation naming remains valid in summaries.
   - Mixed classification is allowed within one file.
3) For each R:
   - determine the single owner module (atomic module) where the rule must live,
   - update/create owner module before summary output,
   - update or create that module (source of truth) before emitting the summary,
   - update `docs/agent_router/00_RULES_INDEX.md` only if a new rule id is introduced or the owner module changes.
4) Update `docs/agent_router/00_AUTHORITY.md` only if routing/intent changes.
5) Ensure no drift:
   - no duplicated rules across modules,
   - reference docs may link to modules; modules should not depend on reference docs for execution.
6) Run verification: `30_checklist.md`.
7) Validate doc/test sync impact:
   - Load `docs/agent_router/01_WORKFLOW/DOC_UPDATES/test_impact_map.json`.
   - For each changed doc matching a map rule, update at least one mapped test/guard file.
   - If no mapped file should change, record it as an explicit propagation gap with rationale.
8) Validate source-to-router parity for mapped project docs:
   - Load `docs/agent_router/01_WORKFLOW/DOC_UPDATES/router_parity_map.json`.
   - If a mapped `source_doc` changed, every mapped router module must contain all configured required terms.
   - Any missing required term is a blocking parity failure, not a soft gap.
9) Emit required summary (`00_entry.md`):
   - include docs table and propagation gaps.
   - include evidence source used per processed doc (`local|unpushed|branch-vs-base|mixed|snippet`).
   - include source-to-router parity status (`Pass` or `Fail`).
   - If an R change was detected but no owner module was updated and no blocker reason exists, treat it as failure.
   - If Trigger A/B/C ran without inspecting all three git evidence sources and no snippet fallback was used, treat it as failure.
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
