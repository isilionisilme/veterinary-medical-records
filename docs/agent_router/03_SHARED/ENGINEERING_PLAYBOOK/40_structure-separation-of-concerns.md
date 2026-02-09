# Structure & separation of concerns
- Keep **domain logic independent** from frameworks and infrastructure.
- FastAPI routes must act as **thin adapters only**, limited to:
  - Input validation
  - Orchestration
  - Response mapping
- **Business rules must live in domain services**, never in API handlers.
- Access persistence, file storage, and external services **only through explicit interfaces or adapters**.

---
