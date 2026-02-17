# Verification Checklist

## Checklist
- Links are not broken.
- Markdown fences are balanced.
- Authority file remains small and not a giant list.
- Modules remain small and atomic.
- No duplicated rules across modules.
- Discovery considered untracked/new and renamed docs (`git status --porcelain` + `git diff --name-status`).
- Discovery covered unpushed commits (`@{upstream}..HEAD`) and branch-vs-base diff (`<base_ref>...HEAD`).
- Every changed doc matched at least one `test_impact_map.json` rule (`fail_on_unmapped_docs: true`).
- Owner propagation mapping is source-specific (1:1 source doc -> owner path), not only family-level wildcard coverage.
- All R changes are propagated to owner modules, or an explicit blocker gap is recorded.
- For any changed doc matching an `owner_any` rule, at least one mapped owner file was updated (or blocker gap recorded).
- For mapped docs, at least one related test/guard file was updated (per `test_impact_map.json`) or an explicit blocker gap is recorded.
- For mapped project docs, source-to-router parity passed (per `router_parity_map.json` required terms).
- Every changed owner-backed source doc matched at least one `router_parity_map.json` rule (`fail_on_unmapped_sources: true`).
- Normalization ran once at task end (no loop).
- No unresolved propagation gaps remain unless explicitly approved as blockers.

## Outputs to report
- Normalized docs list.
- Owner modules updated or created.
- Related tests/guards updated for mapped docs (or blocker note).
- Owner file updates for docs matching `owner_any` rules (or blocker note).
- Evidence source per processed doc (`local|unpushed|branch-vs-base|mixed|snippet`).
- Source-to-router parity status for mapped docs (`Pass`/`Fail`).
- Rules index entries added/updated.
- Routing changes (if any).
- `DOC_UPDATES Summary` header.
- Docs processed table (Source doc, Evidence source, Diff inspected, Classification, Owner module(s), Related tests/guards updated, Source→Router parity, Files modified).
- `Propagation gaps` section (`None` or numbered items with Source, Reason, Suggested action).
