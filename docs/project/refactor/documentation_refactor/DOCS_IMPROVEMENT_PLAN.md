# Documentation Improvement Plan (agent handoff between chats)

## Objective
Audit, restructure, and standardize canonical documentation (`docs/project/*`, `docs/shared/*`, `docs/README.md`) using an iterative, low-risk workflow with explicit user checkpoints after each skill.

## Scope Boundary (strict)
- **In scope:** canonical human documentation (`docs/project/`, `docs/shared/`, `docs/README.md`).
- **Out of scope:** assistant routing modules (agent instructions, not wiki content).
- **Exception:** Broken Link Checker (#2) and Terminology Enforcer (#5) can run across wiki + router when explicitly required.
- **Out of scope:** application code (`backend/`, `frontend/`).

## Improvement Categories

### Structure and navigation
- Information Architecture Optimizer (#7)
- Template Normalizer (#8)
- Wiki Navigation Builder (#9)

### Format and Markdown standardization
- Markdown Lint Auto-Fixer (#10)
- Markdown Formatter / Prettier (#11)
- Frontmatter/Metadata Validator (#12)

### Documentation audit and quality
- Docs QA Auditor (#1)
- Broken Link & Anchor Checker (#2)
- Duplicate & Stale Content Detector (#3)

### Readability and style
- Readability Refiner (#4)
- Terminology & Glossary Enforcer (#5)

### Maintenance and automation
- Docs PR Gatekeeper / CI QA (#13)

---

## Operational Guardrails

### "Continúa" protocol
Open a new chat → select the indicated agent → attach this file → type `Continúa`.
The agent reads Execution State, executes **only** the next unchecked step, and stops.

### Automation legend
- 🔄 **auto-chain** — Codex executes; user reviews afterward.
- 🚧 **hard-gate** — Claude step requiring user decision/approval.

### Agent identity check (hard rule)
If the next `[ ]` step belongs to a different agent than the active chat: **STOP immediately** and hand off to the correct agent.

### Plan-edit-last (hard rule)
Never mark `[x]` until implementation is complete, validated, and committed.

### Continúa-only rule
If user writes `Continúa` plus extra instructions, execute only the plan step. Ask user to update the plan first for scope changes.

### Extended execution labels
- Pending: `- [ ] ...`
- In progress: `- [ ] ... ⏳ IN PROGRESS (<agent>, <date/time>)`
- Blocked: `- [ ] ... 🚫 BLOCKED (<reason>)`
- Completed: `- [x] ...`

### Two-commit strategy
1. Commit implementation changes (plan untouched).
2. Commit plan update (`[ ]` → `[x]`) separately.

### CI gate (hard rule)
No step is complete until CI is green after push.

### PR progress tracking (hard rule)
- Keep exactly one active PR for this docs stream.
- At each completed step, update this plan with:
  - PR number
  - last commit SHA
  - CI status
  - remaining unchecked steps
- If PR does not exist yet, create it as soon as D0-A is complete.
- If PR exists, append progress in the PR description/checklist.

### Mandatory handoff at step close
Always end with explicit next-chat instructions naming the exact next agent.
- Codex handoff: open new chat → choose **GPT-5.3-Codex** → attach this file → type `Continúa`.
- Claude handoff: open new chat → choose **Claude Opus 4.6** → attach this file → type `Continúa`.

### Commit convention
`docs(<skill-id>): <short description>`

---

## Execution State — update upon completing each step

### Phase 0 — Bootstrap
- [ ] D0-A 🔄 — Install doc tooling (`markdownlint-cli2`, `markdown-link-check`, `doctoc`), add/adjust root config (`.markdownlint.yml`, `.markdown-link-check.json`, Prettier Markdown scope), and add docs scripts. (Codex)
- [ ] D0-B 🚧 — User review + approve bootstrap changes. (Claude)
- [ ] D0-C 🚧 — Create/confirm docs PR from `docs/documentation-refactor`, initialize PR progress tracking section. (Claude)

### Phase 1 — Structure and navigation
#### Skill #7 — Information Architecture Optimizer
- [ ] D1-A 🚧 — Build current-state inventory of canonical docs (type, audience, owner/status if available). (Claude)
- [ ] D1-B 🚧 — Propose target taxonomy and folder hierarchy; user approves/edits. (Claude)
- [ ] D1-C 🔄 — Migrate files to approved structure and update internal links. (Codex)
- [ ] D1-D 🚧 — User validation of migrated structure and content integrity. (Claude)

#### Skill #8 — Template Normalizer
- [ ] D1-E 🚧 — Define templates per doc type (guide, reference, ADR, audit, plan, etc.). (Claude)
- [ ] D1-F 🚧 — User approval of templates. (Claude)
- [ ] D1-G 🔄 — Normalize existing docs to selected templates. (Codex)
- [ ] D1-H 🚧 — User validation of normalized docs. (Claude)

#### Skill #9 — Wiki Navigation Builder
- [ ] D1-I 🔄 — Build sitemap/TOCs/breadcrumbs for canonical docs. (Codex)
- [ ] D1-J 🚧 — User validation of navigation quality. (Claude)

### Phase 2 — Format and Markdown standardization
#### Skill #10 + #11
- [ ] D2-A 🔄 — Run markdown lint autofix + prettier write on docs scope. (Codex)
- [ ] D2-B 🚧 — User review formatting diff. (Claude)

#### Skill #12
- [ ] D2-C 🚧 — Define frontmatter schema(s) and validation approach. (Claude)
- [ ] D2-D 🔄 — Apply frontmatter + implement validator. (Codex)
- [ ] D2-E 🚧 — User review metadata correctness. (Claude)

#### Skill #2
- [ ] D2-F 🔄 — Run broken link/anchor checks and produce report. (Codex)
- [ ] D2-G 🔄 — Fix broken links/anchors. (Codex)

### Phase 3 — Documentation audit and quality
#### Skill #1
- [ ] D3-A 🚧 — Full docs QA audit against current codebase reality. (Claude)
- [ ] D3-B 🚧 — User prioritizes findings (now vs later). (Claude)
- [ ] D3-C 🔄 — Implement approved corrections. (Codex)

#### Skill #3
- [ ] D3-D 🚧 — Detect duplicate/stale content and produce consolidation report. (Claude)
- [ ] D3-E 🚧 — User approves consolidation decisions. (Claude)
- [ ] D3-F 🔄 — Apply consolidation/deprecation updates. (Codex)

### Phase 4 — Readability and style
#### Skill #4
- [ ] D4-A 🚧 — Readability analysis and prioritized report. (Claude)
- [ ] D4-B 🚧 — Rewrite for clarity/scannability without changing meaning. (Claude)
- [ ] D4-C 🚧 — User validation of rewritten technical content. (Claude)

#### Skill #5
- [ ] D4-D 🚧 — Define canonical glossary and approved terminology. (Claude)
- [ ] D4-E 🚧 — User approval of glossary. (Claude)
- [ ] D4-F 🔄 — Apply terminology consistency updates across scope. (Codex)

### Phase 5 — Maintenance and automation
#### Skill #13
- [ ] D5-A 🚧 — Design docs QA CI pipeline (wiki/router profiles as needed). (Claude)
- [ ] D5-B 🔄 — Implement CI workflow + script wiring + pre-commit integration if in scope. (Codex)
- [ ] D5-C 🚧 — User verifies expected pass/fail behavior in CI. (Claude)

### Closure
- [ ] D6-A 🚧 — Final smoke review and acceptance decision for merge readiness. (Claude)

---

## PR Progress Tracking
- **Active branch:** `docs/documentation-refactor`
- **PR number:** _TBD_
- **PR URL:** _TBD_
- **Last completed step:** _None_
- **Last commit SHA:** _TBD_
- **Latest CI status:** _TBD_
- **Open steps count:** 28

Update this section after every completed step.

---

## Audit Results (source of truth)

### D1-A — Document inventory
_To be filled when D1-A is completed._

### D1-B — Approved taxonomy
_To be filled when D1-B is completed._

### D3-A — QA audit findings
_To be filled when D3-A is completed._

### D3-D — Duplicate/stale findings
_To be filled when D3-D is completed._

### D4-A — Readability report
_To be filled when D4-A is completed._

### D4-D — Canonical glossary
_To be filled when D4-D is completed._

---

## Active Prompt (just-in-time)
### Target step
_Empty._

### Prompt
_Empty._
