# Plan: Scripts Reorganization (Risk-Reduced, Commit-by-Commit)

> **Operational rules:** See [execution-rules.md](../../03-ops/execution-rules.md) for step integrity, CI-first handoff, and evidence requirements.

**Scope:** `scripts/` root only (this repository).
**Out of scope:** `metrics/**`, cross-repo parity changes.
**Branch:** `chore/scripts-reorg-structure`
**Objective:** Reorganize scripts by domain with legacy compatibility and minimal operational risk.

## Commit Strategy

- Small commits with clear rollback boundaries.
- Backward compatibility preserved via legacy wrappers for 1-2 iterations.
- Validation gate after each commit before moving to next step.

---

## Estado de ejecución

### Phase 1 — Foundation

- [x] S1-C1 — Create folder structure and index docs (Commit 1)
  - Create: `_shared`, `ci/preflight`, `ci/hooks`, `docs`, `quality/lint`, `quality/format`, `quality/security`, `dev/bootstrap`, `dev/local-env`, `release/versioning`, `release/changelog`, `archive`
  - Add: `scripts/README.md` + README in `ci/preflight`, `ci/hooks`, `docs`
  - **Gate:** No functional behavior changed; tree validated.

### Phase 2 — CI and hooks first (highest operational risk)

- [x] S2-C2 — Move CI core scripts + add mandatory wrappers (Commit 2)
  - Move: `pre_push_quality_gate.py` -> `scripts/ci/preflight/`
  - Move: `install-pre-push-hook.ps1` -> `scripts/ci/hooks/`
  - Add wrappers at old paths with deprecation notice.
  - **Gate:** `.githooks/pre-push` works through new path and wrappers work from old paths.

### Phase 3 — Docs guard rail migration

- [x] S3-C3 — Move docs scripts + update guard references (Commit 3)
  - Move to `scripts/docs/`: `check_docs_links.mjs`, `classify_doc_change.py`, `check_doc_test_sync.py`, `check_doc_router_parity.py`, `check_no_canonical_router_refs.py`, `sync_docs_to_wiki.py`
  - Update references in workflows and docs guard mappings.
  - Keep legacy wrappers in old locations.
  - **Gate:** Docs guards run from new paths.

### Phase 4 — Quality lint migration

- [x] S4-C4 — Move lint guards and update npm/workflow references (Commit 4)
  - Move to `scripts/quality/lint/`: `check_brand_compliance.py`, `check_design_system.mjs`
  - Update: root `package.json`, `frontend/package.json`, CI references, contract tests.
  - Keep legacy wrappers.
  - **Gate:** `npm run docs:links`, `npm --prefix frontend run check:design-system`, and brand guard path checks pass.

### Phase 5 — Developer utilities migration

- [x] S5-C5 — Move bootstrap/local-env scripts + harden path resolution (Commit 5)
  - Move to `scripts/dev/bootstrap/`: `start-all.ps1`, `start-all.bat`
  - Move to `scripts/dev/local-env/`: `reset-dev-db.ps1/.bat`, `reload-vscode-window.ps1/.bat`, `clear-documents.bat`, `interpretation_debug_snapshot.py`, `ab_compare_pdf_extractors.py`
  - Add wrappers for user-facing entrypoints.
  - Fix repo-root/path-sensitive logic where needed.
  - **Gate:** Legacy command paths still work; moved scripts run correctly.

### Phase 6 — Preflight tiers (L1/L2/L3) and aliases

- [x] S6-C6 — Add preflight orchestration scripts (Commit 6)
  - Add: `scripts/ci/preflight/preflight-ci-local.ps1`
  - Add: `test-L1/L2/L3.ps1` and `.bat`
  - Add legacy aliases: `preflight-quick`, `preflight-push`, `preflight-full` (deprecation notice)
  - **Gate:** L1/L2/L3 and alias commands execute expected mode.

### Phase 7 — Documentation and cleanup

- [x] S7-C7 — Update docs + cleanup generated artifacts (Commit 7)
  - Update references in `README.md` and impacted docs.
  - Remove tracked `scripts/__pycache__/` artifacts.
  - Document deprecation policy and removal window.
  - **Gate:** No stale script references in canonical docs.

### Phase 8 — Final verification and PR readiness

- [x] S8-C8 — Run focused verification suite (Commit 8)
  - Run docs guards, affected unit tests, and key npm checks.
  - Smoke-run pre-push installer and preflight scripts.
  - Collect final evidence and prepare PR summary.
  - **Gate:** All selected checks pass; branch ready for PR.

---

## Verification Matrix (minimum)

- Docs guards: canonical refs, doc/test sync, router parity, docs links.
- Quality guards: design system, brand compliance.
- Contract tests: unit tests asserting script-path policy.
- Dev scripts: smoke execution for bootstrap/reset wrappers.

## Rollback Policy

- If a phase fails its gate, revert only that commit and fix forward.
- Do not proceed to next phase without passing gate evidence.

## Deprecation Policy (legacy wrappers)

- Legacy paths remain active for 1-2 iterations.
- Each wrapper prints: old path deprecated, new path required.
- Remove wrappers in a dedicated follow-up PR once references are fully migrated.
