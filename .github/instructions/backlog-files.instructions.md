---
applyTo: "**/Backlog/*.md"
---

- Backlog status lifecycle is `Planned` → `In Progress` → `Done`.
- Set `In Progress` when plan execution starts and the first step enters progress.
- Set `Done` only during closeout, before moving the backlog file to `completed/`.
- Use the naming pattern `<TYPE>-<NUMBER>-<slug>.md` where TYPE is `US`, `IMP`, `ARCH`, or a project-specific equivalent.
- Link plans using this literal pattern: `PLAN_<date>_<slug>.md -> ../plans/PLAN_<date>_<slug>.md`.
- When backlog artifacts move to `completed/`, update surrounding relative links.
