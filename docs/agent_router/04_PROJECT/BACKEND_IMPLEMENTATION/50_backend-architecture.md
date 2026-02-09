# Backend architecture

## Layering (mandatory)
Use a modular-monolith layered architecture:

- `domain`
  - entities/value objects/invariants
  - no imports from FastAPI or infrastructure
- `application`
  - use cases and orchestration
- `ports`
  - interfaces for repos, storage, and runner/scheduler
- `infrastructure`
  - SQLite repositories, filesystem adapter, runner/scheduler
- `api`
  - FastAPI routers, request/response models, error mapping

Rules:
- Domain logic MUST be independent from infrastructure.
- Persistence invariants MUST be enforced at the persistence layer (transactional), not in memory.
