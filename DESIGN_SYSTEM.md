# Design System

## Typography
- Font: Syne (headings, UI) + Geist Mono (numbers, dates, code)
- Base size: 12-14px

## Colors
- Accent: #BA7517 (amber)
- Accent light: #FAEEDA
- Accent dark: #854F0B
- Use CSS variables for backgrounds/borders (var(--color-background-primary) etc.)

## Layout
- Topbar: 46px height, logo 44px wide with right border
- Icon sidebar: 44px wide, icon-only (Resume, Skills, Settings)
- Top nav: Applications · Captured jobs · Interview (conditional, green dot)

## Components
- Cards: 0.5px border, border-radius md, no shadow
- Badges: pill shape, color per status
  - Analyzed: gray
  - Applied: amber
  - Responded: blue
  - Interview: green
  - Passed: red
- Buttons: primary = amber bg, ghost = border only
- Stat boxes: icon left + number + label

## Dashboard
- 3 stat boxes: Captured jobs / Awaiting / Interviews
- Kanban 3 columns: Analyzed → Applied → Interview
- Column dots: gray / amber / green

## Styling conventions

The frontend uses Tailwind utility classes for all static styling. The migration from inline `style={{...}}` is **complete** (see `docs/superpowers/specs/2026-06-11-inline-styling-refactor-design.md`): every page and component renders via `className`.

**Rule**: `style={}` is reserved for values computed at runtime from data, refs, or measurements — and these are the only remaining uses: dnd-kit drag transforms (`CSS.Transform.toString(transform)`), `el.style.height = el.scrollHeight + "px"` in `GrowTextarea`, and the review progress-bar width. Everything static — layout, spacing, typography, fixed colors — is a Tailwind class. Inline-color hover effects use `hover:`/`group-hover:` utilities, not `onMouseEnter`/`onMouseLeave`.

### Token mapping

The project's CSS custom properties (`app/globals.css`, light/dark pairs) are registered in `@theme inline`, so they're available as ordinary Tailwind utilities (`bg-*`, `text-*`, `border-*`, `rounded-*`) — dark mode keeps working automatically.

| Old (`style={{ ... }}`) | New (`className`) |
|---|---|
| `fontFamily: shellFont` / `var(--font-syne)` | `font-shell` |
| `fontFamily: monoFont` / `var(--font-geist-mono)` | `font-mono` |
| `background: "var(--color-background-primary)"` | `bg-background-primary` |
| `background: "var(--color-background-secondary)"` | `bg-background-secondary` |
| `background: "var(--color-background-tertiary)"` | `bg-background-tertiary` |
| `border: "0.5px solid var(--color-border-tertiary)"` | `border-[0.5px] border-border-tertiary` |
| `color: "var(--color-text-primary)"` | `text-text-primary` |
| `color: "var(--color-text-secondary)"` | `text-text-secondary` |
| `color: "var(--color-text-tertiary)"` | `text-text-tertiary` |
| `var(--amb)` / `var(--amb-l)` / `var(--amb-d)` | `bg-amb` / `text-amb` / `bg-amb-l` / `text-amb-d` etc. |
| `var(--badge-{name}-bg)` / `var(--badge-{name}-fg)` | `bg-badge-{name}-bg` / `text-badge-{name}-fg` (name = `analyzed`, `interview`, `offer`, `responded`, `passed`) |
| `borderRadius: "8px"` (card) | `rounded-card` |
| `borderRadius: "5px"` (chip) | `rounded-chip` |
| `borderRadius: "99px"` (pill/chip) | `rounded-full` |

### Shared helpers (`components/ui-kit.tsx`)

Each `CSSProperties`-returning helper has a `*Cls` className equivalent — use the `*Cls` version in new or migrated code:

| Old (style object) | New (className) |
|---|---|
| `cardBox` | `cardBoxCls` |
| `cardHeaderBar(collapsed, bg)` | `cardHeaderBarCls(collapsed, bgClassName)` |
| `sectionLabel` | `sectionLabelCls` |
| `iconBtn` | `iconBtnCls` |
| `mutedText(size)` | `mutedTextCls(size)` |
| `monoMuted(size)` | `monoMutedCls(size)` |
| `pillBtn(primary, danger)` | `pillBtnCls(primary, danger)` |
| `chip(extra)` | `chipCls(extraClassName)` |
| `skillStatusStyle` / `verdictStyle` / `goalAlignStyle` / `statusChipStyle` | `skillStatusStyleCls` / `verdictStyleCls` / `goalAlignStyleCls` / `statusChipStyleCls` |

The non-`Cls` versions remain until every consumer is migrated, then get deleted.