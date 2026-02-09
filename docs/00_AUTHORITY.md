# Authority Router (Operational, Token-Optimized)

Use this file to route by **intent**. Load only the module(s) listed below.

## Intent → Module

- Start new work → `docs/01_WORKFLOW/START_WORK/00_entry.md`
- Branching or naming → `docs/01_WORKFLOW/BRANCHING/00_entry.md`
- Pull request workflow → `docs/01_WORKFLOW/PULL_REQUESTS/00_entry.md`
- Code review → `docs/01_WORKFLOW/CODE_REVIEW/00_entry.md`
- Testing → `docs/01_WORKFLOW/TESTING/00_entry.md`
- User-visible change → `docs/02_PRODUCT/USER_VISIBLE/00_entry.md`
- UX guidance → `docs/02_PRODUCT/UX/00_entry.md`
- Brand guidance → `docs/02_PRODUCT/BRAND/00_entry.md`
- Assistant benchmarks → `metrics/llm_benchmarks/README.md`
- General assistant behavior → `docs/shared/AGENTS.md`
- Fallback / unclear intent → `docs/00_FALLBACK.md`

## Rule
Load **only one** module unless it explicitly triggers another.

