# ADR-EXTRACTION-0001: Observability-first, triage-driven, minimal extraction fixes

- Status: Accepted
- Date: 2026-02-14
- Related: [STRATEGY.md](STRATEGY.md)

## Context
- Structured extraction quality is not yet reliable enough for editable-field UX (US-08).
- Current pain includes high missing counts and wrong values in critical fields (example: `microchip_id` receiving owner/address text).
- Early in this phase, we need fast learning cycles with low regression risk.

## Decision
We adopt an **observability-first, triage-driven, minimal-fix** strategy:
1. Capture run-level evidence (snapshots, candidates, triage logs, summary aggregates).
2. Prioritize fields by ROI using real evidence over recent runs.
3. Apply the smallest safe fix per iteration (candidate generation/selection/validation/normalization).
4. Verify with `limit=20` (trend) and `limit=1` (latest-run truth).

Guardrail principle:
- Prefer **rejecting garbage** (or leaving missing) over populating wrong values.

Scope principle:
- Do not jump to US-08 until extraction quality is stable enough on core fields.

## Consequences
### Positive
- Fast feedback loop and measurable progress.
- Reduced risk of silently wrong structured data.
- Easier rollback and attribution per iteration.
- Better alignment with business risk (wrong values > missing values).

### Negative
- Progress appears incremental, not “big bang”.
- Historical windows (`limit=20`) can lag perceived improvement until older runs age out.
- Missing-without-candidate fields remain unresolved until candidate generation work starts.

## Alternatives considered
1. **Jump directly to US-08 editable fields**
   - Rejected: would mask extraction defects and increase manual correction burden.
2. **Large refactor / prompt overhaul first**
   - Rejected initially: higher risk, slower feedback, harder to attribute wins/regressions.
3. **Aggressive auto-fill despite weak confidence**
   - Rejected: unacceptable risk of wrong structured data in veterinary records.