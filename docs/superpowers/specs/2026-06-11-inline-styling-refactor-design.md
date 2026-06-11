# Inline styling → Tailwind refactor — Design

## Problem

The frontend (`app/frontend`) has ~480 inline `style={{...}}` blocks across 17 files:

| File | Inline styles |
|---|---|
| `app/interview/CompanyPrepPanel.tsx` | 92 |
| `app/apply/new/page.tsx` | 73 |
| `app/apply/[id]/page.tsx` | 59 |
| `app/leads/page.tsx` | 49 |
| `app/settings/page.tsx` | 34 |
| `app/applications/page.tsx` | 34 |
| `app/skills/page.tsx` | 26 |
| `app/page.tsx` | 22 |
| `app/interview/GeneralPrepPanel.tsx` | 22 |
| `app/interview/page.tsx` | 19 |
| `components/ui-kit.tsx` | 17 |
| `app/interview/TechnicalQuestionsPanel.tsx` | 15 |
| `components/AppShell.tsx` | 13 |
| `app/setup/page.tsx` | 12 |
| `app/interview/shared.tsx` | 10 |
| `app/leads/[id]/page.tsx` | 3 |
| `components/ReviewPanel.tsx` | 1 |

This is not a bug — it doesn't break functionality — but it hurts readability and makes JSX hard to scan. The user wants this addressed but the scope ("everywhere") is too large for a single pass.

## Decision

- **Convention**: Tailwind utility classes. Static layout/spacing/typography becomes `className`. Genuinely runtime-computed values (data-driven colors, measured DOM heights) stay as small `style={}` objects/inline values.
- **Pacing**: Foundation pass now (token registration + `ui-kit.tsx` conversion + convention doc). Each remaining page/component is migrated in its own follow-up pass with browser verification, in the order listed below.

## Why Tailwind utilities (not alternatives)

- **Expand `ui-kit.tsx` style objects**: smallest diff, but JSX still reads as `style={someConst}` everywhere — doesn't address the "visual noise in JSX" complaint.
- **CSS Modules**: clean separation, but adds a file per component and either duplicates the existing CSS-variable theming or fights it. Tailwind v4 is already the project's foundation (`@import "tailwindcss"`, `@theme inline` block already present and partially used).
- **Tailwind utilities (chosen)**: idiomatic for this stack, biggest readability win, and the project's design tokens (CSS custom properties with light/dark pairs) can be registered as Tailwind theme tokens with zero visual change — dark mode keeps working automatically since utilities reference the same variables.

## Foundation scope (this pass)

### 1. Register existing tokens in `@theme inline` (`app/globals.css`)

The project's design tokens (`--color-background-primary`, `--color-background-secondary`, `--color-background-tertiary`, `--color-border-tertiary`, `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--amb`, `--amb-l`, `--amb-d`, `--badge-analyzed-bg/-fg`, `--badge-interview-bg/-fg`, `--badge-offer-bg/-fg`, `--badge-responded-bg/-fg`, `--badge-passed-bg/-fg`) live in `:root`/`.dark` but are not registered in `@theme inline`, so Tailwind generates no utilities for them.

Add `@theme inline` entries that point each new theme key at the existing variable (self-referencing, same pattern already used for `--color-background: var(--background)`):

```css
@theme inline {
  /* ...existing entries... */
  --color-background-primary: var(--color-background-primary);
  --color-background-secondary: var(--color-background-secondary);
  --color-background-tertiary: var(--color-background-tertiary);
  --color-border-tertiary: var(--color-border-tertiary);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-tertiary: var(--color-text-tertiary);
  --color-amb: var(--amb);
  --color-amb-l: var(--amb-l);
  --color-amb-d: var(--amb-d);
  --color-badge-analyzed-bg: var(--badge-analyzed-bg);
  --color-badge-analyzed-fg: var(--badge-analyzed-fg);
  --color-badge-interview-bg: var(--badge-interview-bg);
  --color-badge-interview-fg: var(--badge-interview-fg);
  --color-badge-offer-bg: var(--badge-offer-bg);
  --color-badge-offer-fg: var(--badge-offer-fg);
  --color-badge-responded-bg: var(--badge-responded-bg);
  --color-badge-responded-fg: var(--badge-responded-fg);
  --color-badge-passed-bg: var(--badge-passed-bg);
  --color-badge-passed-fg: var(--badge-passed-fg);
  --radius-card: var(--border-radius-md); /* 8px */
  --radius-chip: var(--border-radius-sm); /* 5px */
}
```

This unlocks utilities such as `bg-background-secondary`, `text-text-tertiary`, `border-border-tertiary`, `bg-amb`, `text-amb-d`, `bg-badge-interview-bg`, `text-badge-interview-fg`, `rounded-card`, `rounded-chip` — all dark-mode-aware automatically, no value changes.

`font-shell` (→ `var(--font-syne)`) and `font-mono` (→ `var(--font-geist-mono)`) are **already** registered in `@theme inline` but unused in favor of inline `fontFamily: shellFont` / `fontFamily: monoFont`. Adopt the existing utilities going forward.

The pervasive hairline border `0.5px solid var(--color-border-tertiary)` becomes `border-[0.5px] border-border-tertiary`.

### 2. Convert `components/ui-kit.tsx` shared helpers to className

- `cardBox`, `cardHeaderBar`, `sectionLabel`, `iconBtn`, `mutedText()`, `monoMuted()`, `pillBtn()`, `chip()`, `SectionCard` → become Tailwind className strings/functions instead of `CSSProperties` objects/values.
- `skillStatusStyle`, `verdictStyle`, `goalAlignStyle`, `statusChipStyle` switch from returning `CSSProperties` to returning className strings (now possible since the badge tokens are real utilities after step 1).
- `GrowTextarea`, `SaveIndicator`, `CopyButton`, `MdStrong`: static parts converted to `className`. `GrowTextarea`'s `el.style.height = el.scrollHeight + "px"` stays as direct DOM manipulation — it's computed at runtime from a ref and has no class equivalent.
- Net effect: ui-kit.tsx's 17 inline styles → 2-3 remaining (only genuinely runtime-computed values).
- Any consumer of these exports (pages currently importing `cardBox`, `chip()`, etc. and spreading them into `style={}`) must be updated to use `className` instead at the same time, since the export's type changes from `CSSProperties` to `string`. This pass only updates the exports + their direct usage sites needed to keep the build green — it does not migrate the rest of each consuming file's inline styles (that happens in that file's own pass).

### 3. Convention doc + rollout order

Append a "Styling conventions" section to `DESIGN_SYSTEM.md`:
- Token mapping table (old `var(--...)` → new Tailwind utility).
- Hairline border pattern (`border-[0.5px] border-border-tertiary`).
- Rule: `style={}` is reserved for values computed at runtime from data, refs, or measurements (e.g. status-color lookups not covered by a token, `scrollHeight`-based sizing). Everything static becomes a class.

Rollout order for follow-up passes (smallest first, to validate the pattern before tackling large files), each its own pass with browser verification:

1. `components/ReviewPanel.tsx` (1)
2. `app/leads/[id]/page.tsx` (3)
3. `app/interview/shared.tsx` (10)
4. `components/AppShell.tsx` (13)
5. `app/setup/page.tsx` (12)
6. `app/interview/TechnicalQuestionsPanel.tsx` (15)
7. `app/interview/page.tsx` (19)
8. `app/interview/GeneralPrepPanel.tsx` (22)
9. `app/page.tsx` (22)
10. `app/skills/page.tsx` (26)
11. `app/applications/page.tsx` (34)
12. `app/settings/page.tsx` (34)
13. `app/leads/page.tsx` (49)
14. `app/apply/[id]/page.tsx` (59)
15. `app/apply/new/page.tsx` (73)
16. `app/interview/CompanyPrepPanel.tsx` (92)

## Out of scope (this pass)

- Migrating any page/component beyond `ui-kit.tsx` itself.
- Changing any visual appearance, color value, spacing value, or theme behavior — this is a syntax-level refactor only.
- New design tokens beyond the ones needed to register existing CSS variables (no new colors, no new spacing scale).

## Testing

- `npm run build` (or `tsc --noEmit`) to confirm no type errors after `ui-kit.tsx` export type changes.
- Manual browser check of every page that imports from `ui-kit.tsx` (all of them) in both light and dark mode, to confirm zero visual diff.
