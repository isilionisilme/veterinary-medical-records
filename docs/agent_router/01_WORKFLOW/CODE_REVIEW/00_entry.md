# Code Review (Entry)

This module is the operational procedure for code reviews in this repo.

## Manual trigger only: hard gate
- Do not start a code review unless the user explicitly asks to run one.
- Explicit trigger examples: "Do a code review for PR #...", "Review the diff for ...", "Run a code review now".
- Starting a review includes: fetching PR context for review, reading diffs for review, generating formal review output/comment, suggesting review commits, or any multi-step review run.
- If review seems needed/helpful, you may propose it, but STOP and wait for explicit instruction.
- This gate takes precedence over any workflow hint that would otherwise auto-start review-related actions.

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
The PR review comment must follow this exact structure and heading names:

```md
## AI Code Review

### Must-fix
1. **<short finding title>**
   - **File:** `<path>:<line>` (or `N/A` if it is not file-specific)
   - **Why:** <short rationale>
   - **Minimal change:** <smallest concrete fix>

### Should-fix
1. **<short finding title>**
   - **File:** `<path>:<line>` (or `N/A`)
   - **Why:** <short rationale>
   - **Minimal change:** <smallest concrete fix>

### Nice-to-have
1. **<short finding title>**
   - **File:** `<path>:<line>` (or `N/A`)
   - **Why:** <short rationale>
   - **Minimal change:** <smallest concrete fix>

### Questions / assumptions
1. <question>

### UX/Brand Compliance
- **Compliant:**
  - <item>
- **Non-compliant / risk:**
  - <item>
```

Rules:
- Keep section order exactly as above.
- Number findings/questions (`1.`, `2.`, ...), do not use bullets for those lists.
- For `Must-fix` / `Should-fix` / `Nice-to-have`, every item must include all three fields: `File`, `Why`, `Minimal change`.
- `UX/Brand Compliance` is mandatory for `frontend/**` or any user-visible change. If not applicable, include:
  - `- **Compliant:**`
  - `  - N/A (non-user-visible change).`
  - `- **Non-compliant / risk:**`
  - `  - None.`

## Safety rule
After producing the review, STOP and wait for explicit user instruction before making code changes.

Next: `docs/agent_router/01_WORKFLOW/CODE_REVIEW/10_review_checklist.md`
Next: `docs/agent_router/01_WORKFLOW/CODE_REVIEW/20_pr_commenting.md`
