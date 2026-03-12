# Track Plan T5 (AUDIT-01-T5): Backend Config DRY & Parameter Object

> **Operational rules:** See [plan-execution-protocol.md](../../../03-ops/plan-execution-protocol.md) for agent execution protocol, scope boundary, and validation gates.
>
> **Master plan:** [AUDIT-01 Master](PLAN_2026-03-12_AUDIT-01-CODEBASE-QUALITY-MASTER.md)

**Branch:** improvement/audit-01-t5-backend-config-di
**Worktree:** D:/Git/worktrees/5
**Execution Mode:** Autonomous
**Model Assignment:** GPT-5.4
**PR:** Pending (PR created on explicit user request)
**Related item ID:** `AUDIT-01-T5`
**Prerequisite:** None (independent track)

**Implementation Report:** [IMPLEMENTATION_REPORT_2026-03-12_AUDIT-01-T5-BACKEND-CONFIG-DI](IMPLEMENTATION_REPORT_2026-03-12_AUDIT-01-T5-BACKEND-CONFIG-DI.md)

---

## TL;DR

Two mechanical refactors: (1) DRY-ify duplicated config parsing patterns in `config.py` by extracting shared helpers, and (2) replace the 13-parameter `_build_structured_field` function signature with a `FieldBuildContext` dataclass.

---

## Context

### Problem 1: Config Parsing Duplication (B2)

**File:** `backend/app/config.py`

Four duplicated patterns:
1. **Confidence band cutoff parsing** — repeated tuple unpacking with try/except, float conversion, range validation `[0..1]`, and ordering check (`low_max >= mid_max`). Appears in `confidence_band_cutoffs()` (line 44), `confidence_band_cutoffs_from_values()` (line 52), and `confidence_band_cutoffs_or_none()` (line 118).
2. **Float-from-env parsing** — repeated `get env → strip → parse float → validate range → return default` pattern. Appears in band cutoffs and `human_edit_confidence()` (line 96).
3. **Policy version resolution** — repeated `confidence_policy_version_or_default()` logic in 3 places.
4. **Rate limit resolution** — repeated `get env → strip → check pytest runtime → return default` (lines 60–73).

### Problem 2: Excessive Parameter Count (B3)

**File:** `backend/app/application/processing/confidence_scoring.py`, line 189

`_build_structured_field` has 13 keyword-only parameters:
```
key, value, confidence, snippet, value_type, page, mapping_id,
context_key, context_key_aliases, policy_version, repository,
candidate_suggestions
```

This violates the "max 5 parameters" heuristic. A parameter object makes the function signature self-documenting and easier to extend.

---

## Scope Boundary

- **In scope:** B2 (DRY config parsing), B3 (parameter object for `_build_structured_field`)
- **Out of scope:** Changing config values or defaults, adding new configuration parameters, refactoring other functions in confidence_scoring.py

---

## Design Decisions

### DD-1: Private helper `_parse_float_env` for config.py
**Approach:** Extract a `_parse_float_env(env_var, default, min_val=0.0, max_val=1.0)` helper.
**Rationale:** Used by band cutoffs and human_edit_confidence. Eliminates 4 identical try/except/validate blocks.

### DD-2: Private helper `_parse_band_cutoffs` for config.py
**Approach:** Extract `_parse_band_cutoffs(low_str, mid_str) -> tuple[float, float] | None` that encapsulates the parse + validate + ordering logic.
**Rationale:** Used by 3 functions. Single place for the ordering invariant (`low_max <= mid_max`).

### DD-3: `FieldBuildContext` dataclass for confidence_scoring.py
**Approach:** Create a `@dataclass(frozen=True, slots=True)` with all 13 fields. Update `_build_structured_field` to accept a single `ctx: FieldBuildContext` parameter. Update all callers.
**Rationale:** Frozen dataclass ensures immutability (matching current keyword-only semantics). `slots=True` for memory efficiency.

---

## PR Partition Gate

| Criterion | Value | Threshold | Result |
|-----------|-------|-----------|--------|
| Estimated diff (LOC) | ~120 | 400 | ✅ |
| Code files changed | 2 | 15 | ✅ |
| Scope classification | code only | — | ✅ |
| Semantic risk | LOW (extract helpers + parameter object) | — | ✅ |

**Decision:** Single PR. No split needed.

---

## DOC-1

`no-doc-needed` — Internal refactoring. No API or user-facing changes.

---

## Steps

### Phase 1 — B2: Config Parsing DRY

**AGENTE: GPT-5.4**

#### Step 1: Extract `_parse_float_env` helper

In `backend/app/config.py`, add:

```python
def _parse_float_env(
    env_var: str,
    default: float,
    min_val: float = 0.0,
    max_val: float = 1.0,
) -> float:
    """Parse a float from an environment variable with range validation."""
    raw = _getenv(env_var)
    if raw is None:
        return default
    raw = raw.strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    if not (min_val <= value <= max_val):
        return default
    return value
```

#### Step 2: Extract `_parse_band_cutoffs` helper

```python
def _parse_band_cutoffs(
    low_str: str | None,
    mid_str: str | None,
    default_low: float,
    default_mid: float,
) -> tuple[float, float]:
    """Parse and validate confidence band cutoffs."""
    low = _parse_float_from_str(low_str, default_low)
    mid = _parse_float_from_str(mid_str, default_mid)
    if low > mid:
        return (default_low, default_mid)
    return (low, mid)
```

#### Step 3: Refactor existing functions to use helpers

**AGENTE: GPT-5.4**

Replace duplicated parsing logic in `confidence_band_cutoffs()`, `confidence_band_cutoffs_from_values()`, `confidence_band_cutoffs_or_none()`, and `human_edit_confidence()` with calls to the new helpers.

#### Step 4: Validate Phase 1

**AGENTE: GPT-5.4**

- `ruff check backend/app/config.py`
- `python -m pytest backend/tests/ -x --tb=short -q -k config` — config-related tests pass
- `python -m pytest backend/tests/ -x --tb=short -q` — all 709+ pass

### Phase 2 — B3: Parameter Object

**AGENTE: GPT-5.4**

#### Step 5: Create `FieldBuildContext` dataclass

In `backend/app/application/processing/confidence_scoring.py`, add above `_build_structured_field`:

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class FieldBuildContext:
    """Parameter object for _build_structured_field."""
    key: str
    value: str
    confidence: float
    snippet: str
    value_type: str
    page: int | None
    mapping_id: str | None
    context_key: str
    context_key_aliases: tuple[str, ...]
    policy_version: str
    repository: DocumentRepository | None
    candidate_suggestions: list[dict[str, object]] | None
```

#### Step 6: Update `_build_structured_field` signature

**AGENTE: GPT-5.4**

Change from 13 keyword-only parameters to:
```python
def _build_structured_field(ctx: FieldBuildContext) -> dict[str, Any]:
```

Update the function body to reference `ctx.key`, `ctx.value`, etc.

#### Step 7: Update all callers

**AGENTE: GPT-5.4**

Find all call sites of `_build_structured_field` and wrap their arguments in `FieldBuildContext(...)`. Since the function is module-private (`_` prefix), all callers are in the same file.

#### Step 8: Validate Phase 2

**AGENTE: GPT-5.4**

- `ruff check backend/app/application/processing/confidence_scoring.py`
- `python -m pytest backend/tests/ -x --tb=short -q` — all 709+ pass

### Phase 3 — Final Validation

**AGENTE: GPT-5.4**

#### Step 9: Full suite

- `python -m pytest backend/tests/ --tb=short -q` — 709+ passed
- `ruff check backend/` — 0 errors
- `ruff format --check backend/` — 0 diffs

---

## Execution Status

### Phase 0 — Preflight

- [x] P0-A 🔄 — Create branch `improvement/audit-01-t5-backend-config-di` from latest `main`. Verify clean worktree. **AGENTE: GPT-5.4** — ✅ `no-commit (branch created, clean worktree verified)`

### Phase 1 — B2: Config DRY

- [x] P1-A 🔄 — Extract `_parse_float_env` helper. **AGENTE: GPT-5.4** — ✅ `06c56205`
- [x] P1-B 🔄 — Extract `_parse_band_cutoffs` helper. **AGENTE: GPT-5.4** — ✅ `06c56205`
- [x] P1-C 🔄 — Refactor existing functions to use helpers. **AGENTE: GPT-5.4** — ✅ `06c56205`
- [x] P1-D 🔄 — Run tests, verify all pass. **AGENTE: GPT-5.4** — ✅ `no-commit (ruff check backend/app/config.py; 39 focused tests passed; L2 backend suite 709 passed, 2 xfailed)`
- [x] P1-E 🚧 — Checkpoint: present diff for user review. **AGENTE: GPT-5.4** — ✅ `no-commit (Autonomous mode: low-risk mechanical refactor accepted without pause)`

### Phase 2 — B3: Parameter Object

- [ ] P2-A 🔄 — Create `FieldBuildContext` dataclass. **AGENTE: GPT-5.4** ⏳ IN PROGRESS (GPT-5.4, 2026-03-12)
- [ ] P2-B 🔄 — Update `_build_structured_field` signature. **AGENTE: GPT-5.4** ⏳ IN PROGRESS (GPT-5.4, 2026-03-12)
- [ ] P2-C 🔄 — Update all callers. **AGENTE: GPT-5.4** ⏳ IN PROGRESS (GPT-5.4, 2026-03-12)
- [ ] P2-D 🔄 — Run tests, verify all pass. **AGENTE: GPT-5.4**
- [ ] P2-E 🚧 — Checkpoint: present diff for user review. **AGENTE: GPT-5.4**

### Phase 3 — Final

- [ ] P3-A 🔄 — Full validation (tests + lint). **AGENTE: GPT-5.4**
- [ ] P3-B 🚧 — Present commit proposal to user. **AGENTE: GPT-5.4**

---

## Relevant Files

| File | Action |
|------|--------|
| `backend/app/config.py` | REFACTOR (B2 — extract helpers) |
| `backend/app/application/processing/confidence_scoring.py` | REFACTOR (B3 — add dataclass, update signature) |
| `backend/tests/` | VERIFY (no changes, all must pass) |

---

## Acceptance Criteria

- [ ] No duplicated float-parsing or band-cutoff logic in `config.py`
- [ ] `_build_structured_field` accepts a single `FieldBuildContext` parameter
- [ ] `FieldBuildContext` is a frozen dataclass with slots
- [ ] All callers updated to construct `FieldBuildContext`
- [ ] 709+ tests pass, ≥91% coverage
- [ ] `ruff check` + `ruff format` clean
