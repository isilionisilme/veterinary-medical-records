# Extraction Quality Strategy (pre-US-08)

## Why this exists
- We are finishing US-07, but extraction quality is still uneven (missing/wrong fields).
- We do **not** move to US-08 (editable structured fields) until extraction is reliably correct.
- Wrong auto-filled values are riskier than missing values.

## Operating loop
1. **Observability**: persist per-run snapshots and triage logs.
2. **Triage**: rank issues with `/debug/extraction-runs/{documentId}/summary?limit=N` (default `N=20`).
3. **Minimal fix**: apply the smallest safe change (candidate generation, selection, validator, normalizer).
4. **Verify**: compare before/after with logs + summary (`limit=20` for trend, `limit=1` for latest run impact).
5. **Document**: update iteration log + field guardrails.

See also:
- [OBSERVABILITY.md](OBSERVABILITY.md)
- [ITERATIONS.md](ITERATIONS.md)
- [FIELD_GUARDRAILS.md](FIELD_GUARDRAILS.md)
- [ADR-EXTRACTION-0001.md](ADR-EXTRACTION-0001.md)

## Decision rules
- Prefer **rejecting garbage** over filling wrong values.
- Prioritize highest ROI first (frequency × business impact).
- Prioritize reject-prone fields where `top1` is semantically correct (normalization/selection issue).
- Defer “missing with no top1 candidate” until candidate visibility/generation exists.
- Keep fixes minimal; avoid broad refactors and prompt overhauls early.

## Field done criteria
A field is considered improved when:
- Rejected/missing counts decrease in summary trends.
- Latest run (`limit=1`) confirms the improvement.
- Accepted values are correct and evidenced in triage logs/snapshots.
- Guardrails/tests are updated for the touched behavior.

## Current status snapshot (high level)
- Observability-first pipeline is active (snapshots, topCandidates, summary, missing-with/without-candidates split).
- Initial guardrail iterations completed for:
  - `microchip_id`
  - `weight`
  - date fields (`visit_date`, `discharge_date`, `document_date`)
- Frequent missing fields still pending candidate-generation work:
  - `vet_name`, `owner_name`, `owner_id`, `symptoms`, `vaccinations`, `reason_for_visit`

## Default maintenance policy for future runs
For every extraction-fix run:
1. Add/append an entry in [ITERATIONS.md](ITERATIONS.md).
2. Update touched sections in [FIELD_GUARDRAILS.md](FIELD_GUARDRAILS.md).
3. Update [OBSERVABILITY.md](OBSERVABILITY.md) if observability behavior changed.
4. Add/update ADR only if decision logic changes.