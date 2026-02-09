# 5. Separation of Responsibilities (Product-Level)

The product enforces a strict separation of responsibility:

- **Veterinarians**
  - Resolve individual documents.
  - Correct and validate information locally.
  - Never manage system behavior or learning.

- **Reviewers**
  - Oversee system-level meaning and evolution.
  - Review aggregated patterns and signals.
  - Never participate in operational document workflows.

This separation is:
- intentional,
- asymmetric,
- non-negotiable.

No user is responsible for both document resolution
and system governance within the same workflow.

---
