# Architecture Decision Records (ADR) Index

This directory stores architecture decisions that shape the current system design.

## ADR table

| ID | Title | Status | Date |
|---|---|---|---|
| [ADR-ARCH-0001](ADR-ARCH-0001-modular-monolith.md) | Modular Monolith over Microservices | Accepted | 2026-02-24 |
| [ADR-ARCH-0002](ADR-ARCH-0002-sqlite-database.md) | SQLite as Primary Database | Accepted | 2026-02-24 |
| [ADR-ARCH-0003](ADR-ARCH-0003-raw-sql-repository-pattern.md) | Raw SQL with Repository Pattern (No ORM) | Accepted | 2026-02-24 |
| [ADR-ARCH-0004](ADR-ARCH-0004-in-process-async-processing.md) | In-Process Async Processing (No External Task Queue) | Accepted | 2026-02-24 |
| [ADR-EXTRACTION-0001](../extraction/ADR-EXTRACTION-0001.md) | Observability-first, triage-driven, minimal extraction fixes | Accepted | 2026-02-14 |

## Usage

- Read architecture ADRs first for high-level technical trade-offs.
- Read extraction ADRs for field-level and pipeline evolution decisions.
- Use [`docs/README.md`](../README.md) for full documentation reading order.
