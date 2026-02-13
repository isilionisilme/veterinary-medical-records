# Lean Design System (Tokens + Primitives)

## Purpose
This document defines the minimal design-system contract for the internal Claims Review UI.

Goals:
- prevent ad-hoc styling drift,
- provide a consistent base for editable structured fields,
- keep UI implementation lightweight and maintainable.

This is an implementation-facing UI contract. It does not redefine workflow behavior from UX/Product docs.

---

## Token strategy

The project uses **CSS variables as canonical tokens** in `frontend/src/index.css`, then maps those tokens into Tailwind in `frontend/tailwind.config.cjs`.

Rule:
- Define/adjust token values in CSS variables.
- Consume tokens through Tailwind utility names (not ad-hoc hex values in components).

All new user-visible UI must use tokens instead of scattered hard-coded values.

### Color tokens

| Token | Value | Usage |
|---|---|---|
| `--app-bg` | `#EDF3FB` | outer page background |
| `--app-frame` | `#F8FBFF` | main app frame/container |
| `--surface` | `#F2F5FA` | cards/panels (inner surfaces) |
| `--surface-muted` | `#E9EFF6` | subtle inner surfaces / toolbar blocks |
| `--border-subtle` | `#DBE4EF` | subtle separators and panel borders |
| `--shadow-soft` | `0 10px 28px rgb(31 41 51 / 0.08)` | soft elevation for frame/cards |
| `--color-page-bg` | `var(--app-bg)` | app/page background alias |
| `--color-surface` | `var(--surface)` | cards/panels alias |
| `--color-surface-muted` | `var(--surface-muted)` | muted surface alias |
| `--color-text` | `#1F2933` | primary text |
| `--color-text-secondary` | `#6B7280` | secondary text |
| `--color-text-muted` | `#9CA3AF` | metadata/helper text |
| `--color-border` | `#E5E7EB` | default borders |
| `--color-border-subtle` | `var(--border-subtle)` | subtle separators alias |
| `--color-accent` | `#FC4E1B` | primary accent |
| `--color-accent-foreground` | `#FFFFFF` | text on accent |
| `--shadow-subtle` | `var(--shadow-soft)` | gentle elevation alias |

### Semantic/status tokens

| Token | Value | Usage |
|---|---|---|
| `--status-success` | `#4CAF93` | semantic success / ready |
| `--status-warn` | `#E6B566` | semantic warning / processing |
| `--status-error` | `#D16D6A` | semantic error / failure |
| `--confidence-low` | `#D16D6A` | low-confidence indicator |
| `--confidence-med` | `#E6B566` | medium-confidence indicator |
| `--confidence-high` | `#4CAF93` | high-confidence indicator |
| `--status-critical` | `#D16D6A` | critical badge border/text accent |
| `--status-missing` | `#9CA3AF` | missing/placeholder state tone |

Brand constraint:
- Barkibu Orange (`#FC4E1B`) is used as accent/CTA only.
- Semantic status colors stay muted and never use orange.

### Spacing scale

`4, 8, 12, 16, 20, 24, 32` px

### Radius scale

`--radius-frame: 18px`, `--radius-card: 14px`, `--radius-control: 10px`

Guideline:
- Frame uses `radius-frame`.
- Cards and major panels use `radius-card`.
- Controls (buttons/inputs/toggles/chips) use `radius-control`.

---

## Primitives (shadcn/ui + Radix)

The frontend uses local shadcn-style wrappers backed by Radix primitives under `frontend/src/components/ui`.

Required primitives:
- `Button` (including ghost/icon variants)
- `Tooltip` + `TooltipProvider`
- `Tabs`
- `Separator`
- `Input`
- `ToggleGroup`
- `ScrollArea`

Rules:
- `Tooltip` content defaults to top placement and renders through portal.
- Tooltip behavior must remain keyboard-accessible (focus/blur + Escape via Radix behavior).
- Use primitive variants and tokens first; avoid one-off utility-class styling when a primitive exists.

---

## App-level wrappers (`components/app`)

Project wrappers standardize repeated review UI patterns:
- `IconButton`: icon-only button with required accessible name + tooltip.
- `Section` / `SectionHeader`: report-like section container and heading row.
- `FieldRow` / `FieldBlock`: label/value row and grouped field block with right-aligned status cluster.
- `ConfidenceDot`: semantic confidence indicator with tooltip.
- `CriticalBadge`: consistent critical marker.
- `RepeatableList`: list container for repeatable values.
- `DocumentStatusCluster`: compact, reusable status cluster for document list/sidebar (primary status signal).

---

## Accessibility rules

- **MUST**: icon-only interactive controls must use `IconButton` with required `label`.
- Raw icon-only `<button>` / `<Button>` are forbidden unless explicitly allow-listed as an approved exception.
- Confidence and critical signals cannot rely on color alone (tooltips/labels remain available).
- Tooltips must be keyboard-accessible and must not clip inside scroll containers.

## Tooltip policy (mandatory)

- Use only `frontend/src/components/ui/tooltip.tsx` for tooltip behavior.
- Default placement is `top`.
- Content is rendered via Radix `Portal` to avoid clipping in overflow/scroll containers.
- Do not implement local tooltip logic with ad-hoc `@radix-ui/react-tooltip` usage outside the shared wrapper.

### Icon-only controls: do / don't

Do:
- `<IconButton label="Cerrar panel">✕</IconButton>`
- `<IconButton label="Actualizar" tooltip="Actualizar"> <RefreshCw /> </IconButton>`

Don't:
- `<button aria-label="Cerrar">&times;</button>`
- `<Button aria-label="Actualizar"><RefreshCw /></Button>`

### Exception process (allowlist)

Use exceptions only when `IconButton` cannot represent the interaction semantics (for example, a non-button resize handle).

Required steps:
1. Add a narrow token-based allowlist entry in `scripts/check_design_system.mjs` (`ICON_ONLY_ALLOWLIST`) scoped to file + unique marker.
2. Add rationale to the PR description (why `IconButton` is not viable).
3. Keep keyboard and screen-reader accessibility equivalent or better than the default `IconButton` contract.

---

## Usage examples

### Example 1 — Viewer toolbar icon action

- Use `IconButton` for page/zoom/view actions.
- Provide `label` and concise tooltip text.

### Example 2 — Structured field row

- Wrap field in `FieldBlock`.
- Use `FieldRow` with:
  - left: field label,
  - right: value,
  - status cluster: `CriticalBadge` + `ConfidenceDot`.

---

## Enforcement

Use `npm run check:design-system` in `frontend/`.

Current checks:
- flags hard-coded hex colors outside token/config allowlist,
- flags direct inline Radix tooltip primitive usage outside the shared tooltip wrapper,
- flags inline `style={{...}}` outside allowlist,
- flags `IconButton` usage without `label`,
- flags raw icon-only `<button>` and `<Button>` usage outside explicit allowlist.

## Do / Don't

Do:
- Use tokenized Tailwind classes (`bg-surface`, `text-textSecondary`, `border-border`, etc.).
- Use `IconButton`, `DocumentStatusCluster`, and field/section wrappers in review UI.

Don't:
- Add new ad-hoc hex values in component implementation files.
- Reimplement tooltip primitives inline.
- Introduce one-off status chips when `DocumentStatusCluster` matches the need.
