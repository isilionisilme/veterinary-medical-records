# Branching Strategy
- The default branching strategy is Feature Branching.
- Work is developed in short-lived branches on top of a stable `main` branch.
- `main` always reflects a runnable, test-passing state.
- Each change is implemented in a dedicated branch:
  - User stories use the story branch naming convention.
  - Technical non user-facing work (refactors, chores, CI, docs, fixes) uses the technical branch naming convention.
- Branches are merged once the change is complete and reviewed.
- Teams are encouraged to adopt a different strategy if they believe it better suits their context.
