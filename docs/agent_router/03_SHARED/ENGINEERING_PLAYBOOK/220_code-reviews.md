# Code Reviews

Apply the following rules by default to every future code review in this repo unless explicitly overridden.

- Reviews focus on:
  - Correctness and alignment with the intended behavior
  - Clarity, readability, and maintainability
  - Adherence to the Engineering Guidelines and architectural intent
  - Explicit handling of edge cases, errors, and state transitions
  - Test coverage and test quality

## Code Review stance

- Reviews must be constructive and pragmatic.
- Prioritize shared understanding and long-term code health over stylistic preferences.
- Optimize for clarity, testability, and low coupling.
- Prefer small, high-impact fixes over large refactors.
- Avoid overengineering suggestions.
- Do not propose new dependencies or new architectural patterns unless explicitly required.

## Code Review Guidelines

When performing code reviews in this repository, use a **maintainability-focused** review style.

Review emphasis:
- Keep changes within the requested scope.
- Keep the dependency footprint minimal; add dependencies only when needed.
- Keep architecture consistent with the agreed design; introduce new patterns only when a story/design requires it.
- Keep solutions lightweight and easy to explain to evaluators.

Primary review focus (in order):
1) Layering and dependency direction:
   - `domain` has no framework/db imports
   - `application` depends only on `domain` + `ports`
   - `api` is thin (HTTP + mapping only; no SQL/business logic)
   - `infra` contains persistence/IO only
2) Maintainability:
   - clear naming and responsibilities
   - low duplication
   - small, cohesive modules/functions
   - logic located in the correct layer
3) Testability:
   - core application logic testable without FastAPI or sqlite
   - presence and quality of unit tests for services
   - integration tests cover HTTP + wiring
4) Simplicity over purity:
   - flag overengineering risks
   - prefer removing complexity over adding abstraction
5) CI and tooling sanity:
   - workflows valid
   - tests and lint runnable and reproducible

## Code Review Output Format

Produce the review using this mandatory output format:
   - Must-fix (blocking maintainability or correctness issues)
   - Should-fix (strong recommendations)
   - Nice-to-have (optional improvements)
   - Questions / assumptions

For PRs that include `frontend/**` or user-visible behavior/copy changes, include:
   - UX/Brand Compliance (mandatory section)
   - Any UX/Brand non-compliance must be reported under Must-fix.

Each finding must include:
- File reference(s)
- Short rationale
- Minimal suggested change

## Code Review Safety rule

After producing a PR code review, STOP and wait for explicit user instruction before making any code changes.

Do not modify code as part of the review step unless explicitly asked to do so.
