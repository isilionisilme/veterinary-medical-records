# Extraction Guardrails Risk Matrix

## Purpose
- Provide a single reviewer-first view of high-risk false-positive patterns and the active guardrails per golden field.
- Keep this matrix short; field-specific implementation details remain in `fields/*.md`.

## Risk matrix (golden fields)

| Field | Primary risk | Typical trigger pattern | Active guardrail | Evidence / owner doc |
|---|---|---|---|---|
| `microchip_id` | Generic long numeric IDs captured as chip | `No:` / `Nro:` invoice/reference near 9–15 digits | Accept only chip-context or explicit OCR chip-like prefixes (`N�`, `Nro`) + digits-only 9–15 | [microchip_id](fields/microchip_id.md) |
| `owner_name` | Patient/vet names promoted as owner | `Datos del Cliente` blocks with ambiguous `Nombre:` | Require explicit owner context or strict header fallback; reject patient-labeled and vet/clinic context | [owner_name](fields/owner_name.md) |
| `weight` | Dosage/zero values accepted as weight | Treatment lines, `0` values, out-of-range values | Enforce range `[0.5,120]`, reject `0`, prefer label-based weight context | [weight](fields/weight.md) |
| `vet_name` | Clinic/address promoted as veterinarian | Clinic headings and address-rich lines | Person-like normalization + reject clinic/address context | [vet_name](fields/vet_name.md) |
| `visit_date` | Birthdate mapped as visit date | Multiple dates in same document | Reject birthdate context and require visit/consult anchors | [visit_date](fields/visit_date.md) |
| `discharge_date` | Timeline dates misclassified as discharge | Unlabeled date-only lines | Strict discharge-label context only | [discharge_date](fields/discharge_date.md) |
| `vaccinations` | Narrative/admin text captured as vaccine list | Date-heavy or free narrative blocks | Strict label-only extraction + concise list guardrails | [vaccinations](fields/vaccinations.md) |
| `symptoms` | Treatment instructions promoted as symptoms | Dosage/administration paragraphs | Strict symptom-label context + reject treatment/noise language | [symptoms](fields/symptoms.md) |

## Reviewer checklist
- Confirm each changed field iteration references this matrix and its field file.
- For any new heuristic, add one positive and one negative test case.
- Require `How to test` commands and PR/commit anchors before approval.
