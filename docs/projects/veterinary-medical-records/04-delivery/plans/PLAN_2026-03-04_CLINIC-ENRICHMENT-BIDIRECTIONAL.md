# Plan: Bidirectional Clinic Enrichment Fallback (`clinic_name` ↔ `clinic_address`)

> **Operational rules:** See [execution-rules.md](../../03-ops/execution-rules.md) for agent execution protocol, SCOPE BOUNDARY template, commit conventions, and handoff messages.

**Rama:** `feat/clinic-enrichment-bidirectional-2026-03-04`
**PR:** _(pending)_
**Prerequisito:** `main` estable con tests verdes. PR #196 (golden-loop clinic_address) merged.

## Context

After hardening `clinic_address` OCR extraction (PR #196), a real-world gap remains:
- **docA** (`7f35011c-9377-4407-8a55-6ffd33e3e73b`): `clinic_name = "CENTRO COSTA AZAHAR"`, `clinic_address = None`. The raw text contains **no usable address candidates** — OCR alone cannot fill this field.

The inverse case is also plausible: a document showing an address header but no clinic name.

This plan introduces a **post-OCR enrichment fallback** using a local versioned catalog that maps `clinic_name ↔ clinic_address`. It runs after normalization, never overwrites OCR values, and uses a distinguishable lower confidence level for traceability.

## Objective

- Complete missing `clinic_address` (or `clinic_name`) when the sibling field is present and has a unique match in the catalog.
- Never overwrite OCR-extracted values.
- Provide explicit traceability (`enriched_from_clinic_catalog`, confidence `0.40`).
- Maintain zero regressions in all existing golden, benchmark, and unit tests.

## Scope Boundary (strict)

- **In scope:** enrichment catalog module, enrichment function in `field_normalizers.py`, enrichment confidence constant, unit tests for catalog + enrichment, golden regression updates.
- **Out of scope:** changes to `candidate_mining.py`, fuzzy matching, external API calls, frontend changes, other field enrichment, OCR extraction logic.

## Commit plan

| # | Commit message | Files touched | Step |
|---|---|---|---|
| C1 | `feat(enrichment): add clinic catalog module with versioned name↔address mapping` | `backend/app/application/clinic_catalog.py` | E1-A |
| C2 | `feat(enrichment): add COVERAGE_CONFIDENCE_ENRICHMENT constant` | `backend/app/application/processing/constants.py` | E1-A |
| C3 | `feat(enrichment): wire bidirectional clinic enrichment into normalize_canonical_fields` | `backend/app/application/field_normalizers.py` | E1-B |
| C4 | `test(enrichment): add unit tests for clinic catalog lookups` | `backend/tests/unit/test_clinic_catalog.py` | E1-C |
| C5 | `test(enrichment): add unit tests for bidirectional clinic enrichment` | `backend/tests/unit/test_clinic_enrichment.py` | E1-C |
| C6 | `test(enrichment): update golden regression for docA clinic_address enrichment` | `backend/tests/unit/test_golden_extraction_regression.py` | E1-D |

> **Note:** Per execution-rules NO-BATCH, each plan step produces exactly one commit. Commits C1+C2 are bundled in step E1-A because they are a single atomic unit (catalog + its confidence constant). C4+C5 are bundled in E1-C for the same reason (all test files for one test step).

---

## Estado de ejecución

**Leyenda**
- 🔄 auto-chain — ejecutable por Codex
- 🚧 hard-gate — revisión/decisión de usuario (Claude)

### Phase 1 — Implementation

- [ ] E1-A 🔄 — **Create clinic catalog module + enrichment confidence constant:** add `backend/app/application/clinic_catalog.py` with versioned `_CLINIC_CATALOG`, `lookup_address_by_name()`, `lookup_name_by_address()`, and add `COVERAGE_CONFIDENCE_ENRICHMENT = 0.40` to `constants.py`. Seed catalog with known test data. (Claude Opus 4.6)
- [ ] E1-B 🔄 — **Wire enrichment into `normalize_canonical_fields`:** add `_enrich_clinic_name_and_address_pair()` in `field_normalizers.py`, called after individual clinic normalization, before species/breed pair. Never overwrite existing OCR values. Add enrichment evidence to `evidence_map`. (Claude Opus 4.6)
- [ ] E1-C 🔄 — **Add unit tests for catalog + enrichment:** create `test_clinic_catalog.py` (exact match, case-insensitive, no match, ambiguous) and `test_clinic_enrichment.py` (6 mandatory cases). (Claude Opus 4.6)
- [ ] E1-D 🔄 — **Update golden regression for docA enrichment:** update `test_golden_extraction_regression.py` to assert `clinic_address` is enriched from catalog for docA. Verify no regressions. (Claude Opus 4.6)

### Phase 2 — Validation and closure

- [ ] E2-A 🔄 — **Run full test suite and document results:** execute unit + golden + benchmark tests, document pass/fail/delta in PR body with reproducible evidence. (Claude Opus 4.6)
- [ ] E2-B 🚧 — **Hard-gate: user validation with real examples and go/no-go decision.** Review enrichment behavior on docA, verify traceability, confirm scope. (Claude Opus 4.6)

---

## Acceptance criteria

1. Missing `clinic_address` is completed from catalog when `clinic_name` has a unique match.
2. Missing `clinic_name` is completed from catalog when `clinic_address` has a unique match.
3. 0 matches → field stays empty (no hallucination).
4. \>1 match (ambiguity) → field stays empty (no guessing).
5. Existing OCR values are never overwritten.
6. Enriched values have `confidence = 0.40` and `source = "enriched_from_clinic_catalog"`.
7. No regression in existing golden tests (8/8), benchmark (17/17 clinic_address, clinic_name), and unit suite.
8. docA regression passes with enriched `clinic_address`.

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Enrichment location | Inside `normalize_canonical_fields` | Follows `_normalize_species_and_breed_pair` precedent; evidence_map is available |
| Catalog format | In-code Python list of dicts | Simple, versionable, no external dependency; migrate to DB when >50 entries |
| Match strategy | Exact casefold + strip | No fuzzy matching in v1; reduces false positives to zero |
| Confidence level | `0.40` (`COVERAGE_CONFIDENCE_ENRICHMENT`) | Below `COVERAGE_CONFIDENCE_FALLBACK` (0.50) for clear provenance |
| Ambiguity rule | 0 or >1 matches → leave empty | Conservative; avoids wrong enrichment |
| Traceability | Evidence entry with `source` + `catalog_version` | Auditable; distinguishable from OCR in review UI |

## Risks and limitations

| Risk | Mitigation |
|---|---|
| **Catalog maintenance:** manual update when new clinics appear | Document process; consider DB migration if catalog grows beyond 50 entries |
| **Exact match fragility:** minor OCR variants won't match unless aliased | Register known aliases per catalog entry (e.g. `["CENTRO COSTA AZAHAR", "HV COSTA AZAHAR"]`) |
| **No real address for Costa Azahar** in current data | Use synthetic placeholder address for testing; replace when real address is confirmed |
| **`evidence_map` mutability:** type hint is `Mapping` (read-only) | Enrichment function handles both `dict` (mutate) and `Mapping` (return separately) |

---

## Cola de prompts

### E1-A — Catalog module + confidence constant

```text
Crea el módulo de catálogo de clínicas y la constante de confianza de enriquecimiento.

1. Crea `backend/app/application/clinic_catalog.py` con:
   - `CATALOG_VERSION = "1.0.0"`
   - `_CLINIC_CATALOG: list[dict]` — lista de entradas con formato:
     `{"names": ["ALIAS1", "ALIAS2"], "address": "Dirección completa"}`
   - Semilla inicial con datos de test conocidos:
     `{"names": ["CENTRO COSTA AZAHAR", "HV COSTA AZAHAR"], "address": "Calle Ejemplo 1, 12001 Castellón"}`
     (dirección placeholder hasta confirmar la real)
   - `lookup_address_by_name(name: str) -> str | None` — casefold+strip match contra todos los alias; retorna address si exactamente 1 entry coincide, None si 0 o >1.
   - `lookup_name_by_address(address: str) -> str | None` — casefold+strip match en address; retorna el nombre canónico (primer alias) si exactamente 1 match, None si 0 o >1.

2. En `backend/app/application/processing/constants.py`, añade:
   - `COVERAGE_CONFIDENCE_ENRICHMENT = 0.40`
   Debajo de las constantes existentes COVERAGE_CONFIDENCE_LABEL y COVERAGE_CONFIDENCE_FALLBACK.

No modifiques ningún otro archivo. Ejecuta validación estática si es posible.
```

⚠️ AUTO-CHAIN → E1-B

### E1-B — Wire enrichment into normalize_canonical_fields

```text
Implementa la función de enriquecimiento bidireccional en field_normalizers.py.

1. En `backend/app/application/field_normalizers.py`, añade la función:
   `_enrich_clinic_name_and_address_pair(values: dict, evidence_map: Mapping | None) -> dict`
   
   Lógica:
   - Si `clinic_name` está presente (str no vacía) y `clinic_address` está vacía/None:
     → llama `lookup_address_by_name(clinic_name)`
     → si retorna valor: asigna a `values["clinic_address"]`
     → añade entrada de evidencia en evidence_map["clinic_address"] con:
       `{"value": <address>, "confidence": COVERAGE_CONFIDENCE_ENRICHMENT, "source": "enriched_from_clinic_catalog", "catalog_version": CATALOG_VERSION}`
   - Si `clinic_address` está presente y `clinic_name` está vacía/None:
     → llama `lookup_name_by_address(clinic_address)`
     → si retorna valor: asigna a `values["clinic_name"]`
     → añade entrada de evidencia análoga
   - Si ambos están presentes o ambos vacíos: no hacer nada
   - NUNCA sobrescribir un valor OCR existente

2. En `normalize_canonical_fields()`, llama la función después de la normalización individual de clinic_name y clinic_address, y ANTES de `_normalize_species_and_breed_pair`:
   ```python
   normalized["clinic_address"] = _normalize_clinic_address_value(normalized.get("clinic_address"))
   normalized = _enrich_clinic_name_and_address_pair(normalized, evidence_map)  # ← NUEVO
   normalized = _normalize_species_and_breed_pair(normalized, evidence_map)
   ```

Ejecuta `python -m pytest backend/tests/unit/test_field_normalizers_species.py -x -q --tb=short -o addopts=""` para verificar que no hay regresiones.
```

⚠️ AUTO-CHAIN → E1-C

### E1-C — Unit tests for catalog + enrichment

```text
Crea los tests unitarios para el catálogo y el enriquecimiento bidireccional.

1. Crea `backend/tests/unit/test_clinic_catalog.py` con:
   - `test_lookup_address_exact_match` — nombre conocido → retorna address
   - `test_lookup_address_case_insensitive` — "centro costa azahar" → retorna address
   - `test_lookup_name_exact_match` — dirección conocida → retorna nombre canónico
   - `test_lookup_name_case_insensitive` — dirección en minúsculas → retorna nombre
   - `test_lookup_address_no_match` — nombre desconocido → None
   - `test_lookup_name_no_match` — dirección desconocida → None
   - `test_lookup_address_ambiguous` — usa monkeypatch para inyectar catálogo con >1 match → None
   - `test_lookup_name_ambiguous` — usa monkeypatch para inyectar catálogo con >1 entry misma address → None

2. Crea `backend/tests/unit/test_clinic_enrichment.py` con los 6 casos obligatorios:
   - `test_enriches_address_from_name_unique_match` — clinic_name conocido, clinic_address=None → address completada con confidence 0.40
   - `test_enriches_name_from_address_unique_match` — clinic_address conocida, clinic_name=None → name completado con confidence 0.40
   - `test_no_enrichment_zero_matches` — nombre/dirección desconocidos → ambos quedan None
   - `test_no_enrichment_ambiguous_matches` — >1 match → campo queda vacío
   - `test_no_overwrite_existing_ocr_value` — ambos campos presentes → ninguno se sobrescribe
   - `test_docA_regression_enrichment` — simula docA (clinic_name="CENTRO COSTA AZAHAR", clinic_address=None) → address se completa del catálogo

Ejecuta `python -m pytest backend/tests/unit/test_clinic_catalog.py backend/tests/unit/test_clinic_enrichment.py -v -o addopts=""` y reporta resultados.
```

⚠️ AUTO-CHAIN → E1-D

### E1-D — Golden regression update

```text
Actualiza el test de regresión golden para docA incorporando la expectativa de enriquecimiento.

En `backend/tests/unit/test_golden_extraction_regression.py`:
- En `test_doc_a_golden_goal_fields_regression`, el golden actual ya aserta `clinic_name == "CENTRO COSTA AZAHAR"`.
- Añade aserción para `clinic_address`:
  `clinic_address = schema.get("clinic_address")`
  `assert clinic_address == "Calle Ejemplo 1, 12001 Castellón"` (o el valor del catálogo), con mensaje de regresión descriptivo.
  - Usar un comentario que indique `# enriched from clinic_catalog (not OCR)`.

- Verifica que `test_doc_b_golden_goal_fields_regression` sigue pasando sin cambios (docB no tiene clinic_name → no hay enriquecimiento).

Ejecuta:
- `python -m pytest backend/tests/unit/test_golden_extraction_regression.py -v -o addopts=""`
- `python -m pytest backend/tests/benchmarks/ -v -o addopts=""`
Reporta resultados de ambos.
```

⚠️ AUTO-CHAIN → E2-A

### E2-A — Full validation run

```text
Ejecuta la suite completa de tests y documenta resultados para el body del PR.

Comandos:
1. `python -m pytest backend/tests/unit/test_clinic_catalog.py backend/tests/unit/test_clinic_enrichment.py -v -o addopts=""`
2. `python -m pytest backend/tests/unit/test_golden_extraction_regression.py -v -o addopts=""`
3. `python -m pytest backend/tests/benchmarks/test_clinic_address_extraction_accuracy.py -v -o addopts=""`
4. `python -m pytest backend/tests/benchmarks/test_clinic_name_extraction_accuracy.py -v -o addopts=""`
5. `python -m pytest backend/tests/unit/ -v -o addopts=""`

Documenta:
- Total tests, pass/fail
- Enrichment-specific results (6/6 mandatory cases)
- Catalog tests (8/8)
- Golden (8/8 + docA enrichment)
- Benchmark deltas (should be unchanged)
- Any regressions

Formato para PR body:
```markdown
## Validation Results
| Suite | Tests | Pass | Fail |
|---|---|---|---|
| Clinic catalog | 8 | 8 | 0 |
| Clinic enrichment | 6 | 6 | 0 |
| Golden regression | N | N | 0 |
| Benchmark (clinic_address) | 17 | 17 | 0 |
| Benchmark (clinic_name) | N | N | 0 |
| Full unit suite | N | N | 0 |
```
```

⚠️ HARD-GATE → E2-B (Claude)

### E2-B — Hard-gate: user validation

```text
Paso de validación del usuario. Claude presenta:
1. Resumen de cambios implementados
2. Resultados de tests completos
3. Ejemplo concreto: docA antes y después del enriquecimiento
4. Comandos Docker reproducibles para validación manual
5. Riesgos/limitaciones identificados
6. Recomendación go/no-go

El usuario responde con aprobación para merge o solicita ajustes.
```

---

## Prompt activo

### Paso objetivo

E1-A 🔄 — Create clinic catalog module + enrichment confidence constant.

### Prompt

```text
Crea el módulo de catálogo de clínicas y la constante de confianza de enriquecimiento.

1. Crea `backend/app/application/clinic_catalog.py` con:
   - `CATALOG_VERSION = "1.0.0"`
   - `_CLINIC_CATALOG: list[dict]` — lista de entradas con formato:
     `{"names": ["ALIAS1", "ALIAS2"], "address": "Dirección completa"}`
   - Semilla inicial con datos de test conocidos:
     `{"names": ["CENTRO COSTA AZAHAR", "HV COSTA AZAHAR"], "address": "Calle Ejemplo 1, 12001 Castellón"}`
     (dirección placeholder hasta confirmar la real)
   - `lookup_address_by_name(name: str) -> str | None` — casefold+strip match contra todos los alias; retorna address si exactamente 1 entry coincide, None si 0 o >1.
   - `lookup_name_by_address(address: str) -> str | None` — casefold+strip match en address; retorna el nombre canónico (primer alias) si exactamente 1 match, None si 0 o >1.

2. En `backend/app/application/processing/constants.py`, añade:
   - `COVERAGE_CONFIDENCE_ENRICHMENT = 0.40`
   Debajo de las constantes existentes COVERAGE_CONFIDENCE_LABEL y COVERAGE_CONFIDENCE_FALLBACK.

No modifiques ningún otro archivo. Ejecuta validación estática si es posible.
```

---

## How to test

```bash
# Catalog + enrichment unit tests
python -m pytest backend/tests/unit/test_clinic_catalog.py backend/tests/unit/test_clinic_enrichment.py -v -o addopts=""

# Golden regression (includes docA enrichment)
python -m pytest backend/tests/unit/test_golden_extraction_regression.py -v -o addopts=""

# Benchmarks (no regression)
python -m pytest backend/tests/benchmarks/ -v -o addopts=""

# Full unit suite
python -m pytest backend/tests/unit/ -v -o addopts=""
```

### Docker validation (post-implementation)

```bash
# Build and run tests in Docker
docker compose -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.dev.yml exec backend python -m pytest backend/tests/unit/test_clinic_catalog.py backend/tests/unit/test_clinic_enrichment.py -v -o addopts=""
docker compose -f docker-compose.dev.yml exec backend python -m pytest backend/tests/unit/test_golden_extraction_regression.py -v -o addopts=""
docker compose -f docker-compose.dev.yml exec backend python -m pytest backend/tests/benchmarks/ -v -o addopts=""
```
