# Global Schema v0 (Canonical Field List)

Purpose: provide a stable, scannable review template where fields appear even when missing.

A) Identificacion del caso
- claim_id (string)
- clinic_name (string)
- clinic_address (string)
- vet_name (string)
- document_date (date) - if missing, fall back to visit_date

B) Paciente (CRITICAL subset per CRITICAL_KEYS_V0)
- pet_name (string) [critical]
- species (string) [critical]
- breed (string) [critical]
- sex (string) [critical]
- age (string) [critical]
- dob (date) (optional)
- microchip_id (string) (optional)
- weight (string) [critical]

C) Propietario
- owner_name (string)
- owner_id (string) (optional)

D) Visita / episodio
- visit_date (date) [critical]
- admission_date (date) (optional)
- discharge_date (date) (optional)
- reason_for_visit (string)

E) Clinico
- diagnosis (string, repeatable) [critical]
- symptoms (string, repeatable)
- procedure (string, repeatable) [critical]
- medication (string, repeatable) [critical]
- treatment_plan (string)
- allergies (string)
- vaccinations (string, repeatable)
- lab_result (string, repeatable)
- imaging (string, repeatable)

F) Costes / facturacion
- invoice_total (string)
- covered_amount (string) (optional)
- non_covered_amount (string) (optional)
- line_item (string, repeatable)

G) Metadatos / revision
- notes (string)
- language (string) (optional)

Rules:
- `value_type` allowed set: `string|date|number|boolean|unknown`.
- v0 recommendation: use `string` for ambiguous or unit-heavy values (for example weight, money, lab values).
- Presence stability: show all keys; reduce visual load with collapsible sections, not by removing keys.
- Repeatable fields (explicit): `medication`, `diagnosis`, `procedure`, `lab_result`, `line_item`, `symptoms`, `vaccinations`, `imaging`.
- `CRITICAL_KEYS_V0` must remain exact:
  `pet_name`, `species`, `breed`, `sex`, `age`, `weight`, `visit_date`, `diagnosis`, `medication`, `procedure`.

## CRITICAL_KEYS_V0 (Authoritative, closed set)

Source of truth for Appendix D7.4: the exact set listed in
**Global Schema v0 (Canonical Field List)** above.
