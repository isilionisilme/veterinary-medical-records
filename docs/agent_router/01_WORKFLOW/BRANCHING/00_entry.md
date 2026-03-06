<!-- AUTO-GENERATED from canonical source: way-of-working.md — DO NOT EDIT -->
<!-- To update, edit the canonical source and run: python scripts/docs/generate-router-files.py -->

## 2. Branching Strategy

- The default branching strategy is **Feature Branching**.
- Work is developed in **short-lived branches** on top of a stable `main` branch.
- `main` always reflects a **runnable, test-passing state**.
- **No direct commits to `main`.** All changes must go through a feature branch and a pull request.
- Each change is implemented in a dedicated branch.
- Branches are merged once the change is complete and reviewed.

### Branch Naming Conventions

Canonical format:
- `<worktree>/<category>/<slug>`

Worktree segment:
- `worktree` must match the current worktree folder name exactly.
- Expected values in this repository setup include: `veterinary-medical-records`, `veterinary-medical-records-golden-loop`, `golden-2`, `docs`.

Allowed categories:
- `feature`
- `fix`
- `docs`
- `chore`
- `refactor`
- `ci`
- `improvement`

Slug rules:
- Use lowercase letters, numbers, and hyphens.
- Keep it concise and representative of the work item.

Exemptions:
- `main` is exempt from this naming convention.
- Detached HEAD is exempt from this naming convention.

Transition policy:
- Legacy format `<category>/<slug>` is temporarily allowed during migration.
- Legacy branches must emit a warning in branch-name validation but must not be blocked.

Examples:
- `veterinary-medical-records/feature/us-42-pet-owner-export`
- `veterinary-medical-records-golden-loop/improvement/prescription-print-layout`
- `golden-2/chore/preflight-branch-name-hook`
- `docs/docs/branching-convention-refresh`

Branches must be **short-lived** and focused on a single user story or a single technical concern.

---
