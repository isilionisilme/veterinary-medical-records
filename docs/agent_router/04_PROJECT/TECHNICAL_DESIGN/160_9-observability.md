# 9. Observability

## 9.1 Logging

The system must emit **structured logs** only.

Each log entry must include:
- `document_id`
- `run_id`
- `step_name` (if applicable)
- `event_type`
- `timestamp`
- `error_code` (if any)

Logs must be best-effort and must **never block processing**.

---

## 9.2 Future Observability

Metrics and persistent event tracing may be introduced by a future user story; the current stories rely on structured logs.

---
