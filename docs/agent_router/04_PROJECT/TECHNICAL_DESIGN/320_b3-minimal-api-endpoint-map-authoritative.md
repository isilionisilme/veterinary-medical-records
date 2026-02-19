# B3. Minimal API Endpoint Map (Authoritative)

This section defines the **minimum endpoint surface**.

---

## Document-Level

- `POST /documents/upload`
  - Upload a document (PDF only in the current implementation).
- `GET /documents`
  - List documents with derived status.
- `GET /documents/{id}`
  - Document metadata + latest run info.
- `GET /documents/{id}/download`
  - Download (and when supported, preview) the original uploaded file.
- `POST /documents/{id}/reprocess`
  - Create new processing run.
- `POST /documents/{id}/reviewed`
  - Mark as reviewed.
- `PATCH /documents/{id}/language`
  - Set or clear a document-level language override (affects subsequent runs only).
- `GET /documents/{id}/processing-history`
  - Read-only processing history (runs + step statuses).

## Supported upload types (Normative)

The system MUST accept only PDF uploads in the current implementation:
- `.pdf`
- `application/pdf`

Rules:
- Any other content type MUST return:
  - HTTP 415
  - `error_code = UNSUPPORTED_MEDIA_TYPE`
- MIME type detection MUST be based on server-side inspection, not only filename.

---

## Run / Review

- `GET /documents/{id}/review`
  - Returns:
    - latest completed run,
    - active interpretation,
    - confidence and evidence.
- `GET /runs/{run_id}/artifacts/raw-text`
  - Retrieve extracted text.
- `POST /runs/{run_id}/interpretations`
  - Apply veterinarian edits by creating a new interpretation version (append-only).

Rules:
- Status views use **latest run**.
- Review views use **latest completed run**.

---

## Reviewer / Governance (Reviewer-facing only)

- `GET /reviewer/structural-changes`
  - List pending structural change candidates.
- `POST /reviewer/structural-changes/{candidate_id}/decision`
  - Record a governance decision (approve/reject/defer).
- `GET /reviewer/schema/current`
  - Retrieve the current canonical schema version.
- `GET /reviewer/governance/audit-trail`
  - Retrieve append-only governance decision history.

---

## B3.1 Run Resolution per Endpoint (Authoritative)

- `GET /documents`
  Returns each document with:
  - derived `document_status` (from latest run; Appendix A),
  - `latest_run_id`, `latest_run_state` (nullable if none exists),
  - `latest_run_failure_type` (nullable),
  - `latest_run_language_used` (nullable),
  - `latest_run_schema_version_used` (nullable).

- `GET /documents/{id}`
  Returns:
  - document metadata,
  - derived `document_status`,
  - `latest_run` summary (id, state, timestamps, failure_type, language_used, schema_version_used).
  - `language_override` (nullable).

- `GET /documents/{id}/review`
  Resolves **latest completed run**:
  - if none exists, return an explicit error (e.g., 409) with reason `NO_COMPLETED_RUN`.
  
Rationale (authoritative):
- `/documents/{id}/review` is a derived “review view” that requires a completed run; if none exists yet, this is a **state conflict**, not a missing resource.

  Returns:
  - `latest_completed_run_id`,
  - active interpretation for that run,
  - confidence + evidence.

Rule:
- Status views always use **latest run**.
- Review views always use **latest completed run**.

### Response shape (minimum, normative)
`GET /documents/{id}/review` returns:
- `document_id`
- `latest_completed_run`: { `run_id`, `state`, `completed_at`, `failure_type` }
- `active_interpretation`: { `interpretation_id`, `version_number`, `data` }
- `raw_text_artifact`: { `run_id`, `available`: boolean }  (do not inline raw text here)

### Field Candidate Suggestions (standard review payload)
- Contract location:
  - Candidate suggestions are included inside `active_interpretation.data.fields[]` entries in the standard review payload.
  - The field is optional for backward compatibility.

- Field-level shape (normative):
  - Each `StructuredField` MAY include `candidate_suggestions`.
  - `candidate_suggestions` is an array with max length `5`.
  - Items are ordered by `confidence` descending; tie-breaking MUST be deterministic.
  - Candidate item shape:
    - `value` (string)
    - `confidence` (number in `[0,1]`)
    - `evidence` (optional object)
      - `page` (optional integer)
      - `snippet` (optional string)

- Behavior:
  - `candidate_suggestions` is part of the standard payload and is not debug-only.
  - Clients MAY ignore `candidate_suggestions`.
  - If no candidates exist for a field, `candidate_suggestions` SHOULD be omitted.

- Constraints:
  - This extension does not change confidence composition or semantics.
  - This extension does not require frontend-side confidence computation changes.

---

## Processing history endpoint (minimum, normative)
`GET /documents/{id}/processing-history` returns:
- `document_id`
- `runs[]` ordered by `created_at` ascending (chronological)
  - `run_id`
  - `state`
  - `failure_type` (nullable)
  - `started_at` (nullable)
  - `completed_at` (nullable)
  - `steps[]` (derived from STEP_STATUS artifacts; Appendix C)
    - `step_name`
    - `step_status`
    - `attempt`
    - `started_at` (nullable)
    - `ended_at` (nullable)
    - `error_code` (nullable)

Rules:
- Read-only; does not introduce actions.
- Uses persisted artifacts as the source of truth (Appendix C4).

---

## Language override endpoint (minimum, normative)
`PATCH /documents/{id}/language`:
- Request body:
  - `language_override` (string ISO 639-1 like `"en"`, or `null` to clear)
- Response body includes:
  - `document_id`
  - `language_override` (nullable)

Rules:
- Does not trigger processing or reprocessing.
- Affects only **new** runs created after the override is set.
- Must not block review or editing workflows.

---

## Interpretation edit endpoint (minimum, normative)
`POST /runs/{run_id}/interpretations` creates a new, active interpretation version for the run (append-only).

Request body (minimum):
- `base_version_number` (integer; must match the currently active version number)
- `changes[]`
  - `op` (`ADD | UPDATE | DELETE`)
  - `field_id` (uuid; required for `UPDATE | DELETE`)
  - `key` (string; required for `ADD`)
  - `value` (string|number|boolean|null; required for `ADD | UPDATE`)
  - `value_type` (string; required for `ADD | UPDATE`)

Response body (minimum):
- `run_id`
- `interpretation_id`
- `version_number` (new active version number)
- `data` (Structured Interpretation Schema v0; Appendix D)

Rules:
- Human edits MUST produce `origin = "human"` fields (Appendix D) and append `FieldChangeLog` entries (B2.5).
- This endpoint never mutates existing interpretation versions (Appendix A3).

---

## Reviewer governance endpoints (minimum, normative)

`GET /reviewer/structural-changes` returns:
- `items[]`
  - `candidate_id`
  - `change_type`
  - `source_key` (nullable)
  - `target_key`
  - `occurrence_count`
  - `status`
  - `evidence_samples` (JSON; page + snippet + optional document reference)
  - `created_at`
  - `updated_at`

`POST /reviewer/structural-changes/{candidate_id}/decision`:
- Request body (minimum):
  - `decision_type` (`APPROVE | REJECT | DEFER | FLAG_CRITICAL`)
  - `reason` (nullable)
- Response body (minimum):
  - `decision_id`
  - `candidate_id` (nullable)
  - `decision_type`
  - `schema_version_id` (nullable)
  - `created_at`

`GET /reviewer/schema/current` returns:
- `schema_version_id`
- `version_number`
- `created_at`
- `change_summary` (nullable)

`GET /reviewer/governance/audit-trail` returns:
- `items[]` ordered by `created_at` ascending
  - `decision_id`
  - `candidate_id` (nullable)
  - `decision_type`
  - `schema_version_id` (nullable)
  - `reviewer_id`
  - `reason` (nullable)
  - `created_at`


---
