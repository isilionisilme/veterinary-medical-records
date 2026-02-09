# A6. Concurrency & Idempotency Rules

- At most one `RUNNING` run per document is allowed (multiple `QUEUED` runs may exist).
- Guards must exist at persistence level (transactional or equivalent).
- Repeated user actions (upload, reprocess, mark reviewed):
  - must be safe to retry,
  - must not create inconsistent state.

---
