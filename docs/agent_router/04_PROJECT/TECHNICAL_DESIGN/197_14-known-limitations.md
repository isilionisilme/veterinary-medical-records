# 14. Known Limitations

| # | Limitation | Impact | Mitigation / Roadmap |
|---|---|---|---|
| 1 | Single-process model | No horizontal scaling | ADR-ARCH-0004; worker profile (roadmap #14) |
| 2 | SQLite single-writer | Write contention | WAL + busy_timeout; PostgreSQL adapter (#17) |
| 3 | Minimal authentication boundary | Root endpoints remain open; token auth is optional and static | §13; full authN/authZ evolution (#15) |
| 4 | AppWorkspace.tsx at ~2,200 LOC (down from ~5,800) | Core orchestrator remains large after major decomposition | Iterations 3/7/8 decomposition complete (#7b); further splits are optional |
| 5 | Routes monolith concentration | Resolved: API routes split into domain modules and thin aggregator | Iteration 6 completed (#7a) |
| 6 | No rate limiting on API endpoints | Vulnerable to abuse on upload and extraction paths | Planned for Iteration 10 hardening (F16-D) |
| 7 | No DB indexes on FK-heavy joins | Full scans on `processing_runs`, `artifacts`, `document_status_history` joins | Planned for Iteration 10 hardening (F16-A) |
