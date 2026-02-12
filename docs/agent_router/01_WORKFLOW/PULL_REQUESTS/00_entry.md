# Pull Requests (Router)

Use this module to run the PR workflow with minimal doc reads.

## Manual trigger only: Code reviews
- Hard gate: never start a code review automatically from PR context/events.
- Review may run only after an explicit user instruction (for example: "Do a code review for PR #...", "Review the diff for ...", "Run a code review now").
- This gate takes precedence over any PR workflow step that suggests asking for or starting a review.

## Docs-only PR
- Only `docs/**` or text files: `*.md`, `*.txt`, `*.rst`, `*.adoc`

## Code PR
- Any code file such as: `*.py`, `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.css`, `*.scss`, `*.html`, `*.sql`
- Or any change under `backend/` or `frontend/`

## Non-code, non-doc PR
- Files like `*.json`, `*.yaml`, `*.yml`, `*.toml`, `*.ini`, `*.env`, or other config assets

## Actions
- Confirm repository state: current branch, base is `main`, working tree status.
- Create/update the PR targeting `main`.
- Check CI status (if configured).
- If the PR changes `frontend/**` or any user-visible UI/copy/interaction behavior:
  - load `docs/agent_router/02_PRODUCT/USER_VISIBLE/00_entry.md` before implementation/review,
  - include an explicit `UX/Brand compliance` checkpoint in the PR description with evidence.
- Docs-only → `docs/agent_router/01_WORKFLOW/PULL_REQUESTS/20_docs_only_pr.md`
- Code PR → `docs/agent_router/01_WORKFLOW/PULL_REQUESTS/30_code_pr.md` and `docs/agent_router/01_WORKFLOW/CODE_REVIEW/00_entry.md` (policy only; do not execute review unless explicitly triggered by user)
- Non-code, non-doc → do not auto-start review; continue normal PR workflow unless user explicitly requests review

Also see: `docs/agent_router/01_WORKFLOW/PULL_REQUESTS/10_pr_template.md`
