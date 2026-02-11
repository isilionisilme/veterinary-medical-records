# Reference-First Edits

Legacy or human-reference docs can be edited, but operational rules must live in atomic modules.

## Steps
1) Update the reference doc to reflect the desired outcome.
2) Extract any operational rule changes and move them into the correct atomic module.
3) Keep the reference doc concise; link to the owning module instead of duplicating rules.
4) Run the Normalization Pass: `20_normalize_rules.md`.
