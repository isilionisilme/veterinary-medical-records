# 1.1 Deployment Model (Intent)

The system is implemented as a **modular monolith**.

- Logical boundaries must be preserved in code (modules, explicit interfaces).
- Domain logic must remain independent from infrastructure.
- The design must remain evolvable into independent services in the future.
- Do not introduce infrastructure complexity that is not strictly required for the scope defined in this repository.

---
