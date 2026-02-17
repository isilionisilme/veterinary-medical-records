# Verification Checklist

## Checklist
- Links are not broken.
- Markdown fences are balanced.
- Authority file remains small and not a giant list.
- Modules remain small and atomic.
- No duplicated rules across modules.
- Discovery considered untracked/new and renamed docs (`git status --porcelain` + `git diff --name-status`).
- Discovery covered unpushed commits (`@{upstream}..HEAD`) and branch-vs-base diff (`<base_ref>...HEAD`).
- All R changes are propagated to owner modules, or an explicit blocker gap is recorded.
- For mapped docs, at least one related test/guard file was updated (per `test_impact_map.json`) or an explicit blocker gap is recorded.
- For mapped project docs, source-to-router parity passed (per `router_parity_map.json` required terms).
- Normalization ran once at task end (no loop).
- No unresolved propagation gaps remain unless explicitly approved as blockers.

## Outputs to report
- Normalized docs list.
- Owner modules updated or created.
- Related tests/guards updated for mapped docs (or blocker note).
- Evidence source per processed doc (`local|unpushed|branch-vs-base|mixed|snippet`).
- Source-to-router parity status for mapped docs (`Pass`/`Fail`).
- Rules index entries added/updated.
- Routing changes (if any).
- `DOC_UPDATES Summary` header.
- Docs processed table (Source doc, Evidence source, Diff inspected, Classification, Owner module(s), Related tests/guards updated, Source→Router parity, Files modified).
- `Propagation gaps` section (`None` or numbered items with Source, Reason, Suggested action).
