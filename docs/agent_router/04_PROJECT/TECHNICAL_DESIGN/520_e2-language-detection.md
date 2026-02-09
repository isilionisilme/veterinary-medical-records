# E2. Language Detection

Decision (Authoritative):
- Use **langdetect** as the language detection library.

Rationale:
- Lightweight dependency sufficient for this scope.
- Provides deterministic-enough output to populate `ProcessingRun.language_used`.

Rules:
- Language detection is best-effort and must never block processing.
- If detection fails, `language_used` is set to `"unknown"` (or equivalent) and processing continues.
