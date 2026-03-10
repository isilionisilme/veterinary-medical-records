# IMP-05 — Plan Creation Protocol Enhancements

**Status:** Planned

**Type:** Technical Improvement (non-user-facing)

**Target release:** Release 17 — Engineering quality and project governance

**PR strategy:** Single dedicated PR (canonical docs + router regeneration only)

**Technical Outcome**
Reduce plan-creation prompt overrides to a one-liner by absorbing recurring plan-authoring rules into the canonical operational documents (`plan-creation.md` and `plan-execution-protocol.md`).

**Problem Statement**
Every time a plan is created, the user must supply a long ad-hoc prompt with rules for commit checkpoints, model assignment, test gates, PR closeout, merge strategy, and PR URL tracking. Most of these rules are stable and belong in the canonical docs. Repeating them per-plan risks drift, omissions, and wasted tokens.

**Scope**

### S1 — Commit checkpoint format in plans (`plan-creation.md` §2)

Extend the existing "Required inline commit recommendation format" to prescribe the blockquote checkpoint format:

```
> 📌 **Commit checkpoint — Phase N complete.** Suggested message: `<type>(<scope>): <description>`. Run L2 tests; if red, fix and re-run until green. Then wait for user.
```

Checkpoint recommendations remain guidance (not executable checklist items), consistent with the Plan Scope Principle.

### S2 — Model Assignment as plan-start choice (`plan-execution-protocol.md` §7)

Add a new mandatory plan-start choice: **Model Assignment**.

Options:
1. **Default** — Planning agent = most-capable available model, Execution agent = standard model.
2. **Uniform** — Both roles use standard model.
3. **Custom** — User specifies per-role.

Sub-rules:
- Record the selected mode in the plan metadata as `**Model Assignment:** <selected-mode>`.
- Each step in Execution Status carries a `[Model]` tag based on a task-type criteria table.
- **Model routing rule (hard rule):** On step completion, if the next pending step's `[Model]` tag differs from the current model, STOP and tell the user: "Next step recommends [Model X]. Switch to that model and say 'continue'."

### S3 — Formalize test gates per task and per checkpoint (`plan-execution-protocol.md` §9)

Make explicit:
- After completing every task: run `scripts/ci/test-L1.ps1 -BaseRef HEAD`. Fix until green (max 2 attempts; on 3rd failure STOP and report).
- At every commit checkpoint: run `scripts/ci/test-L2.ps1 -BaseRef main`. Fix until green (max 2 attempts; on 3rd failure STOP and report).

This aligns with the existing Local Preflight Integration table but makes the per-task L1 obligation explicit (currently only "before commit" is stated).

### S4 — PR Roadmap: integration strategy table (`plan-creation.md` §5)

When `## PR Roadmap` is present, require:

1. A one-line summary stating the total number of PRs.
2. A **Merge strategy** declaration.
3. An integration table with columns: `PR | Branch | Scope | Depends on | Status | URL`.

Merge strategy definitions:

| Strategy | Rule | When to use |
|---|---|---|
| `Independent` | PRs merge to `main` in any order | PRs touch disjoint areas with no code dependency |
| `Sequential` | PR-N merges before PR-N+1; each targets `main` | PR-N+1 depends on code delivered by PR-N |
| `Stacked-rebase` | PR-N+1 branches from PR-N; after merge of PR-N, rebase PR-N+1 onto `main` | Parallel development with linear dependency |

Default: `Sequential` when any PR declares a dependency; `Independent` otherwise.

URL traceability rule: when a PR is created, update Status to `Open` and URL to the actual link. A plan with an open/merged PR whose URL column still shows `—` is a compliance failure.

For plans with a single PR, the existing `**PR:**` metadata field remains sufficient.

### S5 — PR Closeout Protocol integration (`plan-execution-protocol.md` §14)

Merge the PR Closeout Protocol into the existing Iteration Close-Out Procedure:

- In the **last PR** of a multi-PR plan, add a finalization commit that:
  1. Moves the plan folder to `plans/completed/`.
  2. Moves the backlog artifact to `Backlog/completed/` (if applicable).
  3. Updates relative links to resolve to the new `completed/` locations.
  4. States `N/A` explicitly for any non-applicable item.
- Commit message: `docs(closeout): archive <plan-slug> and backlog artifacts`.
- Intermediate PRs in a stack must NOT move artifacts to `completed/`.
- Add a closeout checklist to the PR body template.

### S6 — PR-first planning order (`plan-creation.md` §5)

Add rule: when a plan may span multiple PRs, determine PR boundaries **before** writing the Execution Status and commit checkpoints — not after. The current "evaluate post-hoc" flow risks misaligned checkpoints.

**Out of Scope**
- No changes to scripts or CI (owned by IMP-03).
- No migration of existing plans (owned by IMP-04).
- No product/API/UI changes.
- No router file edits (regenerated from canonical sources).

**Acceptance Criteria**
- `plan-creation.md` includes commit checkpoint format, integration strategy table, merge strategy definitions, URL traceability rule, and PR-first planning order.
- `plan-execution-protocol.md` includes Model Assignment plan-start choice with routing rule, formalized L1/L2 test gates per task/checkpoint with retry limits, and expanded close-out procedure with PR Closeout Protocol.
- A new plan created after these changes requires no ad-hoc prompt overrides beyond "Create the plan for the attached document."
- Router files regenerated from updated canonical sources pass doc-contract tests.

**Validation Checklist**
- Create a test plan using only the one-line prompt and verify all six scope items are produced by the agent without additional prompting.
- Verify `## PR Roadmap` contains integration table and merge strategy when multi-PR.
- Verify model tags appear on every execution step.
- Verify commit checkpoints use the prescribed blockquote format.
- Verify close-out procedure covers artifact archival for the last PR only.
- Doc-contract and link tests pass after changes.

**Risks and Mitigations**
- Risk: over-prescribing plan format reduces agent flexibility.
  - Mitigation: rules define minimum structure, not exhaustive content. Optional sections remain optional.
- Risk: model routing rule causes frequent stops in small plans.
  - Mitigation: the "Uniform" option eliminates routing stops when not needed.
- Risk: merge strategy definitions may not cover future GitHub features (merge queues, etc.).
  - Mitigation: "Custom" escape hatch; definitions can be extended later.

**Dependencies**
- Should land after or with IMP-01 (canonical policy alignment) so the base documents are stable.
- Independent of IMP-02 (router sync) and IMP-03 (CI guards).

---
