# C1. Processing Step Model (Authoritative)

A `ProcessingRun` is executed as a sequence of steps. Step state is tracked as **run-scoped artifacts**:
- `artifact_type = STEP_STATUS`
- `payload` is JSON (schema below)

## C1.1 StepName (Closed Set)
- `EXTRACTION`
- `INTERPRETATION`

## C1.2 StepStatus (Closed Set)
- `NOT_STARTED`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`

## C1.3 Step Artifact Payload (JSON)
Must include:
- `step_name` (StepName)
- `step_status` (StepStatus)
- `attempt` (integer, starts at 1)
- `started_at` (nullable)
- `ended_at` (nullable)
- `error_code` (nullable)
- `details` (nullable; small JSON)

## C1.4 Append-Only Rule
- Step changes are append-only: each update is a new artifact record.
- The “current step status” is derived from the latest `STEP_STATUS` artifact for that `step_name`.

---
