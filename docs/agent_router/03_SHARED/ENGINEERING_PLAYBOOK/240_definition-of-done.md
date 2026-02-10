# Definition of Done
A change is considered done when it satisfies the criteria that apply to its type (user story or technical change).

For user stories:
- It delivers a complete vertical slice of user-facing value.
- It is documented (README and/or ADR if a design decision was made).

For technical non user-facing changes (refactors, chores, CI, docs, fixes):
- The change intent and scope are explicitly documented in the Pull Request.
- Behavior is preserved, or any intended behavior change is clearly explained and justified.

For all changes:
- The resulting code remains easy to understand, extend, and evolve without refactoring core logic.
- Automated tests pass, and test coverage is updated where applicable.
- The change is merged into main via Pull Request.
- Continuous Integration (CI) has run and passed successfully.
- `main` remains in a green (passing) state after the merge.
