# Implementation note

Keep the review experience explainable and non-blocking; introduce additional tooling only when required by a user story.

For deterministic CI and local builds, keep test/setup files out of the production TypeScript compilation scope and validate them through Vitest in the test job.

Repository operations recommendation: protect `main` and require both `quality` and `frontend_test_build` checks before merge.
