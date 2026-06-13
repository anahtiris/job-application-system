# Web App Favicon Design

## Goal

Replace the current default Next.js favicon (`app/frontend/app/favicon.ico`) with a custom favicon that matches the app's branding.

## Design

**File convention:** `app/frontend/app/icon.svg` — Next.js 16 App Router auto-detects this file and adds the appropriate `<link rel="icon">` tag (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`).

**Visual:** Mirrors the existing dashboard-link icon in `components/AppShell.tsx` (line 53) for brand consistency:
- 32×32 viewBox
- Rounded-square background, `fill="#BA7517"` (the same `--custom` amber used for the sidebar's dashboard button), `rx=7` (proportional to the sidebar's `rounded-[5px]` on a 22px box)
- Centered white Briefcase glyph (from `lucide-react`'s `briefcase.mjs` path data), scaled to ~55% of the box (matching the sidebar's 12px-icon-in-22px-box ratio)

## Implementation steps

1. Create `app/frontend/app/icon.svg` with the SVG described above.
2. Delete `app/frontend/app/favicon.ico` so the old default icon doesn't linger alongside the new one.
3. Verify in browser (dev server tab icon).

## Out of scope

- Dynamic theming: the favicon is static and won't track future changes to the `--custom` CSS variable. If the accent color becomes user-configurable and the favicon needs to follow it, that's a separate future task.
- Browser extension icon — out of scope for this design (web app favicon only).
