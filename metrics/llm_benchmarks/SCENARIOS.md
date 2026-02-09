# LLM Benchmarks — Scenarios

These scenarios are meant to be **reproducible** and **comparable** across commits.

Guidelines:
- Use the exact prompt text (or copy it verbatim) to avoid drift.
- Run benchmark prompts with `#metrics`.
- The assistant must print a final single-line block:

```text
METRICS scenario=<scenario_id> docs=<path1>|<path2>|... fallback=<int> clarifying=<int> violations=<comma-separated>
```

Notes:
- `docs=` must contain repo-relative paths separated by `|` (no spaces).
- If there are no violations, use `violations=` (empty).

---

## start_new_work

```text
#metrics
You are starting new work on this repo. Do the minimum doc reading needed to decide:
1) whether a new branch is required
2) the correct branch naming convention

Follow the repo rules. At the end, print the METRICS line with docs consulted.
```

## docs_only_pr

```text
#metrics
Assume the change only touches Markdown files under docs/. Do the minimum doc reading needed to decide:
1) how to classify the PR (docs-only vs code)
2) whether an automated code review is required

Follow the repo rules. At the end, print the METRICS line with docs consulted.
```

## code_pr

```text
#metrics
Assume the change touches files under backend/ and frontend/. Do the minimum doc reading needed to decide:
1) how to classify the PR
2) whether a code review is required and what procedure applies

Follow the repo rules. At the end, print the METRICS line with docs consulted.
```

## code_review

```text
#metrics
You are asked to perform a code review for a Code PR in this repo. Do the minimum doc reading needed to decide:
1) whether a review is mandatory
2) the required review style/output and any "publish to PR" requirements

Follow the repo rules. At the end, print the METRICS line with docs consulted.
```

## run_tests

```text
#metrics
You are asked to run tests/lint for this repo locally. Do the minimum doc reading needed to decide:
1) what commands to run
2) any rules about when tests are required

Follow the repo rules. At the end, print the METRICS line with docs consulted.
```

## ui_copy_change

```text
#metrics
Assume you are about to change user-facing UI copy in the frontend. Do the minimum doc reading needed to decide:
1) what UX rules apply
2) what Brand rules apply

Follow the repo rules. At the end, print the METRICS line with docs consulted.
```

## backend_contract_change

```text
#metrics
Assume you are about to change an API schema in backend/app/api/schemas.py. Do the minimum doc reading needed to decide:
1) what contract/architecture docs are authoritative
2) what versioning or compatibility rules apply

Follow the repo rules. At the end, print the METRICS line with docs consulted.
```

