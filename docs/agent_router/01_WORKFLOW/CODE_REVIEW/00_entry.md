# Code Review (Entry)

This module is the operational procedure for code reviews in this repo.

## When a review is required
- PR workflow: always ask the user whether they want a code review.
- If the user confirms: run the review.
- If the user declines: skip review.

## Review input
- `git diff main...HEAD`

## Review focus (maintainability-first)
1) Layering and dependency direction (domain/app/api/infra boundaries)
2) Maintainability (clear responsibilities, low duplication, cohesive units)
3) Testability (core logic testable without frameworks; integration tests for wiring)
4) Simplicity over purity (flag overengineering; prefer removing complexity)
5) CI/tooling sanity (reproducible lint/tests)
6) UX/Brand compliance for `frontend/**` or user-visible changes (against UX and Brand docs)

## Output format (mandatory)
Produce findings under these headings:
- Must-fix
- Should-fix
- Nice-to-have
- Questions / assumptions

And include:
- UX/Brand Compliance (mandatory for `frontend/**` or user-visible changes; if non-compliant, list under Must-fix)

Each finding includes:
- File reference(s)
- Short rationale
- Minimal suggested change

## Safety rule
After producing the review, STOP and wait for explicit user instruction before making code changes.

Next: `docs/agent_router/01_WORKFLOW/CODE_REVIEW/10_review_checklist.md`
Next: `docs/agent_router/01_WORKFLOW/CODE_REVIEW/20_pr_commenting.md`
