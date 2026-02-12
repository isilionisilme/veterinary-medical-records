# Code PR

Policy:
- Manual trigger only hard gate: do not start code review steps unless the user explicitly asks to run one.
- Explicit trigger examples: "Do a code review for PR #...", "Review the diff for ...", "Run a code review now".
- If review seems useful, you may propose it, but STOP and wait for explicit instruction.
- If the user explicitly requests a code review, use the code review module and publish the review comment in the PR.
- If subsequent commits address review findings, publish a follow-up PR comment summarizing the addressed points.

Next: `docs/agent_router/01_WORKFLOW/CODE_REVIEW/00_entry.md`
