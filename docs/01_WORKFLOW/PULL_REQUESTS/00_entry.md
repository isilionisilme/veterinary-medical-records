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
- Docs-only → `docs/01_WORKFLOW/PULL_REQUESTS/20_docs_only_pr.md`
- Code PR → `docs/01_WORKFLOW/PULL_REQUESTS/30_code_pr.md` and `docs/01_WORKFLOW/CODE_REVIEW/00_entry.md`
- Non-code, non-doc → STOP and ask whether to run a review

Also see: `docs/01_WORKFLOW/PULL_REQUESTS/10_pr_template.md`
