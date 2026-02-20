# US-44 — Medical Record MVP: Update Extracted Data panel structure, labels, and scope (no billing)

**Status:** Planned  
**Owner:** Platform / Frontend (UX-led)  
**Type:** UX/UI behavior + mapping (contract-driven)

## User Story
As a **veterinarian reviewer**,  
I want the “Extracted Data / Informe” panel to present a **clinical medical record** with clear sections and field labels,  
so that I can review and edit clinical information quickly **without mixing it with billing/claim data**.

## Scope

**In scope**
1) **Panel purpose and scope (MVP)**
   - The Extracted Data panel represents a **Medical Record** (clinical summary), **not** a claim/factura view.

2) **Section structure (MVP)**
   - The panel renders sections in this exact order:
     1) **Centro Veterinario**
     2) **Paciente**
     3) **Propietario**
     4) **Visitas**
     5) **Notas del revisor**
     6) **Otros campos detectados**
     7) **Información del informe** (bottom)

3) **Field label changes (display-only)**
   - UI labels are updated for clarity; internal keys may remain unchanged.
   - Required label decisions (MVP):
     - “Identificación del caso” → **Centro Veterinario**
     - `clinic_name` label → **Nombre**
     - `clinic_address` label → **Dirección**
     - `pet_name` label → **Nombre**
     - `dob` label → **Nacimiento**
     - `owner_name` label → **Nombre**
     - Replace owner “ID” concept with **Dirección** (see acceptance: Owner address concept must be a real address field)
   - “NHC” is displayed as **NHC** with tooltip “Número de historial clínico”.

4) **Visits are contract-driven (no heuristics)**
   - When `schema_version="v1"`, visits are rendered strictly from the contract (`visits[]`), with no UI regrouping.
   - Visit blocks show visit-level metadata + visit-scoped fields as delivered by the contract.  
   **Reference:** `docs/project/TECHNICAL_DESIGN.md` Appendix D9.

**Out of scope**
- Introducing new clinical extraction logic beyond what the contract already provides.
- Normalizing clinical terms (e.g., SNOMED coding) in MVP UI.
- Any billing/factura UI (this story explicitly excludes it).

## Acceptance Criteria

**A. References / Authority**
1) Visit grouping behavior follows `docs/project/TECHNICAL_DESIGN.md` Appendix D9 (v1 visit-grouped).  
2) Copy/labels/empty-states must be defined in `docs/project/UX_DESIGN.md` (update UX_DESIGN as needed; US references it).

**B. Sections and order**
3) The Extracted Data panel renders the seven sections in the exact order listed in Scope (2).

**C. Medical Record field set is contract-driven (no FE denylist)**
4) The panel renders **only** the “Medical Record” field set and taxonomy defined by the backend contract (see TECHNICAL_DESIGN Appendix D9 or equivalent authoritative section), and **does not render** billing/claim fields.
   - Examples for regression/tests (not source of truth): `invoice_total`, `covered_amount`, `non_covered_amount`, `line_item`, `claim_id`, `document_date`.

**D. “Otros campos detectados” (contract-driven)**
5) “Otros campos detectados” must render only items explicitly delivered by the backend as “unmapped/other” per contract (no UI-side classification).  
6) **Blocking dependency:** If the contract does not currently expose an explicit bucket/tag for these items, **US-44 is blocked** until TECHNICAL_DESIGN is updated and the backend emits it.

**E. NHC display**
7) When an NHC value exists, the field label is “NHC” and shows tooltip “Número de historial clínico”.
8) If the NHC field exists but value is missing, it is still shown with placeholder “—” (per UX_DESIGN).

**F. Owner address concept**
9) “Propietario → Dirección” requires a real owner address field exposed by the contract (key/naming per TECHNICAL_DESIGN).  
10) The UI must not display a field labeled “Dirección” if its value corresponds to an identifier-like concept.

**G. v1 visits rendering remains non-heuristic**
11) Given `schema_version="v1"`, the UI renders visits only from `visits[]` and does not regroup items across visits. (D9 is authoritative.)

**H. Reviewer notes**
12) “Notas del revisor” is rendered **as defined in UX_DESIGN**; if not defined there, UX_DESIGN must be updated before implementation.

**I. Tests**
13) Add/adjust UI tests to cover:
   - Section order presence (smoke-level)
   - Contract-driven exclusion of billing/claim fields (using the examples list as regression checks)
   - NHC label + tooltip behavior (at least one)
   - Owner “Dirección” is not mislabeled ID

## Dependencies / Placement
- Depends on UX copy/spec being updated in `docs/project/UX_DESIGN.md`.
- **Blocking contract dependencies (must be resolved before implementation):**
  - Contract taxonomy/field set for “Medical Record” (document-level vs visit-level) is defined in TECHNICAL_DESIGN (Appendix D9 or equivalent).
  - Explicit bucket/tag for “Otros campos detectados” is defined in TECHNICAL_DESIGN and emitted by backend.
  - Owner address real field is available per TECHNICAL_DESIGN (do not label an ID as address).
- **Placement:** implement **US-44 before US-43** (US-44 remains separate).

---
