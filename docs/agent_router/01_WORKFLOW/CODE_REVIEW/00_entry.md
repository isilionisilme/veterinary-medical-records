<!-- AUTO-GENERATED from canonical source: way-of-working.md — DO NOT EDIT -->
<!-- To update, edit the canonical source and run: python scripts/docs/generate-router-files.py -->

## 6. Code Review Workflow

### Manual trigger only (hard rule)

Code reviews run **only** when explicitly requested by the user. Never start a code review automatically.

### CI prerequisite (hard rule)

Before starting a code review, the agent must verify CI status:
- **CI in progress:** wait for it to complete before proceeding.
- **CI green:** proceed with the review.
- **CI red:** do NOT start the review. Inform the user that CI is failing and ask whether they want the agent to diagnose and fix the failures first. Only start the review after CI is green.

### Review Depth

When suggesting or starting a review, the agent recommends a depth level based on the Pull Request's risk profile. The user confirms, adjusts, or overrides before the review begins.

| Depth | When to recommend | Parallel lenses | What it covers |
|-------|-------------------|:---:|----------------|
| **Light** | Docs-only, config changes, formatting, simple renames | 1 | Correctness, consistency, no regressions |
| **Standard** | Normal code changes | 1 | Full review focus (all 7 areas below) |
| **Deep** | Security-sensitive, data-loss risk, architectural changes, critical user paths | 2 | Two parallel reviews with different lenses |
| **Deep (critical)** | User requests it, or agent recommends when security + architecture + data concerns overlap | 3 | Two parallel reviews with different lenses |

**Deep / Deep (critical) review Procedure:**

1. The orchestrating agent proposes review lenses based on context (e.g., maintainability-first + security-first, or architecture-first + regression-first + data-integrity-first). The user confirms or adjusts the lenses before the reviews start.
2. Each lens runs as an independent sub-agent in parallel.
3. Each sub-agent publishes its own findings as a **separate Pull Request comment**, tagged with the lens name (e.g., `## Code Review — Security-First Lens`). This ensures all raw findings are permanently recorded.
4. After all sub-agent reviews are posted, a **consolidation agent** reads all review comments and publishes a final **consolidated review comment** that:
   - Deduplicates equivalent findings across lenses.
   - Assigns the highest severity when lenses disagree.
   - Uses the standard Review Output Format.
   - References the original lens comments for traceability.

### Review Focus (maintainability-first)

### Pre-review checklist

Pre-review gate (required before diff reading):

Before reading the diff, complete a pre-review checklist:
- Confirm scope and changed paths.
- Confirm CI status and required checks.
- Confirm risk profile and review depth.

1. **Layering and dependency direction** — `domain/` has no framework/db imports; `application/` depends only on `domain/` + `ports/`; `api/` is thin; `infra/` is persistence/IO only.
2. **Maintainability** — clear naming, low duplication, cohesive modules, correct layer placement.
3. **Testability** — core logic testable without frameworks; unit + integration tests.
4. **Simplicity over purity** — flag overengineering; prefer removing complexity.
5. **CI/tooling sanity** — reproducible lint/tests, justified dependency/config changes.
6. **Database migrations/schema safety** — reversible or explicit rollback plan, no unintended data loss.
7. **UX/Brand compliance** — for `frontend/**` or user-visible changes.

### Severity Classification

Compatibility note: this section is also referenced as **Severity classification criteria** in legacy router contracts.

| Severity | Criteria | Blocks merge? |
|----------|----------|:---:|
| **Must-fix** | Incorrect behavior, security vulnerability, broken contract, layer violation, missing tests for changed behavior, data-loss risk | Yes |
| **Should-fix** | Naming/structure that obscures intent, duplicated logic, missing error handling, documentation drift | No (with acceptance) |
| **Nice-to-have** | Style improvements, small readability refinements, simplification ideas | No |

### Review Output Format

The PR comment must follow the `AI Code Review` template exactly.

Mandatory rules:
- Title: `## AI Code Review` (or `## AI Code Review — <Lens>` for deep lens comments).
- Sections in this order: Must-fix, Should-fix, Nice-to-have, Questions / assumptions, Pre-existing issues, UX/Brand Compliance.
- If a section has no findings, use `1. **None**`.
- Findings in Must-fix/Should-fix/Nice-to-have must include `File`, `Why`, and `Minimal change`.
- Findings in Pre-existing issues must include `File`, `Why`, and `Suggested follow-up`.
- UX/Brand Compliance must always include both `Compliant` and `Non-compliant / risk`.

Template:

```text
