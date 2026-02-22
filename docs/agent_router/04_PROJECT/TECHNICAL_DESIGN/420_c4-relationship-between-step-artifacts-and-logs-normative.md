# C4. Relationship between Step Artifacts and Logs (Normative)
- Step artifacts (`artifact_type = STEP_STATUS`) are the source of truth for step state.
- Structured logs emit corresponding `STEP_*` events best-effort.
- If logs and artifacts disagree, artifacts win.

---

# Appendix D — Structured Interpretation Schema (Canonical) (Normative)

This appendix defines the **authoritative minimum JSON schema** for structured interpretations.
It exists to remove ambiguity for implementation (especially AI-assisted coding) and to support:
- **Review in context** (US-07)
- **Editing with traceability** (US-08)

If any conflict exists, **Appendix A, Appendix B, Appendix C, and this appendix take precedence**.
