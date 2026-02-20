# US-43 — Render “Visitas” agrupadas cuando `schema_version="v1"` (contract-driven, no heuristics)

**Status:** Planned  
**Owner:** Platform / Frontend

## User Story
Como **veterinario revisor**, quiero ver los datos clínicos y de costes **agrupados por visita** cuando un documento contiene múltiples visitas, para revisar cada episodio de forma clara y evitar mezclar información de visitas distintas.

## Scope
In scope:
1) Branch por `schema_version` en “Datos extraídos”:
   - v0: mantener render actual (flat por secciones).
   - v1: renderizar sección “Visitas” basada exclusivamente en `visits[]`.
2) v1: `fields[]` top-level (document-level):
   - Renderizar `fields[]` como “Campos del documento” (fuera de “Visitas”) y `visits[]` como bloques de visita.
   - Sin duplicación; no heurísticas; no mover campos entre `fields[]` y `visits[].fields[]`.
   - Reference: TECHNICAL_DESIGN Appendix D9 (scoping rules).
   - Tech alignment required: si D9 no fuese suficientemente explícito, validar/ajustar D9 antes/como parte de la implementación.
3) v1: render de visitas:
   - Un bloque por `VisitGroup` en `visits[]`.
   - Metadata desde VisitGroup (si existe): `visit_date`, `admission_date`, `discharge_date`, `reason_for_visit`.
   - Campos visit-scoped solo desde `VisitGroup.fields[]`.
4) v1: no heuristics: no reasignar/fusionar/inferir/reagrupar; no crear visitas.
   - `visit_id="unassigned"` (si viene en payload) se renderiza como un bloque más.
5) v1: ordenación determinista:
   - `visit_date` desc; null al final.
   - Tie-breaker: si empate, preservar orden del array `visits[]` del payload.
6) Search/filters (US-34): filtran FieldRows dentro de su contenedor; no reagrupan.
7) Review workflow sigue siendo por documento (Mark reviewed aplica al documento, no por visita).

Out of scope:
- Heurísticas para inferir visitas o mover items.
- “Reviewed per visit”.
- Cambios backend más allá del contrato v1 existente.

## Acceptance Criteria
A) Contrato (referencia):
1) Soporta v0 (flat `fields[]`) y v1 (`fields[]` + `visits[]`). Reference: TECHNICAL_DESIGN Appendix D9.
B) v1 separación:
2) `fields[]` solo en “Campos del documento”; `visits[i].fields[]` solo en visita i; sin duplicación.
C) No heuristics:
3) UI no modifica asignación del payload (no mover/crear/fusionar).
D) Ordenación:
4) `visit_date` desc; null al final.
5) Empates: preservar orden del payload.
6) `unassigned` (si existe) al final con copy/label según UX_DESIGN.
E) Filters/search:
7) Oculta/muestra dentro del contenedor; no reordena visitas ni reagrupa.
F) Empty:
8) v1 con `visits=[]` muestra empty state (UX_DESIGN) y no fallback a v0.
G) v0 unchanged:
9) v0 no cambia (regresión).
H) Tests mínimos:
10) 1 test UI ordering/tie-breaker + null + unassigned; 1 test UI empty v1; 1 test regression v0.

## Authoritative References
- `docs/project/TECHNICAL_DESIGN.md` Appendix D9
- `docs/project/UX_DESIGN.md`

---
