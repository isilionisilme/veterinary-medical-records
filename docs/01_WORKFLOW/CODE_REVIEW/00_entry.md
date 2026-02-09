# Code Review (Entry)

This module is the operational procedure for code reviews in this repo.

## When a review is required
- Docs-only PR: no review.
- Code PR: review is required.
- Non-code, non-doc PR: STOP and ask whether to review.

## Review input
- `git diff main...HEAD`

## Review focus (maintainability-first)
1) Layering and dependency direction (domain/app/api/infra boundaries)
2) Maintainability (clear responsibilities, low duplication, cohesive units)
3) Testability (core logic testable without frameworks; integration tests for wiring)
4) Simplicity over purity (flag overengineering; prefer removing complexity)
5) CI/tooling sanity (reproducible lint/tests)

## Output format (mandatory)
Produce findings under these headings:
- Must-fix
- Should-fix
- Nice-to-have
- Questions / assumptions

Each finding includes:
- File reference(s)
- Short rationale
- Minimal suggested change

## Safety rule
After producing the review, STOP and wait for explicit user instruction before making code changes.

Next: `docs/01_WORKFLOW/CODE_REVIEW/10_review_checklist.md`
Next: `docs/01_WORKFLOW/CODE_REVIEW/20_pr_commenting.md`
