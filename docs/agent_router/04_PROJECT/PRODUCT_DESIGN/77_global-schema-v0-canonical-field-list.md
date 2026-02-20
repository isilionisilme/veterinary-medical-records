# Global Schema v0 (Legacy/Historical Canonical Field List)

Purpose: preserve the historical flat v0 field universe as compatibility reference.

Status:
- Global Schema v0 is legacy/historical and retained for compatibility.
- It is not the canonical schema for Medical Record MVP panel rendering.
- Medical Record MVP canonical semantics are defined in `78_global-schema-v1-medical-record-mvp-field-list.md` and Appendix D9.

Historical v0 reference (flat model):

A) Identificación del caso
- `claim_id`, `clinic_name`, `clinic_address`, `vet_name`, `document_date`

B) Paciente
- `pet_name`, `species`, `breed`, `sex`, `age`, `dob`, `microchip_id`, `weight`

C) Propietario
- `owner_name`, `owner_id`

D) Visita / episodio
- `visit_date`, `admission_date`, `discharge_date`, `reason_for_visit`

E) Clínico / revisión (flat v0)
- `diagnosis`, `symptoms`, `procedure`, `medication`, `treatment_plan`, `allergies`, `vaccinations`, `lab_result`, `imaging`
- `invoice_total`, `covered_amount`, `non_covered_amount`, `line_item`
- `notes`, `language`

Repeatable keys (v0):
- `medication`, `diagnosis`, `procedure`, `lab_result`, `line_item`, `symptoms`, `vaccinations`, `imaging`

Compatibility note:
- v0 payloads may include non-clinical billing/claim keys.
- Medical Record MVP UI scope is defined elsewhere and can exclude those keys without changing v0 legacy semantics.

## CRITICAL_KEYS_V0 (Authoritative, closed set)

Source of truth for Appendix D7.4 remains this historical v0 set.
This set is authoritative and closed for v0 semantics.
