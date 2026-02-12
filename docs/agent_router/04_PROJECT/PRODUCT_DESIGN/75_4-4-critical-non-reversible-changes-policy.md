# 4.4 Critical / Non-Reversible Changes Policy

Some system-level changes are treated as **critical/non-reversible** because they can
reshape future interpretation semantics and are costly to safely undo.

Critical/non-reversible changes include (non-exhaustive):
- schema-level key add/remove/rename decisions,
- key remapping that changes canonical meaning,
- changes affecting the definition/classification of critical concepts.

Product guarantees:
- Veterinarian workflow remains local to single-document resolution and never carries governance burden.
- Reviewer governance handles cross-document/system-level policy decisions explicitly and prospectively.
- Stricter handling applies only to governance decisions, never as added friction for veterinarians.
