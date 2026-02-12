# Definition of Done
A change is considered done when it satisfies the criteria that apply to its type (user story or technical change).

For user stories:
- It delivers a complete vertical slice of user-facing value.
- It is documented (README and/or ADR if a design decision was made).
- If user-visible behavior is affected, UX guidance is applied from `docs/agent_router/03_SHARED/UX_GUIDELINES/00_entry.md` and `docs/agent_router/04_PROJECT/UX_DESIGN/00_entry.md`.
- If visual identity or user-facing copy is affected, brand guidance is applied from `docs/agent_router/03_SHARED/BRAND_GUIDELINES/00_entry.md`.

For technical non user-facing changes (refactors, chores, CI, docs, fixes):
- The change intent and scope are explicitly documented in the Pull Request.
- Behavior is preserved, or any intended behavior change is clearly explained and justified.

For all changes:
- The resulting code remains easy to understand, extend, and evolve without refactoring core logic.
- Automated tests pass, and test coverage is updated where applicable.
- For any implemented change that is testable from an end-user perspective (feature, fix, technical improvement, or small in-flight adjustment), the assistant final response must include clear step-by-step validation instructions from the end-user point of view.
- When end-user testing is not possible, the completion report must explicitly state that and provide the best alternative verification method (for example: API checks, logs, automated tests, or controlled manual simulation).
- The change is merged into main via Pull Request.
- Continuous Integration (CI) has run and passed successfully.
- `main` remains in a green (passing) state after the merge.
