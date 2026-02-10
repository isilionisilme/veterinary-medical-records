# C3. Error Codes and Failure Mapping (Authoritative)

- `error_code` is step-level and recorded in the step artifact.
- `failure_type` is run-level and recorded on the run.

Mapping:
- Step `EXTRACTION` failure → run `failure_type = EXTRACTION_FAILED`
- Step `INTERPRETATION` failure → run `failure_type = INTERPRETATION_FAILED`
- Startup recovery orphaned `RUNNING` → run terminal failure with reason `PROCESS_TERMINATED`
  - Log `RUN_RECOVERED_AS_FAILED`

Rule:
- Step artifacts never overwrite previous artifacts.
- Terminal run states are immutable.

---
