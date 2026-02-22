# Review UI Rendering Rules (Extracted Data / Informe — Medical Record MVP)

Panel definition and scope:
- The panel represents a **Medical Record** (clinical summary).
- In Medical Record MVP, non-clinical concepts are excluded from this panel by contract taxonomy (`medical_record_view`, `scope`, `section`, `classification`, `other_fields[]`), not by UI heuristics/denylists.

Section structure and order (fixed):
1. **Centro Veterinario**
2. **Paciente**
3. **Propietario**
4. **Visitas**
5. **Notas internas**
6. **Otros campos detectados**
7. **Información del informe**

Schema-aware rendering mode (deterministic):
- Medical Record MVP panel uses a single canonical structured contract (non-versioned).
- Render fixed non-visit sections plus a dedicated **Visitas** grouping block.
- Required document-level placeholders (for example NHC when missing) are driven by `medical_record_view.field_slots[]` in Appendix D9, not by UI hardcoding.
- No heuristics grouping in UI; grouping comes from `visits[]` in the canonical contract.
- Synthetic unassigned group copy is fixed: **Sin asignar / Sin fecha**.
- Review state remains document-level in MVP, even when multiple visits are present.

Display labels (UI-only; internal keys unchanged):
- **Centro Veterinario**
  - `clinic_name` -> `Nombre`
  - `clinic_address` -> `Dirección`
  - `vet_name` renders when present
  - `NHC`: visible label is always `NHC`; tooltip: `Número de historial clínico`.
  - Backend key may be `nhc` or `medical_record_number`; visible UX label remains `NHC`.
  - NHC must render even when missing (`—`).
- **Propietario**
  - `owner_name` -> `Nombre`
  - `owner_address` -> `Dirección`
  - `owner_id` is not shown in Medical Record MVP.

Key -> UI label -> Section (UI):

| Key | UI label | Section (UI) |
|---|---|---|
| clinic_name | Nombre | Centro Veterinario |
| clinic_address | Dirección | Centro Veterinario |
| vet_name | Veterinario/a | Centro Veterinario |
| nhc | NHC | Centro Veterinario |
| medical_record_number | NHC | Centro Veterinario |
| pet_name | Nombre | Paciente |
| dob | Nacimiento | Paciente |
| reproductive_status | Estado reproductivo | Paciente |
| owner_name | Nombre | Propietario |
| owner_address | Dirección | Propietario |
| visit_date | Fecha | Visitas |
| admission_date | Admisión | Visitas |
| discharge_date | Alta | Visitas |
| reason_for_visit | Motivo | Visitas |

Empty states (deterministic):
- If `visits = []`, render **Visitas** empty state.
- If `Otros campos detectados` is empty, show `Sin otros campos detectados.`

No governance terminology in veterinarian UX:
- The veterinarian UI copy must not expose terms such as `pending_review`, `governance`, or `reviewer`.
