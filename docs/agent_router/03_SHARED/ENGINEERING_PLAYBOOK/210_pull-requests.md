# Pull Requests
- A pull request is opened for each user story or each technical non user-facing change (refactors, chores, CI, docs, fixes).
- Pull requests are opened once the change is fully implemented and all automated tests are passing.
- Each pull request must be small enough to be reviewed comfortably in isolation and should focus on a single user story or a single technical concern.

## Pull Request Automation (AI Assistants)

When an AI coding assistant or automation tool is used to create or update a Pull Request in this repository, it must follow this procedure automatically. This operational rule complements the existing Pull Request and Code Review policies and does not replace them.

## Pull Request Procedure

1) Confirm repository state before creating the PR:
   - Current branch name
   - Base branch (main)
   - Working tree status (report if not clean)

2) Create or update the Pull Request to `main` using the standard branching and naming conventions already defined in this document.
   - PR title, body, and review comments must be written in English.
   - When setting the PR description/body from CLI, use real multiline content (heredoc or file input), not escaped `\n` sequences.
   - Do not submit PR bodies that contain literal `\n`.
   - Preferred patterns:
     - `gh pr create --body-file <path-to-markdown-file>`
     - PowerShell here-string (`@' ... '@`) assigned to a variable and passed to `--body`

3) Check CI status (if configured):
   - Report whether CI is pending, passing, or failing.
   - Include end-user validation steps in the PR description when applicable; if not applicable, state why and provide alternative verification steps.

4) Classify the PR by file types (use changed file paths; do not require reading full diff content):
   - **Docs-only PR**: the diff contains **only**:
     - `docs/**`
     - `*.md`, `*.txt`, `*.rst`, `*.adoc`
   - **Code PR**: the diff contains **any** code file, such as:
     - `*.py`
     - `*.ts`, `*.tsx`
     - `*.js`, `*.jsx`
     - `*.css`, `*.scss`
     - `*.html`
     - `*.sql`
   - **Non-code, non-doc PR**: the diff contains files that are neither docs nor code (examples: `*.json`, `*.yaml`, `*.yml`, `*.toml`, `*.ini`, `*.env`).

5) Ask the user whether they want a code review:
   - Ask explicitly for every PR classification (docs-only, code, non-code/non-doc).
   - For docs-only PRs, recommend skipping the review by policy unless the user explicitly asks for one.
   - Run the review only after explicit user confirmation.

6) Perform a maintainability-focused code review of the PR diff (when user-approved):
   - Use `git diff main...HEAD` as the review input.
   - Apply all rules from:
     "Code Review Guidelines (Maintainability-Focused, Take-Home Pragmatic)"

## Pull Request review visibility

After producing a PR code review, the AI assistant must publish the review output as a comment in the Pull Request (or update an existing “AI Code Review” comment), using the mandatory review output format.

If one or more review findings are addressed in subsequent commits, the AI assistant must add a brief follow-up comment summarizing which findings were addressed.

If the PR changes after review (new commits that materially affect the diff), the AI assistant must add a follow-up comment summarizing what changed and whether the previous findings are still applicable.

If the AI assistant cannot post a comment to the Pull Request (for example due to missing PR reference, missing GitHub CLI access, or authentication), STOP and ask the user before proceeding. Do not treat chat-only output as satisfying the “publish to PR” requirement.

For docs-only PRs, no review comment is required (review is skipped by policy).

## Post-merge Cleanup (AI Assistants)

After the user confirms that a Pull Request has been **merged into `main`**, the AI assistant must run the following **post-merge cleanup** procedure automatically.

Only STOP and ask for confirmation if the repository state is unsafe or ambiguous (examples: uncommitted changes, rebase/merge in progress, conflicts, or unclear stash purpose/ownership).

### Post-merge cleanup checklist

1) Ensure the working tree is clean:
   - If there are uncommitted changes, STOP and ask before proceeding.
   - If a merge/rebase is in progress, STOP and ask before proceeding.

2) Check for existing stashes:
   - List stashes (`git stash list`).
   - If a stash is clearly related to the merged branch and no longer needed, delete it (`git stash drop ...`).
   - If there is any ambiguity about a stash (purpose unclear, potentially still needed), STOP and ask before deleting it.

3) Switch to `main`.

4) Pull the latest changes from `origin/main` into local `main`.

5) Delete the **local** branch that was used for the merged PR:
   - If the branch is currently checked out, switch to `main` first.
   - Try safe deletion first: `git branch -d <branch>`.
   - If deletion fails due to “not fully merged” (common with squash merges):
     - Verify the branch has **no unique commits** relative to `main` (for example: `git log <branch> --not main`).
     - If there are no unique commits, it is safe to force delete: `git branch -D <branch>`.
     - If unique commits exist, STOP and ask what to do.

By default, this procedure deletes only local state (local branches and stashes). Do not delete remote branches unless explicitly requested.
