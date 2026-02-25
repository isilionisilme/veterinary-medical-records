# 13. Security Boundary

Authentication and authorization are **out of scope** for the current exercise.

All API endpoints are unauthenticated by design. The system runs locally in a trusted, single-user evaluation environment.

## Design decisions
- No auth middleware — single-user context makes stubs misleading.
- Upload validation covers file-type and content-type, not identity.
- No rate limiting — single-user model.

## Production path
1. Token-based auth (OAuth 2.0 / JWT) at API gateway.
2. Role-based authorization on document/processing endpoints.
3. Rate limiting middleware.
4. Audit logging on protected resources.
5. Streaming upload with early size rejection (roadmap #9).

Architecture supports this: hexagonal ports/adapters allow inserting auth without domain changes. Roadmap: FUTURE_IMPROVEMENTS.md #15.
