# Plan Management

> **Project-specific operational document.**
> Defines how plans are created, structured, and executed in the `veterinary-medical-records` project.
> For step-level execution mechanics, see [`plan-execution-protocol.md`](plan-execution-protocol.md).

---

## 1. How to Create a Plan

<!-- TODO: document plan creation criteria, structure, and approval flow -->

---

## 2. How to Execute a Plan

<!-- TODO: document execution triggers, agent selection, and progress tracking -->

---

## 3. Task Chaining Policy

Defines how AI assistants must behave when executing chained plan steps (e.g., triggered by `Continúa`).

### Default behavior in chained mode

- Do **not** auto-fix failures by default when chaining steps.
- Record the failure with evidence (what failed, which files, error output).
- Continue to the next step only if the failure is **non-blocking** for the current step.
- **STOP and escalate** on blocking conditions (see below).

### Blocking conditions (must STOP)

- A required preflight or CI gate failed and the step depends on it.
- Instructions contradict a canonical document or plan constraint.
- A dependency, permission, or required tool is missing.
- Security or data-loss risk is identified.
- An explicit hard-gate in the plan requires user review before proceeding.

### Non-blocking failures (may continue)

- Pre-existing lint/test failures unrelated to the current step.
- Cosmetic or formatting issues that do not affect correctness.
- Warnings that do not block commit/push/PR gates.

### Auto-fix allowance

- In **interactive single-task mode** (no plan), the assistant may attempt focused auto-fixes (max 2 attempts, scoped to the current change).
- In **chained-plan mode**, auto-fix is **not default**. The assistant must document the failure and let the plan decide (next step, escalation, or explicit fix step).
- Auto-fixes must never go beyond the current change scope or introduce unrelated refactors.
- **Never bypass quality gates** (`--no-verify`, disabling tests/checks, weakening assertions) to force a pass.

### Required output per step

Before handoff or auto-chain to the next step, each completed step must include:

- What changed (files, commits).
- Evidence (test output, CI status, verification).
- Risks or open items.
- Next-step handoff decision (continue / STOP / hand off to other agent).

---

## 4. Plan Lifecycle

<!-- TODO: document plan states (active, paused, completed, abandoned), archival, and iteration close-out -->
