# 8. Error Handling & States

- Failures must be explicit and classified:
  - `UPLOAD_FAILED`
  - `EXTRACTION_FAILED`
  - `INTERPRETATION_FAILED`
  - `PROCESS_TERMINATED` (crash/restart recovery only; Appendix B1.3)

- Document status must always reflect the **last known state**.
- Failed runs remain visible and auditable.
- Stuck runs must be detectable via timeout and transitioned to `TIMED_OUT`.

---
