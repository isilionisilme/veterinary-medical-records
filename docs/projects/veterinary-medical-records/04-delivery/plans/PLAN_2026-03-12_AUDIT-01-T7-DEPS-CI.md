# Track Plan T7 (AUDIT-01-T7): Dependencies & CI Hardening

> **Operational rules:** See [plan-execution-protocol.md](../../../03-ops/plan-execution-protocol.md) for agent execution protocol, scope boundary, and validation gates.
>
> **Master plan:** [AUDIT-01 Master](PLAN_2026-03-12_AUDIT-01-CODEBASE-QUALITY-MASTER.md)

**Branch:** improvement/audit-01-t7-deps-ci
**Worktree:** D:/Git/worktrees/codex-permanent-1
**Execution Mode:** Autonomous
**Model Assignment:** GPT-5.4
**PR:** Pending (PR created on explicit user request)
**Related item ID:** `AUDIT-01-T7`
**Prerequisite:** None (independent track)

**Implementation Report:** [IMPLEMENTATION_REPORT_2026-03-12_AUDIT-01-T7-DEPS-CI](IMPLEMENTATION_REPORT_2026-03-12_AUDIT-01-T7-DEPS-CI.md)

---

## TL;DR

Three quick fixes: (1) upgrade starlette to fix 2 CVEs (GHSA-2c2j-9gv5-cj73, GHSA-7f5h-v6xp-fcq8); (2) enforce `npm audit` in CI by removing `continue-on-error: true`; (3) verify and remove `framer-motion` if unused.

---

## Context

### Problem 1: Starlette CVEs (D1)

`pip-audit` found 2 vulnerabilities in `starlette 0.46.2`:
- **GHSA-2c2j-9gv5-cj73** — DoS via multipart boundary parsing
- **GHSA-7f5h-v6xp-fcq8** — Path traversal in `StaticFiles`

Both are fixed in starlette ≥ 0.46.3. Since starlette is a transitive dependency of FastAPI, the fix is to either pin starlette directly or upgrade FastAPI to a version that pulls a fixed starlette.

### Problem 2: npm Audit Soft-Fail (D2)

**File:** `.github/workflows/ci.yml`, lines 108–110

```yaml
- name: Security audit (npm audit)
  run: npm --prefix frontend audit --audit-level=high
  continue-on-error: true
```

The `continue-on-error: true` means npm audit failures don't block CI. This turns the security gate into a no-op.

### Problem 3: Potentially Unused framer-motion (D3)

The audit flagged `framer-motion` in `frontend/package.json` as potentially unused. A grep for imports will confirm whether it can be removed.

---

## Scope Boundary

- **In scope:** D1 (starlette upgrade), D2 (npm audit enforcement), D3 (framer-motion verification + removal if unused)
- **Out of scope:** Other dependency upgrades, ruff rule additions, CI pipeline restructuring

---

## Design Decisions

### DD-1: Pin starlette in requirements.txt
**Approach:** Add `starlette>=0.46.3` to `backend/requirements.txt` to ensure the vulnerable version is never installed, even if FastAPI's own pin allows it.
**Rationale:** Defense in depth. FastAPI may lag behind starlette releases.

### DD-2: Remove `continue-on-error` from npm audit
**Approach:** Simply remove the `continue-on-error: true` line.
**Rationale:** Security audits should block CI. If there are known acceptable vulnerabilities, they should be handled with `npm audit --omit=dev` or `.nsprc` allowlist, not by silencing all failures.

### DD-3: Grep-before-remove for framer-motion
**Approach:** Search for `framer-motion`, `motion`, `AnimatePresence`, `useAnimation`, `useMotionValue` across all frontend source files. If zero imports found, remove from `package.json`.
**Rationale:** Safe removal requires evidence of non-use.

---

## PR Partition Gate

| Criterion | Value | Threshold | Result |
|-----------|-------|-----------|--------|
| Estimated diff (LOC) | ~15 | 400 | ✅ |
| Code files changed | 3 | 15 | ✅ |
| Scope classification | config + deps | — | ✅ |
| Semantic risk | LOW (dependency upgrade + config) | — | ✅ |

**Decision:** Single PR. No split needed.

---

## DOC-1

`no-doc-needed` — Dependency and CI configuration changes. No user-facing changes.

---

## Steps

### Phase 1 — D1: Starlette Upgrade

**AGENTE: GPT-5.4**

#### Step 1: Add starlette pin to requirements.txt

In `backend/requirements.txt`, add:
```
starlette>=0.46.3
```

#### Step 2: Install and verify

**AGENTE: GPT-5.4**

```bash
pip install -r backend/requirements.txt
pip-audit -r backend/requirements.txt
```

Verify 0 vulnerabilities.

#### Step 3: Run backend tests

**AGENTE: GPT-5.4**

```bash
python -m pytest backend/tests/ -x --tb=short -q
```

All 709+ tests must pass.

### Phase 2 — D2: Enforce npm Audit

**AGENTE: GPT-5.4**

#### Step 4: Remove `continue-on-error` from CI

In `.github/workflows/ci.yml`, change:
```yaml
- name: Security audit (npm audit)
  run: npm --prefix frontend audit --audit-level=high
  continue-on-error: true
```
To:
```yaml
- name: Security audit (npm audit)
  run: npm --prefix frontend audit --audit-level=high
```

#### Step 5: Verify npm audit passes locally

**AGENTE: GPT-5.4**

```bash
cd frontend && npm audit --audit-level=high
```

If there are existing high/critical vulnerabilities, they must be resolved before removing `continue-on-error`. Document any needed fixes.

### Phase 3 — D3: framer-motion Verification

**AGENTE: GPT-5.4**

#### Step 6: Search for framer-motion usage

```bash
grep -r "framer-motion\|from.*motion\|AnimatePresence\|useAnimation\|useMotionValue\|motion\." frontend/src/ --include="*.ts" --include="*.tsx"
```

#### Step 7: Remove if unused

**AGENTE: GPT-5.4**

If zero results from Step 6:
```bash
cd frontend && npm uninstall framer-motion
```

If framer-motion IS used, document the usage and mark D3 as `no-action-needed`.

#### Step 8: Run frontend tests

**AGENTE: GPT-5.4**

```bash
cd frontend && npm run test -- --run && npm run lint
```

All 345 tests must pass, zero lint errors.

### Phase 4 — Validation

**AGENTE: GPT-5.4**

#### Step 9: Full validation

- `pip-audit -r backend/requirements.txt` — 0 vulnerabilities
- `python -m pytest backend/tests/ -x --tb=short -q` — 709+ passed
- `cd frontend && npm audit --audit-level=high` — 0 high/critical
- `cd frontend && npm run test -- --run` — 345 passed
- `ruff check backend/` — 0 errors

---

## Execution Status

### Phase 0 — Preflight

- [ ] P0-A 🔄 — Create branch `improvement/audit-01-t7-deps-ci` from latest `main`. Verify clean worktree. **AGENTE: GPT-5.4**

### Phase 1 — D1: Starlette

- [ ] P1-A 🔄 — Add `starlette>=0.46.3` to requirements.txt. **AGENTE: GPT-5.4**
- [ ] P1-B 🔄 — Verify pip-audit shows 0 vulnerabilities. **AGENTE: GPT-5.4**
- [ ] P1-C 🔄 — Run backend tests. **AGENTE: GPT-5.4**
- [ ] P1-D 🚧 — Checkpoint: present diff for user review. **AGENTE: GPT-5.4**

### Phase 2 — D2: npm Audit

- [ ] P2-A 🔄 — Remove `continue-on-error: true` from ci.yml. **AGENTE: GPT-5.4**
- [ ] P2-B 🔄 — Verify `npm audit` passes locally. **AGENTE: GPT-5.4**
- [ ] P2-C 🚧 — Checkpoint: present diff for user review. **AGENTE: GPT-5.4**

### Phase 3 — D3: framer-motion

- [ ] P3-A 🔄 — Search for framer-motion usage. **AGENTE: GPT-5.4**
- [ ] P3-B 🔄 — Remove if unused; document if used. **AGENTE: GPT-5.4**
- [ ] P3-C 🔄 — Run frontend tests. **AGENTE: GPT-5.4**
- [ ] P3-D 🚧 — Checkpoint: present diff for user review. **AGENTE: GPT-5.4**

### Phase 4 — Final

- [ ] P4-A 🔄 — Full validation. **AGENTE: GPT-5.4**
- [ ] P4-B 🚧 — Present commit proposal to user. **AGENTE: GPT-5.4**

---

## Relevant Files

| File | Action |
|------|--------|
| `backend/requirements.txt` | MODIFY (D1 — add starlette pin) |
| `.github/workflows/ci.yml` | MODIFY (D2 — remove continue-on-error) |
| `frontend/package.json` | MODIFY if framer-motion unused (D3) |

---

## Acceptance Criteria

- [ ] `pip-audit` reports 0 vulnerabilities
- [ ] `npm audit --audit-level=high` exits with code 0
- [ ] CI `npm audit` step enforces failures (no `continue-on-error`)
- [ ] framer-motion removed if unused (or documented if used)
- [ ] 709+ backend tests pass
- [ ] 345 frontend tests pass
- [ ] All lint checks clean
