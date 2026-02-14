# Extraction Iteration Log

## 2026-02-14 — Iteration 4: Missing-candidate observability + backend microchip heuristic
### Objective
- Separate missing fields with candidates vs without candidates.
- Improve `microchip_id` candidate quality (avoid owner/address text, surface digit candidates near chip labels).

### Evidence used
- Docs: `fb322034-e8eb-4c5b-b235-056bbdc6b7f4`, `e05bef44-79d9-4c36-a8f4-490cf6d87473`, `daeaa6fd-c367-48e5-863b-846c5451dda1`, `043fa0d1-8d39-48fa-89c0-09a300e838cc`, `c716510a-5af2-44cb-ae86-30cce443f4ce`.
- Summary highlights (before):
  - `MOST_MISSING`: frequently `vet_name`, `vaccinations`, `symptoms`, `owner_name`, `owner_id`, `reason_for_visit`.
  - `MOST_REJECTED`: `microchip_id` with top1 owner/address text; `weight` with top1 `0`; dates with top1 `08/12/19`, `05/06/20`, `04/10/19`.

### Changes
- Added summary fields: `has_candidates`, `missing_with_candidates_count`, `missing_without_candidates_count`, `avg_top1_conf`, `top_key_tokens`.
- Added document-level counters: `missing_fields_with_candidates`, `missing_fields_without_candidates`.
- Added backend microchip heuristic candidate finder near keywords (`microchip`, `chip`, `nº chip`) and digits-only extraction.
- Prioritized digit-like microchip candidates during candidate sorting.

### Fields affected
- `microchip_id`
- Summary observability for all missing fields

### Before/After evidence
- Before (summary, historical window): `microchip_id` appears in `MOST_REJECTED` with owner/address top1 samples.
- After:
  - `limit=20`: historical rejects still visible.
  - `limit=1`: latest run confirms `microchip_id` drops from `MOST_REJECTED` where heuristic candidate is present.
- New summary output now reports missing split (`with_candidates` vs `without_candidates`).

### How to reproduce / verify
- Endpoint:
  - `GET /debug/extraction-runs/{documentId}/summary?limit=20`
  - `GET /debug/extraction-runs/{documentId}/summary?limit=1`
- Focus checks:
  - `microchip_id` in `MOST_REJECTED` for `limit=1`
  - `missing_fields_with_candidates` vs `missing_fields_without_candidates`

### Open questions / next candidates
- High-frequency missing fields still mostly no-candidate (`vet_name`, `owner_name`, `owner_id`, `symptoms`, `vaccinations`, `reason_for_visit`).
- Next ROI step is candidate generation/mapping for those fields (not validator-only).

---

## 2026-02-14 — Iteration 3: Next reject-prone date fixes
### Objective
- Fix additional reject-prone date fields with semantically correct `top1`.

### Evidence used
- `MOST_REJECTED` showed date-like values:
  - `document_date`: `04/10/19`
  - `discharge_date`: `05/06/20`

### Changes
- Extended date validation to accept year-first separators (`YYYY/MM/DD`, `YYYY.MM.DD`) and normalize to ISO.
- Added targeted tests for `document_date` and `discharge_date`.

### Fields affected
- `document_date`
- `discharge_date`

### Before/After evidence
- Before triage snippet:
  - `discharge_date` rejected (`invalid-date`) top1 `05/06/20`
  - `document_date` rejected (`invalid-date`) top1 `04/10/19`
- After triage snippet:
  - both moved to accepted (`2020-06-05`, `2019-10-04`).

### How to reproduce / verify
- Run extraction and compare summary/triage.
- Validate with `limit=1` to isolate latest run effect.

### Open questions / next candidates
- Continue with reject-prone fields with semantically correct top1.

---

## 2026-02-13 — Iteration 2: Summary endpoint + ROI date fixes
### Objective
- Add aggregate evidence endpoint and use it to select top ROI fixes.

### Evidence used
- `/summary` over recent runs identified reject-prone date fields with valid date-like top1 samples.

### Changes
- Added `GET /debug/extraction-runs/{documentId}/summary?limit=...`.
- Aggregated: missing/rejected/accepted counts + top1 sample + avg confidence + suspicious accepted counts.
- Applied minimal date parsing improvements (2-digit year handling in `visit_date`/`discharge_date`).

### Fields affected
- `visit_date`
- `discharge_date`

### Before/After evidence
- Rejected date entries reduced in latest-run checks.

### How to reproduce / verify
- `GET /debug/extraction-runs/{documentId}/summary?limit=20`
- `GET /debug/extraction-runs/{documentId}/summary?limit=1`

### Open questions / next candidates
- Distinguish missing with/without candidates (implemented next iteration).

---

## 2026-02-13 — Iteration 1: Observability baseline + first guardrails
### Objective
- Build extraction observability baseline and apply first minimal field guardrails.

### Evidence used
- Per-field triage logs and persisted snapshots across repeated runs.

### Changes
- Added validation/normalization layer to drop obviously wrong values.
- Added `extractionDebug=1` gated debug collection.
- Persisted extraction snapshots to `.local/extraction_runs/<documentId>.json` (ring buffer 20 runs).
- Added diff-vs-previous logging on snapshot persistence.
- Added per-field `topCandidates` (max 3).
- Added triage logs with `MISSING`, `REJECTED`, `SUSPICIOUS_ACCEPTED` and top1 visibility.
- Minimal field guardrails:
  - `microchip_id`: digits/length constraints; trim trailing non-digits after valid digit prefix.
  - `weight`: reject `0`, accept plausible range with optional unit, normalize to `X kg`.
  - dates: standard formats and ISO normalization with 2-digit year policy.

### Fields affected
- `microchip_id`, `weight`, `visit_date`, `discharge_date`, `document_date`

### Before/After evidence
- Example triage transitions showed reject→accept for fixed fields, while preserving “reject garbage” behavior.

### How to reproduce / verify
- Persist snapshots via debug endpoint and inspect logs.
- Compare summary across runs.

### Open questions / next candidates
- Frequent missing fields still need candidate generation work (not only validators).

---

## Historical milestones captured
1. Minimal validation/normalization layer introduced to prevent obvious garbage values.
2. `extractionDebug=1` gated debug collection added.
3. Backend snapshot persistence added (`.local/extraction_runs/<documentId>.json`, last 20).
4. Automatic diff-vs-previous run logging added.
5. `topCandidates` (max 3) added to snapshots.
6. `/summary` endpoint added for aggregate triage.
7. Summary extended to split missing with candidates vs no candidates.