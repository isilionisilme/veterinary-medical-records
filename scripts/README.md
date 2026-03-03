# Scripts

Organización por dominio de uso.

## `ci/preflight`
- Qué hace: ejecuta validaciones por niveles (`L1/L2/L3`) para cambios locales/antes de push.
- Cuándo usar: antes de abrir PR o hacer push.
- Ejemplos:
  - `./scripts/ci/preflight/test-L1.ps1 -BaseRef main`
  - `./scripts/ci/preflight/test-L2.ps1 -BaseRef main`
  - `./scripts/ci/preflight/test-L3.ps1 -BaseRef main`

## `ci/hooks`
- Qué hace: instala hooks de git.
- Cuándo usar: al clonar o reconfigurar entorno local.
- Ejemplo: `./scripts/ci/hooks/install-pre-push-hook.ps1`

## `docs`
- Qué hace: guards y utilidades de documentación (clasificación, sync, parity, links).
- Cuándo usar: cambios en `docs/**` o mantenimiento de wiki.

## `quality/lint`
- Qué hace: validadores de calidad frontend/docs.
- Cuándo usar: cambios de UI/brand/design-system.

## `dev/bootstrap` y `dev/local-env`
- Qué hace: arranque y utilidades locales de desarrollo.
- Cuándo usar: setup diario y diagnóstico local.

## Deprecación
- Rutas legacy bajo `scripts/` raíz se mantienen 1-2 iteraciones.
- Cada wrapper imprime aviso `[DEPRECATED]` con la nueva ruta.
