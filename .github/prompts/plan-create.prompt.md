---
agent: agent
description: Create a new plan following project conventions.
---

1. Verify the backlog item exists and is `Planned` or `In Progress`; if not, STOP.
2. Create `docs/projects/veterinary-medical-records/04-delivery/plans/PLAN_<YYYY-MM-DD>_<SLUG>.md`.
3. Add the required template sections: title, operational rules pointer, metadata placeholders, `Context`, `Objective`, `Scope Boundary`, `Execution Status`, `Prompt Queue`, `Active Prompt`, `Acceptance criteria`, `How to test`.
4. In metadata, initialize `Branch` and `Worktree` as `PENDING PLAN-START RESOLUTION`; initialize `Execution Mode` and `Model Assignment` as `PENDING USER SELECTION`.
5. Reserve Phase 0 for mandatory plan-start preflight before any implementation phase.
6. Add the documentation task `DOC-1`; if docs are not needed, record `no-doc-needed` with a brief rationale.
7. Run the PR partition gate: estimate size, assess semantic risk, and open a user decision gate if thresholds indicate a split.
8. If the plan spans multiple PRs, add `## PR Roadmap` before `Execution Status` and include the integration strategy table.
9. Write pre-written prompts for every non-dependent execution block that can be prepared upfront.
10. Commit with `docs(plan): create <plan-slug>` only after the plan content is complete.
