# Lean Design System (Tokens + Primitives)

## Purpose
This document defines the minimal design-system contract for the internal Claims Review UI.

Goals:
- prevent ad-hoc styling drift,
- provide a consistent base for editable structured fields,
- keep UI implementation lightweight and maintainable.

This is an implementation-facing UI contract. It does not redefine workflow behavior from UX/Product docs.

---

## Tokens

All new user-visible UI must use tokens instead of scattered hard-coded values.

### Color tokens

| Token | Value | Usage |
|---|---|---|
| `--color-page-bg` | `#EBF5FF` | app/page background |
| `--color-surface` | `#FFFFFF` | cards/panels |
| `--color-surface-muted` | `#F8FAFC` | subtle inner surfaces |
| `--color-text` | `#1F2933` | primary text |
| `--color-text-secondary` | `#6B7280` | secondary text |
| `--color-text-muted` | `#9CA3AF` | metadata/helper text |
| `--color-border` | `#E5E7EB` | default borders |
| `--color-border-subtle` | `#EEF1F4` | subtle separators |
| `--color-accent` | `#FC4E1B` | primary accent |
| `--color-accent-foreground` | `#FFFFFF` | text on accent |
| `--shadow-subtle` | `0 1px 3px rgb(31 41 51 / 0.08)` | gentle elevation |

### Semantic/status tokens

| Token | Value | Usage |
|---|---|---|
| `--confidence-low` | `#D16D6A` | low-confidence indicator |
| `--confidence-med` | `#E6B566` | medium-confidence indicator |
| `--confidence-high` | `#4CAF93` | high-confidence indicator |
| `--status-critical` | `#D16D6A` | critical badge border/text accent |
| `--status-missing` | `#9CA3AF` | missing/placeholder state tone |

### Spacing scale

`4, 8, 12, 16, 20, 24, 32` px

### Radius scale

`6, 8, 12, 16` px

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

---

## Accessibility rules

- Icon-only actions must use `IconButton` and provide `ariaLabel`.
- Confidence and critical signals cannot rely on color alone (tooltips/labels remain available).
- Tooltips must be keyboard-accessible and must not clip inside scroll containers.

---

## Usage examples

### Example 1 — Viewer toolbar icon action

- Use `IconButton` for page/zoom/view actions.
- Provide `ariaLabel` and concise tooltip text.

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
- flags inline `style={{...}}` outside allowlist,
- flags `IconButton` usage without `ariaLabel`.
