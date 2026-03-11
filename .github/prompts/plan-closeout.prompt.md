---
agent: agent
description: Close out a plan before merge.
---

1. Verify all plan steps are complete; if any remain open, present each as `Defer`, `Drop`, or `Mark complete` and STOP for user choice.
2. Verify the working tree is clean and run `git fetch --prune`.
3. Update the backlog item status to `Done`.
4. Move the plan file to `plans/completed/` without changing the filename.
5. Move the backlog artifact to `Backlog/completed/` when it exists; otherwise record `N/A`.
6. Update surrounding relative links that still point to the pre-closeout paths.
7. Run the required documentation normalization or contract checks for affected markdown files.
8. Commit with `docs(closeout): archive <plan-slug> and backlog artifacts`.
9. Push and wait for CI to turn green before reporting readiness.
10. If a PR exists, update its body with the closeout checklist.
