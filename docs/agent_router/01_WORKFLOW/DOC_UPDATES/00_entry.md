# Doc Updates (Hub)

Use this hub when the user indicates documentation was updated (any language or paraphrase) or asks to update a legacy reference doc.

## Trigger intent
If the user indicates documentation was updated, this workflow applies.
Examples (not exhaustive): “He actualizado documentación”, “He actualizado el documento X”, “I have updated the docs”, “I updated README.md”, “Docs changed; please sync/normalize”, “I made documentation changes”.
Treat paraphrases and other languages as the same intent.

## Triggers
- A: user specifies document(s) → run Normalization Pass on those docs.
- B: user does not specify docs → detect changed docs, list them, then run Normalization Pass on each.
- C: user asks to update a legacy/reference doc → update it, then run Normalization Pass (same as Trigger A).

## What to do now
0) File discovery + diff inspection (deterministic):
   - Always inspect all evidence sources in this order and merge results:
     1. Local working tree (staged + unstaged): `git status --porcelain`, `git diff --name-status`, `git diff --cached --name-status`.
     2. Commits not pushed to upstream: `git log --oneline @{upstream}..HEAD` and `git diff --name-status @{upstream}..HEAD`.
     3. Current branch delta vs PR base (including commits already pushed on this branch): `git diff --name-status <base_ref>...HEAD`.
   - If user did not specify files: discover changed docs from the union of the three evidence sources, list them, then process each file.
   - If user specified files: validate each path exists, inspect per-file hunks with `git diff -- <path>`, then inspect each file across the same three evidence sources before classifying R/C/N.
1) If the target is a legacy/reference doc, follow `10_reference_first.md`.
2) Run the Normalization Pass for each changed doc: `20_normalize_rules.md`.
3) Enforce doc/test sync using `docs/agent_router/01_WORKFLOW/DOC_UPDATES/test_impact_map.json`:
   - If a changed doc matches a map rule, update at least one mapped test/guard file in the same change.
   - If no mapped test/guard applies, record a propagation gap with reason.
4) Enforce source-to-router parity using `docs/agent_router/01_WORKFLOW/DOC_UPDATES/router_parity_map.json`:
   - If a mapped `source_doc` changed, all required terms must be present in all mapped router modules.
   - Missing required terms are blocking parity failures.
5) If git discovery/diff inspection is not possible, ask the user for file paths and a snippet/diff. Do not load large reference docs by default.
6) Finish with the verification checklist: `30_checklist.md`.
7) Propagation rule: for any R change, update the owner module before emitting the summary. Gaps are only allowed when the owner is ambiguous or the diff/snippet is unavailable.
8) Anti-loop rule: run normalization once at task end; do not re-run for changes produced by normalization.

## Use cases

### Use case D — No repo access / no git diff available
- Ask the user for file paths and a snippet/diff.
- If snippet lacks file path or section context, ask for that minimum input before classification.
- Proceed with normalization using the snippet.
- Mark internally as “diff via snippet.”

### Use case E — Change rule by RULE_ID
- If the user says “Change rule <RULE_ID> …”:
  - Look up `<RULE_ID>` in `docs/agent_router/00_RULES_INDEX.md`.
  - If missing/invalid, STOP and ask for a valid rule id or owner path.
  - Open the owner module and apply the change there (source of truth).
  - Update reference docs only if needed to keep them aligned.

## Required output (always)
After DOC_UPDATES completes (Triggers A/B/C/D/E), print:
1) Header: `DOC_UPDATES Summary`
2) Docs processed table:

| Source doc (inspected) | Diff inspected | Evidence source | Classification | Owner module(s) updated | Related tests/guards updated | Source→Router parity | Files modified |
|---|---|---:|---|---|---|---|---|
| docs/... | local / unpushed / branch-vs-base / mixed / snippet | Yes/No | Rule change / Clarification / Navigation | docs/... (comma-separated) | path/to/test_or_guard.py (comma-separated) | Pass/Fail/Not mapped | docs/... (comma-separated) |

Rules:
- `Diff inspected` must be `Yes` or `No` (`No` only when snippet was used instead of git diff).
- For mixed changes in one file, use comma-separated classifications.
- `Evidence source` must reflect where the change was found (`mixed` if multiple sources apply).

3) Propagation gaps section:
**Propagation gaps:** None
OR
**Propagation gaps:**
1) <gap title>
   - Source: <doc + section>
   - Reason: <why not propagated>
   - Suggested action: <what to do next>

Definition of a gap:
- A Rule change with no owner module update, OR
- A Rule change where owner is ambiguous, OR
- A changed doc with no inspected diff and no usable snippet, OR
- Trigger A/B/C with no evidence inspected across local + unpushed + branch-vs-base sources.

If gaps exist, instruct the user:
- “If you want, say: **show me the unpropagated changes**”

Follow-up behavior:
- If the user says “show me the unpropagated changes” or “muestrame los cambios no propagados”, reprint gaps and include exact diff hunk/snippet plus owner candidates.
