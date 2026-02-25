# 14. Known Limitations

| # | Limitation | Impact | Mitigation / Roadmap |
|---|---|---|---|
| 1 | Single-process model | No horizontal scaling | ADR-ARCH-0004; worker profile (roadmap #14) |
| 2 | SQLite single-writer | Write contention | WAL + busy_timeout; PostgreSQL adapter (#17) |
| 3 | Minimal authentication boundary | Root endpoints remain open; token auth is optional and static | §13; full authN/authZ evolution (#15) |
| 4 | Upload size post-read | Memory spike risk | Streaming guard (#9) |
| 5 | AppWorkspace.tsx > 500 LOC | Frontend maintainability debt | Decomposition (#7b) |
