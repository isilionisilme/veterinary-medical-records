# ADR-0001: Golden loop extraction tracking

- Date: 2026-02-14
- Status: Accepted

## Context
Extraction quality is being improved field-by-field in small iterations. We run golden fixtures and real-run diagnostics, then apply minimal changes only when evidence is clear. Without a tracking system, evidence and decisions are spread across chat notes and commits, making review and reproducibility difficult.

## Decision
Maintain a small documentation system under `docs/extraction-tracking/`:
- `INDEX.md` as the canonical index for golden iterations and parity/debug reports.
- `fields/*.md` as per-field catalogs (rules, limits, history, test commands).
- `runs/*.md` as UI/backend parity evidence reports tied to run_id.
- Keep an ADR trail for rationale and governance.

## Why
- Traceability: every field change links to branch, commit, tests, and evidence.
- Reproducibility: reviewers can rerun exact commands and follow deterministic steps.
- Run consistency: parity reports force run_id alignment and reduce mismatch confusion.
- Review readiness: small, auditable evidence packages instead of ad-hoc chat fragments.

## Alternatives considered
1. Ad-hoc chat notes only.
   - Rejected: hard to audit and easy to lose context.
2. Single monolithic markdown file.
   - Rejected: grows quickly, poor navigation by field/run.
3. No explicit index.
   - Rejected: slows triage and increases duplicated analysis.

## Consequences
- Small per-iteration overhead to update docs.
- Higher auditability and onboarding speed.
- Better change isolation and confidence in incremental extraction updates.
- Required anchoring discipline per iteration: commit hash is mandatory, PR link is preferred (or `TODO(PR: pending)`), and run diagnostics must record `document_id` + `run_id`.
