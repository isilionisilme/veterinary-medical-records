# Barkibu — Brand Guidelines  
**Visual Identity & Tone of Voice (Inferred)**

**Note:** This is the canonical location for brand guidelines in this repository.

**Audience:** AI Coding Assistant (Codex) and contributors  
**Purpose:** Ensure that all UI code and user-facing copy generated during development is visually and tonally consistent with Barkibu’s corporate identity.

---

## 0) Scope & Precedence

This document defines **ONLY**:
- Visual identity (colors, typography, layout primitives)
- Tone and wording of user-facing text

This document does **NOT** define:
- UX flows or interactions
- Functional behavior
- Business logic

If any conflict exists:
- UX and functional documents take precedence.
- These guidelines apply strictly to **visual styling and wording**.

---

## 1) Brand Character (Invariant)

The product must look and read as:
- Calm
- Trustworthy
- Healthcare-adjacent
- Modern and restrained

Avoid anything that feels:
- Flashy or playful
- Experimental or “tech demo”
- Corporate-heavy or legalistic

**Default rule:** visual calm and clarity over expressiveness.

---

## 2) Color System (Exact Values — Mandatory)

Codex must use **only** the colors defined here unless explicitly instructed otherwise.

### 2.1 Primary Brand Accent
- **Soft Teal / Green:** `#2FB3A3`

Usage:
- Primary accents
- Highlights
- Key emphasis elements

Do not overuse.

---

### 2.2 Background Colors
- Primary background: `#FFFFFF`
- Secondary / subtle sections: `#F7F9FA`

---

### 2.3 Text Colors
- Primary text: `#1F2933`
- Secondary text: `#6B7280`
- Muted / metadata text: `#9CA3AF`

Avoid pure black (`#000000`).

---

### 2.4 Borders & Dividers
- Default border / divider: `#E5E7EB`
- Subtle separators: `#EEF1F4`

Borders must always be light and unobtrusive.

---

### 2.5 Semantic Support Colors (Muted)
These colors support meaning but must never dominate the UI.

- Success: `#4CAF93`
- Warning / uncertainty: `#E6B566`
- Error: `#D16D6A`

Avoid bright or saturated reds, greens, or yellows.

---

## 3) Typography (Exact Fonts — Mandatory)

### 3.1 Primary Font
**Inter**

Use Inter for all UI text.

Fallback stack:
```css
font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```

Recommended usage:
- Body text: 400–500
- Headings: 600
