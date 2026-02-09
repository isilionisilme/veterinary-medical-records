# B5. Filesystem Management Rules

- Files are stored under deterministic paths:
  - `/storage/{document_id}/original.pdf`

Note:
- Additional extensions may be introduced when non-PDF upload types are supported.

  
- Writes must be atomic.
- DB persistence must complete **before** returning success.
- Temporary files must be cleaned up on failure.

Inconsistencies:
- FS exists, DB missing → treat as invalid artifact.
- DB exists, FS missing → surface explicit error on access.

No background cleanup is required.

---
