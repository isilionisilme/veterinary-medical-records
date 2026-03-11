---
applyTo: "**/plans/PLAN_*.md"
---

- Each step is an atomic unit. Never mix scope between steps.
- Mark `[x]` with commit SHA on completion: `- [x] F?-? — Description — ✅ \`<sha>\``.
- If no code change exists, record `✅ \`no-commit (<reason>)\``.
- Mark `⏳ IN PROGRESS (<agent>, <date>)` before starting a step.
- At `📌` checkpoints, pause, propose the commit, and wait for user direction.
- Every step close requires an evidence block with Step, Code commit SHA, and Plan commit SHA.
- Keep plan-file updates in the same commit boundary as the implementation they track.
- Never amend the plan-start snapshot commit.
