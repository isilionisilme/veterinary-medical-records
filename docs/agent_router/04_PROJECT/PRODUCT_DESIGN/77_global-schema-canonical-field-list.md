# Global Schema (Historical Canonical Field List)

Purpose: preserve the historical flat field universe as reference.

Status:
- Global Schema is historical and retained for reference.
- It is not the canonical schema for Medical Record MVP panel rendering.
- Medical Record MVP canonical semantics are defined in `78_global-schema-medical-record-mvp-field-list.md` and Appendix D9.

Historical reference (flat model):

A) Identificación del caso
- `claim_id`, `clinic_name`, `clinic_address`, `vet_name`, `document_date`

B) Paciente
- `pet_name`, `species`, `breed`, `sex`, `age`, `dob`, `microchip_id`, `weight`

C) Propietario
- `owner_name`, `owner_id`

D) Visita / episodio
- `visit_date`, `admission_date`, `discharge_date`, `reason_for_visit`

E) Clínico / revisión (flat)
- `diagnosis`, `symptoms`, `procedure`, `medication`, `treatment_plan`, `allergies`, `vaccinations`, `lab_result`, `imaging`
- `invoice_total`, `covered_amount`, `non_covered_amount`, `line_item`
- `notes`, `language`

Repeatable keys (flat):
- `medication`, `diagnosis`, `procedure`, `lab_result`, `line_item`, `symptoms`, `vaccinations`, `imaging`

Scope note:
- Historical payloads may include non-clinical billing/claim keys.
- Medical Record MVP UI scope is defined elsewhere and can exclude those keys without changing historical flat semantics.

## Visit grouping (MVP)

- In Medical Record MVP, visit grouping is rendered through schema visit-grouped semantics.
- `document_date` is removed from the MVP schema.
- `claim_id` is removed from the MVP schema.
- owner_id (string) (optional; product semantics in MVP: owner address shown as label `Dirección` through `owner_address` when available).

### Key -> UI label -> Section (UI)

- `clinic_name` -> `Nombre` -> `Centro Veterinario`
- `owner_name` -> `Nombre` -> `Propietario`
- `owner_address` -> `Dirección` -> `Propietario`
- `nhc` / `medical_record_number` -> `NHC` -> `Centro Veterinario`

## CRITICAL_KEYS (Authoritative, closed set)

Source of truth for Appendix D7.4 remains this historical set.
This set is authoritative and closed for historical flat semantics.
