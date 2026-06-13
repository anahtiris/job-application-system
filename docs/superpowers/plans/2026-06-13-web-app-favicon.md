# Web App Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Next.js favicon with a custom amber briefcase icon matching the dashboard sidebar branding.

**Architecture:** Add `app/frontend/app/icon.svg` (Next.js App Router auto-detected icon file convention), remove the old `app/frontend/app/favicon.ico`, and verify the new icon renders in the browser tab.

**Tech Stack:** Next.js 16 (App Router file conventions), SVG.

---

### Task 1: Replace favicon with custom icon.svg

**Files:**
- Create: `app/frontend/app/icon.svg`
- Delete: `app/frontend/app/favicon.ico`

- [ ] **Step 1: Create the new icon file**

Create `app/frontend/app/icon.svg` with this content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="7" fill="#BA7517"/>
  <g transform="translate(7,7) scale(0.75)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    <rect width="20" height="14" x="2" y="6" rx="2"/>
  </g>
</svg>
```

This is a 32×32 rounded-square (`rx=7`) background filled `#BA7517` (the same amber used for the sidebar's dashboard-link button in `components/AppShell.tsx:53`), with a centered white Briefcase glyph (path data from `lucide-react`'s `briefcase.mjs`, scaled to 75% and centered via `translate(7,7) scale(0.75)`).

- [ ] **Step 2: Delete the old favicon**

```bash
rm app/frontend/app/favicon.ico
```

This prevents the old default Next.js icon from coexisting with the new one.

- [ ] **Step 3: Verify in browser**

Start the frontend dev server if not already running:

```bash
cd app/frontend && npm run dev
```

Open `http://localhost:3000` in a browser and confirm the browser tab shows the new amber briefcase icon (not the old default Next.js icon). If the old icon is cached, hard-refresh (Cmd+Shift+R) or open in a private/incognito window.

- [ ] **Step 4: Commit**

```bash
git add app/frontend/app/icon.svg app/frontend/app/favicon.ico
git commit -m "feat(frontend): replace default favicon with custom amber briefcase icon"
```

Note: `git add` on a deleted file stages the deletion.
