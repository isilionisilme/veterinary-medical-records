# Authority Router (Operational, Token-Optimized)

Use this file to route by **intent**. Load only the module(s) listed below.

## Intent → Module

- Start new work → `docs/agent_router/01_WORKFLOW/START_WORK/00_entry.md`
- Branching or naming → `docs/agent_router/01_WORKFLOW/BRANCHING/00_entry.md`
- Pull request workflow → `docs/agent_router/01_WORKFLOW/PULL_REQUESTS/00_entry.md`
- Code review → `docs/agent_router/01_WORKFLOW/CODE_REVIEW/00_entry.md`
- Testing → `docs/agent_router/01_WORKFLOW/TESTING/00_entry.md`
- Documentation updates → `docs/01_WORKFLOW/DOC_UPDATES/00_entry.md`
- User-visible change → `docs/agent_router/02_PRODUCT/USER_VISIBLE/00_entry.md`
- Engineering standards (shared) → `docs/agent_router/03_SHARED/00_entry.md`
- Project design / requirements / contracts → `docs/agent_router/04_PROJECT/00_entry.md`
- Assistant benchmarks → `metrics/llm_benchmarks/README.md`
- Fallback / unclear intent → `docs/agent_router/00_FALLBACK.md`

## Rule
Load **only one** module unless it explicitly triggers another.
