# A8. Audit & Observability Rules

- All critical actions emit structured logs.
- Logs:
  - include relevant identifiers (`document_id`, `run_id`, `candidate_id`),
  - are best-effort,
  - never block user flows.
- Audit trails (governance):
  - are immutable,
  - read-only,
  - stored separately from document data.

## A8.1 Event Type Taxonomy (Authoritative)

`event_type` must be one of the following values.

Run-level:
- `RUN_CREATED`
- `RUN_STARTED`
- `RUN_COMPLETED`
- `RUN_FAILED`
- `RUN_TIMED_OUT`
- `RUN_RECOVERED_AS_FAILED` (startup recovery of orphaned RUNNING runs)

Step-level:
- `STEP_STARTED`
- `STEP_SUCCEEDED`
- `STEP_FAILED`
- `STEP_RETRIED`

User actions:
- `DOCUMENT_UPLOADED`
- `REPROCESS_REQUESTED`
- `DOCUMENT_LANGUAGE_OVERRIDDEN`
- `MARK_REVIEWED`
- `INTERPRETATION_EDITED`

Reviewer actions:
- `GOVERNANCE_DECISION_RECORDED`
- `SCHEMA_CONTRACT_CREATED`

Rules:
- Structured logs remain best-effort and never block processing.
- Each log entry must include:
  - `document_id`
  - `run_id` (nullable only when not yet created)
  - `step_name` (nullable)
  - `event_type`
  - `timestamp`
  - `error_code` (nullable)


---
