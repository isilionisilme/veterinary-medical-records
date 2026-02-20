# Global Schema v0 (Canonical Field List)

Purpose: provide a stable, scannable review template where fields appear even when missing.

## Visit grouping (MVP)

- **Visita** means one care episode identified primarily by `visit_date`, with optional `admission_date`, `discharge_date`, and `reason_for_visit`.
- Clinical and cost concepts are **visit-scoped**. In `schema_version = "v1"`, they are grouped under `visits[].fields[]` as defined in [`docs/project/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) Appendix D9.
- The UI must not infer or heuristic-group visits. Grouping comes from the structured payload (`visits[]`).
- MVP excludes cross-document deduplication, merge/reconciliation, and longitudinal visit tracking.
- Review completion remains **document-level**: `Mark as reviewed` applies to the full document, including all its visits.

A) Datos de la clínica
- clinic_name (string)
- clinic_address (string)
- vet_name (string)

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
- owner_id (string) (optional; product semantics in MVP: owner address shown as label "Direccion")

D) Visitas (metadata)
- visit_date (date) [critical]
- admission_date (date) (optional)
- discharge_date (date) (optional)
- reason_for_visit (string)

E) Campos por visita (clinico y costes)
- diagnosis (string, repeatable) [critical]
- symptoms (string, repeatable)
- procedure (string, repeatable) [critical]
- medication (string, repeatable) [critical]
- treatment_plan (string)
- allergies (string)
- vaccinations (string, repeatable)
- lab_result (string, repeatable)
- imaging (string, repeatable)
- invoice_total (string)
- covered_amount (string) (optional)
- non_covered_amount (string) (optional)
- line_item (string, repeatable)

F) Revision
- notes (string)
- language (string) (optional)

Product notes:
- `document_date` is removed from the MVP schema because it is ambiguous; visit-level dates are the relevant temporal anchors.
- `claim_id` is removed from the MVP schema because it does not provide value in this phase.
- For MVP compatibility, internal key `owner_id` may remain unchanged in contracts/code, but UI semantics and label are owner address. Technical debt: rename to `owner_address` in a future schema version.
- In `schema_version = "v1"`, "Clinico" is not rendered as a flat standalone section; clinical/cost fields appear inside each visit group.

Rules:
- `value_type` allowed set: `string|date|number|boolean|unknown`.
- v0 recommendation: use `string` for ambiguous or unit-heavy values (for example weight, money, lab values).
- Presence stability: show all keys; reduce visual load with collapsible sections, not by removing keys.
- Repeatable fields (explicit): `medication`, `diagnosis`, `procedure`, `lab_result`, `line_item`, `symptoms`, `vaccinations`, `imaging`.
- `CRITICAL_KEYS_V0` must remain exact:
  `pet_name`, `species`, `breed`, `sex`, `age`, `weight`, `visit_date`, `diagnosis`, `medication`, `procedure`.

### Key -> UI label -> Section (UI)

| Key | UI label | Section (UI) |
|---|---|---|
| clinic_name | Nombre | Datos de la clínica |
| clinic_address | Direccion | Datos de la clínica |
| vet_name | Veterinario/a | Datos de la clínica |
| pet_name | Nombre | Paciente |
| dob | Nacimiento | Paciente |
| owner_name | Nombre | Propietario |
| owner_id | Direccion | Propietario |
| visit_date | Fecha | Visitas |
| admission_date | Admision | Visitas |
| discharge_date | Alta | Visitas |
| reason_for_visit | Motivo | Visitas |

## CRITICAL_KEYS_V0 (Authoritative, closed set)

Source of truth for Appendix D7.4: the exact set listed in
**Global Schema v0 (Canonical Field List)** above.
