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
1) If Trigger B, identify changed docs (prefer `git diff --name-only` or `git status`) and list them.
2) If the target is a legacy/reference doc, follow `10_reference_first.md`.
3) Run the Normalization Pass for each changed doc: `20_normalize_rules.md`.
4) If intent is detected but files cannot be discovered, ask the user to name the doc paths or paste the changed section/diff. Do not load large reference docs by default.
5) Finish with the verification checklist: `30_checklist.md`.
