# Review UI Rendering Rules (Global Schema v0 Template)

1) Always render the full Global Schema v0 template
- The UI MUST render the complete Global Schema v0 in fixed order and by sections, regardless of how many fields the extractor produced.
- Extracted keys outside Global Schema v0 MUST appear in a separate section: **Other extracted fields**.

2) Missing vs loading (deterministic)
- While structured data is loading, show a clear loading state (skeleton/spinner) and do not show missing placeholders yet.
- Once the run is ready, any absent/non-extracted value must render an explicit placeholder.

3) Placeholders must be explicit and consistent
- Use a consistent empty placeholder (for example `-`) and optionally a small hint such as `No encontrado`.
- Do not leave blank space without a placeholder.

4) Repeatable fields render as lists
- Repeatable fields MUST render as lists.
- If empty, render an explicit list-empty state (`Sin elementos` or `-`) distinct from scalar placeholders.

5) No governance terminology in veterinarian UX
- The veterinarian UI copy must not expose terms such as `pending_review`, `governance`, or `reviewer`.
