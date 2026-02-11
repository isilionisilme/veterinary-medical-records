# Pull Requests (Router)

Use this module to run the PR workflow with minimal doc reads.

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
- Code PR → `docs/agent_router/01_WORKFLOW/PULL_REQUESTS/30_code_pr.md` and `docs/agent_router/01_WORKFLOW/CODE_REVIEW/00_entry.md`
- Non-code, non-doc → STOP and ask whether to run a review

Also see: `docs/agent_router/01_WORKFLOW/PULL_REQUESTS/10_pr_template.md`
