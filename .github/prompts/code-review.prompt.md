---
agent: agent
description: Run a structured code review on a pull request.
---

1. Verify CI status before reading the diff; if CI is red, STOP and ask whether to diagnose failures first.
2. Confirm review scope from changed files, PR description, and required checks.
3. Recommend `Light`, `Standard`, `Deep`, or `Deep (critical)` review depth from the risk profile; wait for user confirmation.
4. For deep reviews, propose review lenses, run them in parallel after user confirmation, and consolidate the findings.
5. Review these focus areas: layering, maintainability, testability, simplicity, CI/tooling, database safety, UX/brand.
6. Classify findings as `Must-fix`, `Should-fix`, or `Nice-to-have` using the canonical severity criteria.
7. Output the result using the `AI Code Review` template exactly.
8. Publish the review to the pull request only when the current step or user request requires publication.
