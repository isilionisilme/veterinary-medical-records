# 6. Data Persistence Rules

## 6.1 General Principles

- Never overwrite extracted or structured data.
- All generated artifacts are versioned.
- History must be preserved for auditability.

---

## 6.2 Storage

- Primary database: **SQLite**
- Large artifacts (original uploaded files, raw extracted text):
  - stored in the filesystem
  - referenced from the database
- Use JSON columns where flexibility is required.

---

## 6.3 Structured Data & Versioning

- Structured interpretations are stored as **versioned records**.
- Any user edit creates a **new version**.
- Previous versions are retained.
- One interpretation version may be marked as:
  - `active`
- Structural changes (add/remove/rename field) set an internal `pending_review = true` flag (Appendix A3.2).
- Field-level change history must be tracked.

---
