# Verification Checklist

## Checklist
- Links are not broken.
- Markdown fences are balanced.
- Authority file remains small and not a giant list.
- Modules remain small and atomic.
- No duplicated rules across modules.
- Discovery considered untracked/new and renamed docs (`git status --porcelain` + `git diff --name-status`).
- All R changes are propagated to owner modules, or an explicit blocker gap is recorded.
- Normalization ran once at task end (no loop).
- No unresolved propagation gaps remain unless explicitly approved as blockers.

## Outputs to report
- Normalized docs list.
- Owner modules updated or created.
- Rules index entries added/updated.
- Routing changes (if any).
- `DOC_UPDATES Summary` header.
- Docs processed table (Source doc, Diff inspected, Classification, Owner module(s), Files modified).
- `Propagation gaps` section (`None` or numbered items with Source, Reason, Suggested action).
