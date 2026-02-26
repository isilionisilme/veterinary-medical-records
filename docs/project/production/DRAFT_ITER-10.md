---
title: "DRAFT — Iteration 10 Candidates"
status: draft
created: 2025-07-16
---

# DRAFT — Iteration 10 Candidates

> **Estado:** borrador provisional — no aprobado para ejecución.
> Evaluar después de que la Iteración 9 (E2E + Playwright) se complete.

## Candidatos

| ID     | Área                        | Descripción breve                                                        | Prioridad tentativa |
| ------ | --------------------------- | ------------------------------------------------------------------------ | ------------------- |
| D10-A  | Performance testing         | Benchmarks de latencia en endpoints críticos (upload, extraction, query)  | Alta                |
| D10-B  | Error UX                    | Mensajes de error user-friendly en frontend; mapeo error-code → copy     | Alta                |
| D10-C  | Accessibility audit         | WCAG 2.1 AA compliance en componentes clave (upload, results, nav)       | Media               |
| D10-D  | API documentation           | OpenAPI spec auto-generada + Swagger UI embebido                         | Media               |
| D10-E  | Security hardening          | Rate limiting, CORS tightening, input sanitization audit                 | Alta                |
| D10-F  | Coverage gaps               | cli.py (0%), remaining domain edge-cases                                 | Media               |
| D10-G  | Flaky test cleanup          | Identificar y estabilizar tests intermitentes (si los hay post-Iter 9)   | Baja                |
| D10-H  | Doc classifier calibration  | Métricas de precisión del clasificador de documentos veterinarios        | Media               |
| D10-I  | Observability               | Structured logging, health-check endpoints, métricas Prometheus-ready    | Alta                |
| D10-J  | CI/CD hardening             | Cache de dependencias, matrix de Python versions, deploy preview         | Media               |

## Preguntas abiertas

1. ¿Cuántos E2E tests entrega la Iter 9? Si < 5 happy-paths, extender E2E antes de nuevos temas.
2. ¿El equipo prefiere profundizar testing o agregar features visibles al usuario?
3. ¿Hay feedback de usuarios reales que re-priorice algún candidato?
4. ¿Se necesita soporte multi-idioma (i18n) en el corto plazo?

## Notas

- Los candidatos se priorizarán con datos reales post-Iter 9.
- Este archivo usa prefijo `DRAFT_` — no es un plan aprobado.
- Para aprobar, renombrar a `PLAN_<fecha>_ITER-10.md` y asignar agentes a cada paso.
