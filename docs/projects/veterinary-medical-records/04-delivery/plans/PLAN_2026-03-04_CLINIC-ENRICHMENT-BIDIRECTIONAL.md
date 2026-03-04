# Plan: Bidirectional Clinic Enrichment Fallback (`clinic_name` ↔ `clinic_address`)

> **Operational rules:** See [execution-rules.md](../../03-ops/execution-rules.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Rama:** `feat/clinic-enrichment-bidirectional-2026-03-04`
**PR:** #198
**Prerequisito:** `main` estable con tests verdes. PR #196 (golden-loop clinic_address) merged.

## Context

After hardening `clinic_address` OCR extraction (PR #196), a real-world gap remains:
- **docA** (`7f35011c-9377-4407-8a55-6ffd33e3e73b`): `clinic_name = "CENTRO COSTA AZAHAR"`, `clinic_address = None`. The raw text contains **no usable address candidates** — OCR alone cannot fill this field.

The inverse case is also plausible: a document showing an address header but no clinic name.

### Architecture pivot (2026-03-04)

> The original plan used a silent auto-enrichment in the processing pipeline. After user review, this was **rejected** because the user would not know the field was auto-filled. The architecture was changed to **user-initiated on-demand lookup**: when `clinic_address` is empty and `clinic_name` is present, the frontend shows a prompt offering to search the address automatically. The user decides whether to accept, reject, or skip.

## Objective

- When `clinic_address` is empty and `clinic_name` is present, **prompt the user** to search the address on-demand via `POST /clinics/lookup-address`.
- User explicitly accepts or rejects the found address — no silent auto-fill.
- Never overwrite OCR-extracted values.
- Maintain zero regressions in all existing golden, benchmark, and unit tests.

## Scope Boundary (strict)

- **In scope:** clinic catalog module (backend), on-demand API endpoint, frontend enrichment prompt component + hook, unit tests for catalog + enrichment + API, golden regression updates.
- **Out of scope:** fuzzy matching, external geocoder API calls (planned E3-H), other field enrichment, OCR extraction logic changes.

## Commit plan

| # | Commit message | Files touched | Step |
|---|---|---|---|
| C1 | `feat(enrichment): add clinic catalog module with versioned name↔address mapping` | `backend/app/application/clinic_catalog.py` | E1-A |
| C2 | `feat(enrichment): add COVERAGE_CONFIDENCE_ENRICHMENT constant` | `backend/app/application/processing/constants.py` | E1-A |
| C3 | `refactor(enrichment): remove auto-enrichment from field_normalizers` | `backend/app/application/field_normalizers.py` | E3-A |
| C4 | `feat(enrichment): add POST /clinics/lookup-address API endpoint` | `backend/app/api/routes_clinics.py`, `backend/app/api/schemas.py`, `backend/app/api/routes.py` | E3-C |
| C5 | `feat(enrichment): add ClinicAddressEnrichmentPrompt component + hook` | `frontend/src/components/review/ClinicAddressEnrichmentPrompt.tsx`, `frontend/src/hooks/useClinicAddressLookup.ts` | E3-D, E3-E |
| C6 | `feat(enrichment): wire clinic enrichment into review renderers` | `frontend/src/components/review/ReviewFieldRenderers.tsx`, `frontend/src/hooks/useReviewRenderers.ts`, `frontend/src/AppWorkspace.tsx`, `frontend/src/api/documentApi.ts` | E3-F |
| C7 | `test(enrichment): update tests for on-demand enrichment architecture` | `backend/tests/unit/test_clinic_catalog.py`, `test_clinic_enrichment.py`, `test_clinic_lookup_api.py`, `test_golden_extraction_regression.py` | E3-G |

---

## Estado de ejecución

**Leyenda**
- 🔄 auto-chain — ejecutable por Codex
- 🚧 hard-gate — revisión/decisión de usuario (Claude)

### Phase 1 — Implementation

- [x] E1-A 🔄 — **Create clinic catalog module + enrichment confidence constant** ✅ DONE
- [x] E1-B 🔄 — **Wire enrichment into `normalize_canonical_fields`** ✅ DONE → REVERTED (see Phase 3)
- [x] E1-C 🔄 — **Add unit tests for catalog + enrichment** ✅ DONE → UPDATED (see Phase 3)
- [x] E1-D 🔄 — **Update golden regression for docA enrichment** ✅ DONE → UPDATED (see Phase 3)

### Phase 2 — Validation and closure

- [x] E2-A 🔄 — **Run full test suite and document results** ✅ 373 passed, 0 failed
- [x] E2-B 🚧 — **Hard-gate: user validation with real examples and go/no-go decision.** (Claude Opus 4.6) — ✅ User approved. "No" button removed, prompt text updated per feedback.

### Phase 3 — Architecture pivot: user-initiated enrichment (2026-03-04)

> **Decision:** User rejected silent auto-enrichment. When `clinic_address` is empty
> and `clinic_name` is present, the system must inform the user and offer to search
> the address on-demand. If the user declines, the field stays empty.

- [x] E3-A — **Remove auto-enrichment from `field_normalizers.py`:** removed `_enrich_clinic_name_and_address_pair()` and all imports from `clinic_catalog`. The processing pipeline no longer silently fills missing fields. (Claude Opus 4.6)
- [x] E3-B — **Refactor `clinic_catalog.py` to return structured results:** `lookup_address_by_name()` now returns `{ found, address, source, catalog_version }` dict for API consumption. (Claude Opus 4.6)
- [x] E3-C — **Add `POST /clinics/lookup-address` API endpoint:** new `routes_clinics.py` with on-demand lookup endpoint. Schema: `ClinicAddressLookupRequest/Response` in `schemas.py`. (Claude Opus 4.6)
- [x] E3-D — **Frontend: add `ClinicAddressEnrichmentPrompt` component:** inline banner below empty `clinic_address` field when `clinic_name` is present. States: idle → "¿Buscar automáticamente?" / loading / found (accept/discard) / not-found. (Claude Opus 4.6)
- [x] E3-E — **Frontend: add `useClinicAddressLookup` hook:** manages lookup lifecycle, calls API, applies result via `onSubmitInterpretationChanges`. (Claude Opus 4.6)
- [x] E3-F — **Frontend: wire enrichment into `ReviewFieldRenderers` → `useReviewRenderers` → `AppWorkspace`:** added `clinicEnrichment` context prop through the rendering pipeline. (Claude Opus 4.6)
- [x] E3-G — **Update tests:** catalog tests adapted to new dict API, enrichment tests now verify NO auto-enrichment, golden regression expects `clinic_address=None` for docA, new `test_clinic_lookup_api.py` with 5 endpoint tests. **373 unit tests pass.** (Claude Opus 4.6)
- [ ] E3-H — **Future: replace catalog with online geocoder API (Nominatim / Google Places).** The endpoint currently uses the local catalog; switching to an online resolver is a drop-in change in `clinic_catalog.py`. (Pending)

### Avance local (Codex, 2026-03-04)

- E1-A implementado en código: módulo `clinic_catalog.py` + constante `COVERAGE_CONFIDENCE_ENRICHMENT`.
- E1-B implementado: enriquecimiento bidireccional con evidencia (`source`, `catalog_version`, `confidence`).
- E1-C ejecutado: `test_clinic_catalog.py` + `test_clinic_enrichment.py` → **14 passed**.
- E1-D ejecutado: `test_golden_extraction_regression.py` → **8 passed** (incluye docA `clinic_address` enriquecido).
- E2-A validación ejecutada: benchmarks `clinic_address` (**19 passed**), `clinic_name` (**12 passed**) y `backend/tests/unit/` (**369 passed**).

### Avance local (Claude Opus 4.6, 2026-03-04)

- **Pivote de arquitectura:** eliminado el enriquecimiento automático silencioso.
- E3-A..E3-G implementados: endpoint API on-demand, componente frontend interactivo, tests actualizados.
- Validación: **373 unit tests passed**, 0 regressions. Frontend sin errores de tipos en archivos de integración.

---

## Acceptance criteria (updated after Phase 3)

1. ~~Missing `clinic_address` is completed from catalog automatically~~ → **REPLACED:** When `clinic_address` is empty and `clinic_name` is present, the UI shows an enrichment prompt.
2. User can choose "Buscar" to trigger on-demand address lookup via `POST /clinics/lookup-address`.
3. If a match is found, user sees the address and can accept ("Usar esta dirección") or discard.
5. 0 matches → "No se encontró la dirección de la clínica." message.
6. Existing OCR values are never overwritten (prompt only appears for missing fields).
7. No regression in existing golden tests (8/8), benchmark, and unit suite (373 passed).
8. The lookup endpoint currently uses the local catalog; online geocoder API is a planned enhancement (E3-H).

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| ~~Enrichment location~~ | ~~Inside `normalize_canonical_fields`~~ | ~~Follows species/breed pair precedent~~ → **Superseded in Phase 3** |
| Enrichment location (Phase 3) | On-demand API endpoint `POST /clinics/lookup-address` | User explicitly requests the lookup; no silent pipeline changes |
| User consent | Frontend prompt (`ClinicAddressEnrichmentPrompt`) | User sees the empty field, chooses to search or skip; transparent UX |
| Catalog format | In-code Python list of dicts | Simple, versionable, no external dependency; migrate to online API (E3-H) |
| Match strategy | Exact casefold + strip | No fuzzy matching in v1; reduces false positives to zero |
| ~~Confidence level~~ | ~~`0.40` (`COVERAGE_CONFIDENCE_ENRICHMENT`)~~ | ~~Below fallback for clear provenance~~ → **Not used** (no pipeline evidence needed for on-demand) |
| Ambiguity rule | 0 or >1 matches → `found: false` | Conservative; user sees "No se encontró" message |
| Traceability | API response includes `source` field | Audit trail via API call logs + user-initiated action |

## Risks and limitations

| Risk | Mitigation |
|---|---|
| **Catalog maintenance:** manual update when new clinics appear | Document process; planned migration to online geocoder API (E3-H) |
| **Exact match fragility:** minor OCR variants won't match unless aliased | Register known aliases per catalog entry (e.g. `["CENTRO COSTA AZAHAR", "HV COSTA AZAHAR"]`) |
| **Costa Azahar address** | Real address confirmed: "Rosa Molas 6, Bajo, 12003 Castelló" (from official website) |
| **User may skip enrichment** | By design — user has full control; field remains empty if declined |
| **Online geocoder dependency** (future E3-H) | Timeout + fallback to catalog; rate limiting; cache results |

---

## Cola de prompts

> **Note:** Phase 1/2 prompts (E1-A through E2-A) were executed and completed.
> Phase 3 (E3-A through E3-G) was implemented interactively during Claude Opus 4.6 session.
> See "Avance local" sections above for execution details.

### E3-H — Online geocoder integration (pending)

```text
Replace the local catalog fallback in `clinic_catalog.py` with an online geocoder API
(e.g., Nominatim or Google Places). The endpoint contract (`POST /clinics/lookup-address`)
remains unchanged — only the internal resolution strategy changes.

Steps:
1. Add httpx/aiohttp dependency for async HTTP calls.
2. In `lookup_address_by_name()`, after catalog miss, call geocoder API.
3. Add timeout (5s), rate limiting, and cache (TTL 24h).
4. Return same dict structure: {found, address, source, catalog_version}.
5. Update tests with mocked HTTP responses.
```

---

## How to test

```bash
# Catalog + enrichment + API endpoint tests
python -m pytest backend/tests/unit/test_clinic_catalog.py backend/tests/unit/test_clinic_enrichment.py backend/tests/unit/test_clinic_lookup_api.py -v -o addopts=""

# Golden regression (clinic_address NOT auto-enriched for docA)
python -m pytest backend/tests/unit/test_golden_extraction_regression.py -v -o addopts=""

# Benchmarks (no regression)
python -m pytest backend/tests/benchmarks/ -v -o addopts=""

# Full unit suite
python -m pytest backend/tests/unit/ -v -o addopts=""
```

### Docker validation (post-implementation)

```bash
docker compose -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.dev.yml exec backend python -m pytest backend/tests/unit/ -v -o addopts=""
```

### Manual frontend validation

1. Upload a document with `clinic_name` but no `clinic_address`.
2. In the review panel, the `clinic_address` field should show an amber banner:
   "No se encontró la dirección. ¿La intento buscar yo en internet?"
3. Click "Buscar" → loading spinner → address appears (or "No se encontró" message).
4. Click "Usar esta dirección" → field updates with the found address.
