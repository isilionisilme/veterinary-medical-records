# 5. Review & Editing Rules

UI and API MUST prevent conflicting edits while processing is active.
If a client attempts to edit/review while a `RUNNING` run exists, the API MUST respond with:
- `409 Conflict` (`error_code = CONFLICT`) and `details.reason = REVIEW_BLOCKED_BY_ACTIVE_RUN`.
 
---
