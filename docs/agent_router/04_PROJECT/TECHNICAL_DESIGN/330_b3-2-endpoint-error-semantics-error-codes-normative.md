# B3.2 Endpoint error semantics & error codes (Normative)

This section defines **stable HTTP semantics** and `error_code` values.
It prevents user stories from redefining per-endpoint behavior.

## Error response format (Authoritative)
All error responses MUST follow Appendix **B2.6**:

- `error_code` (stable enum for frontend branching)
- `message` (safe for user display)
- `details` (optional object; must not expose secrets or filesystem paths)

## Common HTTP statuses

- `400 Bad Request`
  - Invalid request body, missing required fields, invalid parameters.
  - `error_code`: `INVALID_REQUEST`

- `404 Not Found`
  - Document or run does not exist.
  - `error_code`: `NOT_FOUND`

- `409 Conflict`
  - Request is valid, but cannot be fulfilled due to current state.
  - Examples:
    - Review requested but no completed run exists.
    - Attempt to edit when blocked by a `RUNNING` run (if applicable).
  - `error_code`: `CONFLICT`, plus a specific reason in `details.reason`.
  - Specific reasons (closed set):
    - `NO_COMPLETED_RUN`
    - `REVIEW_BLOCKED_BY_ACTIVE_RUN`
    - `RAW_TEXT_NOT_READY`
    - `RAW_TEXT_NOT_AVAILABLE`
    - `STALE_INTERPRETATION_VERSION`

- `410 Gone`
  - Persistent reference exists, but the underlying filesystem artifact is missing.
  - Applies to file downloads and raw text retrieval when stored in filesystem.
  - `error_code`: `ARTIFACT_MISSING`

- `413 Payload Too Large`
  - Upload exceeds size limit.
  - `error_code`: `FILE_TOO_LARGE`

- `415 Unsupported Media Type`
  - Unsupported upload type.
  - `error_code`: `UNSUPPORTED_MEDIA_TYPE`

- `500 Internal Server Error`
  - Unhandled exception or unexpected system failure.
  - `error_code`: `INTERNAL_ERROR`

## Notes
- Frontend MUST branch on `error_code` (and optional `details.reason`) only.
- User stories may list example error cases, but must not redefine these semantics.
- Upload type support is defined in Appendix B3 (“Supported upload types (Normative)”).


## Upload size limit (Normative)
- Maximum upload size: 20 MB (default).
- Exceeding the limit returns:
  - HTTP 413
  - `error_code = FILE_TOO_LARGE`

## GET /runs/{run_id}/artifacts/raw-text (Normative)
Returns:
- `run_id`
- `artifact_type = RAW_TEXT`
- `content_type = text/plain`
- `text` (string)

Errors:
- 404 NOT_FOUND if run does not exist
- 409 CONFLICT with `details.reason = RAW_TEXT_NOT_READY` if run exists but extraction artifact is not produced yet
- 409 CONFLICT with `details.reason = RAW_TEXT_NOT_AVAILABLE` if extraction failed or no raw-text artifact exists for the run
- 410 ARTIFACT_MISSING if the artifact reference exists but filesystem content is missing

## POST /runs/{run_id}/interpretations (Normative)
Errors (minimum):
- 404 NOT_FOUND if run does not exist
- 409 CONFLICT with `details.reason = REVIEW_BLOCKED_BY_ACTIVE_RUN` if the run is currently `RUNNING`
- 409 CONFLICT with `details.reason = STALE_INTERPRETATION_VERSION` if the client’s base version is not the active version

---
