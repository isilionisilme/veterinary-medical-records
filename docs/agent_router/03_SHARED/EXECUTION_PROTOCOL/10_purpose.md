<!-- AUTO-GENERATED from canonical source: plan-execution-protocol.md — DO NOT EDIT -->
<!-- To update, edit the canonical source and run: python scripts/docs/generate-router-files.py -->

## Purpose

This protocol governs how AI agents execute plan steps in a structured, auditable, and semi-unattended manner. It defines execution rules, completion integrity, CI verification, handoff conventions, and the full iteration lifecycle.

### Role taxonomy (availability-safe)

- **Planning agent**: owns plan authoring/updates, hard-gate decisions, and prompt preparation.
- **Execution agent**: owns implementation steps from pre-written prompts.

All routing and handoff rules in this document MUST use role labels (not model or vendor names).

AI assistants must stop and report the blocker when a protocol step cannot be completed as defined.

---

## File Structure

```
docs/projects/veterinary-medical-records/03-ops/
└── plan-execution-protocol.md      ← YOU ARE HERE

docs/projects/veterinary-medical-records/04-delivery/plans/
├── <plan-name>/                    ← Active plan folder
│   ├── PLAN_MASTER.md              ← Plan source of truth
│   └── PR-*.md                     ← Optional PR annexes
└── completed/
    └── <plan-name>/                ← Completed plan folder (moved without renaming files)
```

**Active plan file:** The agent attaches the relevant active plan folder (`plans/<plan-name>/`) and executes from `PLAN_MASTER.md` when handling continuation-intent requests (for example: "continue", "go", "let's go", "proceed", "resume").
Each plan file within that folder contains: Execution Status (checkboxes), Prompt Queue, Active Prompt, and plan-specific context.

---
