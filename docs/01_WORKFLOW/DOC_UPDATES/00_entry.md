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
   - If user did not specify files: discover changed docs via `git status --porcelain` and/or `git diff --name-only`, list them, then process each file.
   - If user specified files: validate each path exists, then inspect `git diff -- <path>` (or a provided snippet) before classifying R/C/N.
1) If the target is a legacy/reference doc, follow `10_reference_first.md`.
2) Run the Normalization Pass for each changed doc: `20_normalize_rules.md`.
3) If git discovery/diff inspection is not possible, ask the user for file paths and a snippet/diff. Do not load large reference docs by default.
4) Finish with the verification checklist: `30_checklist.md`.
5) Propagation rule: for any R change, update the owner module before emitting the summary. Gaps are only allowed when the owner is ambiguous or the diff/snippet is unavailable.
6) Anti-loop rule: run normalization once at task end; do not re-run for changes produced by normalization.

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

| Source doc (inspected) | Diff inspected | Classification | Owner module(s) updated | Files modified |
|---|---:|---|---|---|
| docs/... | Yes/No | Rule change / Clarification / Navigation | docs/... (comma-separated) | docs/... (comma-separated) |

Rules:
- `Diff inspected` must be `Yes` or `No` (`No` only when snippet was used instead of git diff).
- For mixed changes in one file, use comma-separated classifications.

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
- A changed doc with no inspected diff and no usable snippet.

If gaps exist, instruct the user:
- “If you want, say: **show me the unpropagated changes**”

Follow-up behavior:
- If the user says “show me the unpropagated changes” or “muestrame los cambios no propagados”, reprint gaps and include exact diff hunk/snippet plus owner candidates.
