# Way of Working

> **Canonical source of truth.**
> This document is the single authoritative reference for all operational workflow rules in this project.
>
> **Governance:**
> - This file is a canonical document maintained by humans.
> - Router files under `docs/agent_router/` are derived outputs generated from this canonical source.
> - Flow is **canonical → router only**. Router files MUST NOT be edited directly.
> - Any direct edit to a router file may be overwritten during the next regeneration cycle.

---

## Purpose

This document defines the **mandatory operational workflow** for all contributors (human and AI).
It covers the full lifecycle: starting work → branching → committing → preflight → pull request → code review → merge → done.

---

## 1. Starting New Work (Branch First)

Before making any new changes (code, docs, config, etc.), create a new branch off the appropriate base (default: `main`) using the branch naming conventions defined below.

**STOP** and ask for confirmation only if the repository state is unsafe or ambiguous (examples: uncommitted changes, merge/rebase in progress, conflicts, or it is unclear whether the current branch already corresponds to the intended work item).

### Procedure

1. Confirm repository state is safe:
   - Working tree is clean (no uncommitted changes).
   - No merge/rebase in progress.
   - If not safe, STOP and ask before proceeding.
2. Ensure the correct base branch:
   - Default base is `main` unless the user explicitly specifies another base.
   - Switch to base and update it (`git switch main` then `git pull origin main`).
3. Create the branch before editing any files:
   - If already on a correctly named branch for the same work item, proceed.
   - Otherwise, create a new branch from the updated base (`git switch -c <branch-name>`).
   - If it is ambiguous whether the current branch is the correct work branch, STOP and ask.

---

## 2. Branching Strategy

- The default branching strategy is **Feature Branching**.
- Work is developed in **short-lived branches** on top of a stable `main` branch.
- `main` always reflects a **runnable, test-passing state**.
- Each change is implemented in a dedicated branch.
- Branches are merged once the change is complete and reviewed.

### Branch Naming Conventions

**User stories:**
- `feature/<ID>-<short-representative-slug>`
- The slug must be concise and describe the purpose of the user story.

**User-facing improvements (to previous implementations):**
- `improvement/<short-slug>`

**Technical non-user-facing work:**
- `refactor/<short-slug>`
- `chore/<short-slug>`
- `ci/<short-slug>`
- `docs/<short-slug>`
- `fix/<short-slug>`

Branches must be **short-lived** and focused on a single user story or a single technical concern.

---

## 3. Commit Discipline

- Commits are **small** and scoped to a **single logical change**.
- A commit must **never** span multiple user stories.
- A change may be implemented through **multiple commits**.
- Commit history must remain **readable** to support reasoning and review.

### Commit Message Conventions

**User stories:**
- `Story <ID>: <short imperative description>`

**Technical work:**
- `<type>: <short imperative description>`
- Allowed types: `refactor`, `chore`, `ci`, `docs`, `test`, `build`, `fix`

Commit messages must be clear, specific, and written in **imperative form**.
Each commit should represent a **coherent logical step**.

---

## 4. Local Preflight Levels

Use the local preflight system with three levels before pushing changes.

### L1 — Quick (before commit)

- Entry points: `scripts/ci/test-L1.ps1` / `scripts/ci/test-L1.bat`
- Purpose: catch obvious lint/format/doc guard failures with minimal delay.

### L2 — Push (before every push)

- Entry points: `scripts/ci/test-L2.ps1` / `scripts/ci/test-L2.bat`
- Frontend checks run only when frontend-impact paths changed, unless `-ForceFrontend` is provided.
- Enforced by git hook: `.githooks/pre-push`.

### L3 — Full (before PR creation/update)

- Entry points: `scripts/ci/test-L3.ps1` / `scripts/ci/test-L3.bat`
- Runs path-scoped backend/frontend/docker checks by default.
- Use `-ForceFull` to execute full backend/frontend/docker scope regardless of diff.
- Use `-ForceFrontend` to force frontend checks even when frontend-impact paths did not change.
- E2E runs only for frontend-impact changes, unless `-ForceFrontend` or `-ForceFull` is provided.

### Preflight Rules

- For interactive local commits, run **L1** by default.
- Before every `git push`, **L2** must run (automatically via pre-push hook).
- Before opening/updating a PR, run **L3**.
- L3 runs path-scoped by default for day-to-day development branches.
- Before merge to `main`, verify CI is green. Local L3 is not required when CI has already passed — CI runs a superset of L3 checks (including Docker and E2E).
- If a level fails, **STOP** and resolve failures (or explicitly document why a failure is unrelated/pre-existing).

### Auto-Fix Policy

- The assistant must attempt focused fixes automatically before proceeding.
- Auto-fixes must stay within the current change scope and avoid unrelated refactors.
- Maximum automatic remediation loop: **2 attempts** (fix + rerun the failed level).
- **Never bypass quality gates** (`--no-verify`, disabling tests/checks, weakening assertions) to force a pass.
- If failures persist after the limit, STOP and report root cause, impacted files, and next-action options.

---

## 5. Pull Request Workflow

- A pull request is opened for each user story or each technical non-user-facing change.
- Pull requests are opened once the change is **fully implemented** and **all automated tests are passing**.
- Each pull request must be small enough to be reviewed comfortably in isolation and should focus on a **single user story or a single technical concern**.

### PR Title Conventions

**User stories:**
- `Story <ID> — <Full User Story Title>`

**Technical work:**
- `<type>: <short description>`

### PR Body Requirements

- PR title, body, and review comments must be written in **English**.
- When setting the PR description/body from CLI, use real multiline content (heredoc or file input), not escaped `\n` sequences.
- Preferred patterns:
  - `gh pr create --body-file <path-to-markdown-file>`
  - PowerShell here-string assigned to a variable and passed to `--body`

### PR Classification

Classify the PR by file types:

| Type | File patterns |
|------|--------------|
| **Docs-only** | `docs/**`, `*.md`, `*.txt`, `*.rst`, `*.adoc` only |
| **Code** | Any `*.py`, `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.css`, `*.scss`, `*.html`, `*.sql` |
| **Non-code, non-doc** | `*.json`, `*.yaml`, `*.yml`, `*.toml`, `*.ini`, `*.env` |

### PR Procedure

1. Confirm repository state (branch, base, working tree).
2. Create/update the PR targeting `main`.
3. Run local L3 preflight before PR creation/update.
4. Check CI status (pending, passing, or failing).
5. For PRs that change `frontend/**` or user-visible behavior:
   - Review canonical UX/brand sources before implementation/review.
   - Add a `UX/Brand compliance` section to the PR description.
6. Include end-user validation steps when applicable.

### Plan-Level PR Roadmap

When a plan spans multiple PRs, it must include a **PR Roadmap** section:
- Table with columns: **PR**, **Rama**, **Fases**, **Alcance**, **Depende de**.
- Each phase belongs to exactly one PR.
- Each execution step carries a `**[PR-X]**` tag.
- A PR is merged only when all its assigned phases pass CI and user review.

### Post-Merge Cleanup

After a PR is merged into `main`:
1. Ensure the working tree is clean.
2. Check for stashes related to the merged branch; clean up where safe.
3. Switch to `main` and pull latest changes.
4. Delete the local branch (safe deletion first; force-delete only if verified no unique commits).
5. Do NOT delete remote branches unless explicitly requested.

---

## 6. Code Review Workflow

### Manual trigger only (hard rule)

Code reviews run **only** when explicitly requested by the user. Never start a code review automatically.

For docs-only PRs, review is skipped by policy unless the user explicitly requests one.

### Review Focus (maintainability-first)

1. **Layering and dependency direction** — `domain/` has no framework/db imports; `application/` depends only on `domain/` + `ports/`; `api/` is thin; `infra/` is persistence/IO only.
2. **Maintainability** — clear naming, low duplication, cohesive modules, correct layer placement.
3. **Testability** — core logic testable without frameworks; unit + integration tests.
4. **Simplicity over purity** — flag overengineering; prefer removing complexity.
5. **CI/tooling sanity** — reproducible lint/tests, justified dependency/config changes.
6. **Database migrations/schema safety** — reversible or explicit rollback plan, no unintended data loss.
7. **UX/Brand compliance** — for `frontend/**` or user-visible changes.

### Severity Classification

| Severity | Criteria | Blocks merge? |
|----------|----------|:---:|
| **Must-fix** | Incorrect behavior, security vulnerability, broken contract, layer violation, missing tests for changed behavior, data-loss risk | Yes |
| **Should-fix** | Naming/structure that obscures intent, duplicated logic, missing error handling, documentation drift | No (with acceptance) |
| **Nice-to-have** | Style improvements, small readability refinements, simplification ideas | No |

### Review Output Format

Every review must use the mandatory format with sections (in order):
1. Must-fix
2. Should-fix
3. Nice-to-have
4. Questions / assumptions
5. Pre-existing issues
6. UX/Brand Compliance

Each finding includes: **File**, **Why**, **Minimal change**.

### Review Publication

- The review MUST be published as a PR comment.
- A review is not complete until the PR comment is posted and the URL is returned.
- Follow-up comments are required when findings are addressed in subsequent commits.

### Safety Rule

After producing a review, **STOP** and wait for explicit user instruction before making code changes.

### Pre-Existing Issues

Issues that clearly predate the PR:
- Do NOT classify as Must-fix for the current PR.
- Report in a separate "Pre-existing issues" section.
- Recommend a follow-up issue when impact is significant.

### Large Diff Policy

If the PR diff exceeds ~400 lines of non-generated code:
- Report a Should-fix noting reduced review confidence.
- Suggest a split strategy when visible.
- Continue the review with stated confidence limitations.

---

## 7. Delivery Model

- Work is delivered using **vertical slices**, referred to as **releases**.
- A release represents a **complete increment of user-facing value**.
- A release may span multiple user stories across different epics.
- Each release must be **coherent, end-to-end, and meaningful** from a user perspective.
- Releases must NOT be isolated technical components.

Each release must result in:
- A runnable and testable system state
- Clear, observable user-facing behavior
- Explicitly persisted data and state transitions
- Automated test coverage for the delivered functionality

---

## 8. User Story Kickoff Checklist

Before implementing each user story (US-XX):

1. Read the story requirements and relevant authoritative design requirements.
2. Identify **decision points** not explicitly specified (e.g., file size limits, storage roots, timeout values, retry counts, error code enums, default configuration values).
3. Resolve **discoverable facts** by inspecting the repository first (code/config/docs). Do not ask the user questions that can be answered by reading the repo.
4. Ask the user to confirm or choose for **non-discoverable preferences/tradeoffs**. Present 2–4 meaningful options and recommend a default. Do not proceed while any high-impact ambiguity remains; **STOP and ask**.
5. Record the resulting decisions/assumptions explicitly in the PR description (and/or ADR-style note when requested).

---

## 9. Definition of Done

A change is considered done when it satisfies the criteria that apply to its type.

### For user stories

- It delivers a **complete vertical slice** of user-facing value.
- It is documented (README and/or ADR if a design decision was made).
- If user-visible behavior is affected, UX guidance is applied.
- If visual identity or user-facing copy is affected, brand guidance is applied.
- When the story is completed, the implementation plan is updated with `**Status**: Implemented (YYYY-MM-DD)`.

### For technical non-user-facing changes

- The change intent and scope are explicitly documented in the Pull Request.
- Behavior is preserved, or any intended behavior change is clearly explained and justified.

### For all changes

- The resulting code remains easy to understand, extend, and evolve.
- Automated tests pass, and test coverage is updated where applicable.
- For any testable change, the final response must include **clear step-by-step validation instructions** from the end-user point of view.
- When end-user testing is not possible, explicitly state that and provide the best alternative verification method.
- The change is merged into `main` via Pull Request.
- CI has run and passed successfully.
- `main` remains in a **green (passing)** state after the merge.

---

## 10. Execution Rule

- Always prefer completing a **smaller, well-defined** user story over partially implementing a larger one.
- Validate every implementation explicitly against the **Definition of Done**.
- Do not bypass reviews, tests, or workflow rules to accelerate delivery.
