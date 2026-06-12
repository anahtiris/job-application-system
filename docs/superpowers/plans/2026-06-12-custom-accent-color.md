# Custom Accent Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app's accent color configurable from Settings, with 8 curated color presets, persisted per-browser and applied app-wide instantly.

**Architecture:** The app currently has one fixed accent color expressed as three CSS custom properties — `--amb` (solid accent), `--amb-l` (light tint), `--amb-d` (contrast-shifted variant for badges) — registered as Tailwind utility tokens (`bg-amb`, `text-amb-d`, etc.) and used across ~17 frontend files. This plan:

1. Renames `amb`/`amb-l`/`amb-d` → `custom`/`custom-l`/`custom-d` everywhere (clearer name, avoids colliding with shadcn's existing `--accent` token).
2. Replaces the hand-picked `--custom-l`/`--custom-d` values with `color-mix()` formulas derived from `--custom` alone, and adds a new `--custom-hover` token (also derived) that replaces a hardcoded hex hover-border color used in two places.
3. Adds an 8-swatch color picker to Settings → Appearance that sets `--custom` and persists the choice to `localStorage`, following the exact same pattern as the existing Theme/Font-size controls (including pre-paint application in `layout.tsx` to avoid a flash of the old color).

After this plan, changing the accent color anywhere in the app means setting exactly one CSS variable (`--custom`); everything else (tints, badge text colors, hover borders, dark-mode variants) derives from it automatically.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS v4 (`@theme inline` token registration), CSS `color-mix()`, `localStorage`.

---

### Task 1: Rename `amb`/`amb-l`/`amb-d` tokens to `custom`/`custom-l`/`custom-d`

This is a pure rename — after this task the app must look **identical** to before (the default value of `--custom` is still the same amber hex).

**Files (modify, rename token only):**
- `app/frontend/app/globals.css`
- `app/frontend/app/page.tsx`
- `app/frontend/app/settings/page.tsx`
- `app/frontend/app/apply/[id]/page.tsx`
- `app/frontend/app/apply/new/page.tsx`
- `app/frontend/app/trash/page.tsx`
- `app/frontend/app/leads/page.tsx`
- `app/frontend/app/setup/page.tsx`
- `app/frontend/app/interview/CompanyPrepPanel.tsx`
- `app/frontend/app/interview/page.tsx`
- `app/frontend/app/interview/shared.tsx`
- `app/frontend/app/interview/TechnicalQuestionsPanel.tsx`
- `app/frontend/app/interview/GeneralPrepPanel.tsx`
- `app/frontend/app/applications/page.tsx`
- `app/frontend/app/skills/page.tsx`
- `app/frontend/components/AppShell.tsx`
- `app/frontend/components/ui-kit.tsx`

- [ ] **Step 1: Confirm the baseline match count**

Run from the repo root:

```bash
grep -rcP '\bamb\b' app/frontend/app app/frontend/components --include="*.tsx" --include="*.css" | grep -v ':0'
```

Expected output (17 files, 71 total matches, paths prefixed with `app/frontend/` since the grep runs from the repo root):

```
app/frontend/app/page.tsx:2
app/frontend/app/globals.css:9
app/frontend/app/apply/new/page.tsx:7
app/frontend/app/settings/page.tsx:3
app/frontend/app/leads/page.tsx:4
app/frontend/app/apply/[id]/page.tsx:6
app/frontend/app/trash/page.tsx:1
app/frontend/app/interview/shared.tsx:3
app/frontend/app/setup/page.tsx:2
app/frontend/app/interview/page.tsx:4
app/frontend/app/interview/GeneralPrepPanel.tsx:1
app/frontend/app/interview/CompanyPrepPanel.tsx:12
app/frontend/app/interview/TechnicalQuestionsPanel.tsx:1
app/frontend/app/skills/page.tsx:2
app/frontend/components/AppShell.tsx:2
app/frontend/app/applications/page.tsx:6
app/frontend/components/ui-kit.tsx:6
```

- [ ] **Step 2: Run the rename**

`\bamb\b` is a word-boundary match — it renames `--amb`, `--amb-l`, `--amb-d`, `bg-amb`, `text-amb-d`, `border-amb`, `accent-amb`, `outline-amb-d`, `--color-amb*`, `var(--amb-l)`, etc., but does **not** touch the unrelated Tailwind `amber-*` palette classes (e.g. `bg-amber-50` in `components/ReviewPanel.tsx`), because `r` immediately after `amb` in "amber" prevents the trailing word boundary.

Run from the repo root:

```bash
perl -pi -e 's/\bamb\b/custom/g' \
  app/frontend/app/globals.css \
  app/frontend/app/page.tsx \
  app/frontend/app/settings/page.tsx \
  'app/frontend/app/apply/[id]/page.tsx' \
  app/frontend/app/apply/new/page.tsx \
  app/frontend/app/trash/page.tsx \
  app/frontend/app/leads/page.tsx \
  app/frontend/app/setup/page.tsx \
  app/frontend/app/interview/CompanyPrepPanel.tsx \
  app/frontend/app/interview/page.tsx \
  app/frontend/app/interview/shared.tsx \
  app/frontend/app/interview/TechnicalQuestionsPanel.tsx \
  app/frontend/app/interview/GeneralPrepPanel.tsx \
  app/frontend/app/applications/page.tsx \
  app/frontend/app/skills/page.tsx \
  app/frontend/components/AppShell.tsx \
  app/frontend/components/ui-kit.tsx
```

- [ ] **Step 3: Verify the rename**

```bash
grep -rcP '\bamb\b' app/frontend/app app/frontend/components --include="*.tsx" --include="*.css" | grep -v ':0'
```

Expected: no output (all `amb` tokens renamed).

```bash
grep -rn 'amber-' app/frontend/components/ReviewPanel.tsx
```

Expected: the 3 `amber-*` Tailwind palette classes from `ReviewPanel.tsx:45,136,137` are still present, unchanged.

- [ ] **Step 4: Visual check**

Start the dev server if it isn't running:

```bash
cd app/frontend && npm run dev
```

Open `http://localhost:3000` in a browser. Check the dashboard, `/applications`, `/leads`, and `/settings` in both light and dark mode (toggle in Settings → Appearance → Theme). Everything should look **exactly as it did before** — same amber accent color, same badge colors, same hover states.

- [ ] **Step 5: Commit**

```bash
git add app/frontend/app app/frontend/components
git commit -m "refactor(ui): rename amb design tokens to custom"
```

---

### Task 2: Derive `--custom-l` / `--custom-d` via `color-mix()` and add `--custom-hover`

**Files:**
- Modify: `app/frontend/app/globals.css`

Current state after Task 1 (line numbers refer to the file *after* Task 1's rename):

```css
@theme inline {
  ...
  --color-custom: var(--custom);
  --color-custom-l: var(--custom-l);
  --color-custom-d: var(--custom-d);
  ...
}

:root {
  ...
  --custom: #BA7517;
  --custom-l: #FAEEDA;
  --custom-d: #854F0B;
  ...
}

.dark {
  ...
  --custom-l: rgba(186, 117, 23, 0.18);
  --custom-d: #E5A030;
  ...
}

...

.kanban-card:hover {
  border-color: #FAC775;
}
```

- [ ] **Step 1: Register `--color-custom-hover` in `@theme inline`**

Find:

```css
  --color-custom: var(--custom);
  --color-custom-l: var(--custom-l);
  --color-custom-d: var(--custom-d);
```

Replace with:

```css
  --color-custom: var(--custom);
  --color-custom-l: var(--custom-l);
  --color-custom-d: var(--custom-d);
  --color-custom-hover: var(--custom-hover);
```

- [ ] **Step 2: Replace the hand-picked light-mode values with `color-mix()`**

Find (in `:root`):

```css
  --custom: #BA7517;
  --custom-l: #FAEEDA;
  --custom-d: #854F0B;
```

Replace with:

```css
  --custom: #BA7517;
  --custom-l: color-mix(in srgb, var(--custom) 12%, white);
  --custom-d: color-mix(in srgb, var(--custom) 70%, black);
  --custom-hover: color-mix(in srgb, var(--custom) 45%, white);
```

- [ ] **Step 3: Replace the hand-picked dark-mode overrides with `color-mix()`**

Find (in `.dark`):

```css
  --custom-l: rgba(186, 117, 23, 0.18);
  --custom-d: #E5A030;
```

Replace with:

```css
  --custom-l: color-mix(in srgb, var(--custom) 18%, transparent);
  --custom-d: color-mix(in srgb, var(--custom) 65%, white);
```

- [ ] **Step 4: Replace the hardcoded kanban hover border**

Find:

```css
.kanban-card:hover {
  border-color: #FAC775;
}
```

Replace with:

```css
.kanban-card:hover {
  border-color: var(--custom-hover);
}
```

- [ ] **Step 5: Visual check**

With the dev server running, reload the dashboard (kanban board) in light and dark mode. The colors should look **very close to before** (the `color-mix()` formulas were checked against the original hand-picked values and reproduce them closely):
- Badge backgrounds/text (e.g. "Honest" chips on `/apply/[id]`, status badges on `/applications`) — light cream background with brown text in light mode, translucent amber background with bright amber text in dark mode.
- Hover a kanban card on the dashboard — border should turn a warm amber tone (was `#FAC775`, now derived).

- [ ] **Step 6: Commit**

```bash
git add app/frontend/app/globals.css
git commit -m "refactor(ui): derive custom-l/custom-d/custom-hover via color-mix"
```

---

### Task 3: Fix the remaining hardcoded `#FAC775` hover border

**Files:**
- Modify: `app/frontend/app/interview/page.tsx`

- [ ] **Step 1: Replace the hardcoded hex**

In `app/frontend/app/interview/page.tsx`, find (around line 28-32):

```tsx
      className={`block w-full text-left py-[9px] px-2.5 rounded-[7px] border-[0.5px] cursor-pointer mb-1.5 font-shell transition-colors ${
        active
          ? "border-custom bg-custom-l"
          : "border-border-tertiary bg-background-primary hover:border-[#FAC775]"
      } ${past && !active ? "opacity-60" : ""}`}
```

Replace with:

```tsx
      className={`block w-full text-left py-[9px] px-2.5 rounded-[7px] border-[0.5px] cursor-pointer mb-1.5 font-shell transition-colors ${
        active
          ? "border-custom bg-custom-l"
          : "border-border-tertiary bg-background-primary hover:border-custom-hover"
      } ${past && !active ? "opacity-60" : ""}`}
```

(Note: `border-custom bg-custom-l` here is the result of Task 1's rename — if Task 1 hasn't run yet, these would still read `border-amb bg-amb-l`.)

- [ ] **Step 2: Verify no hardcoded accent hex remains**

```bash
grep -rn '#FAC775\|#BA7517\|#FAEEDA\|#854F0B\|#E5A030' app/frontend/app app/frontend/components --include="*.tsx" --include="*.css"
```

Expected: only `app/frontend/app/globals.css` should match, for the single `--custom: #BA7517;` base definition (and nothing else).

- [ ] **Step 3: Visual check**

On `/interview`, in the left list of past/upcoming interviews, hover a non-active row — the border should turn the derived amber hover tone (same as the kanban card hover from Task 2).

- [ ] **Step 4: Commit**

```bash
git add app/frontend/app/interview/page.tsx
git commit -m "refactor(ui): use derived custom-hover for interview list hover border"
```

---

### Task 4: Add the accent color picker to Settings → Appearance

**Files:**
- Modify: `app/frontend/app/settings/page.tsx`

- [ ] **Step 1: Add the palette constant and `applyAccentColor` helper**

Find (near the top of the file, after the `applyTheme` function):

```tsx
function applyTheme(t: Theme) {
  if (t === "dark") {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
  } else if (t === "light") {
    localStorage.setItem("theme", "light");
    document.documentElement.classList.remove("dark");
  } else {
    localStorage.removeItem("theme");
    document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
}
```

Add immediately after it:

```tsx
const ACCENT_COLORS = [
  { name: "Amber", value: "#BA7517" },
  { name: "Red",   value: "#C0392B" },
  { name: "Rose",  value: "#C1467E" },
  { name: "Violet", value: "#7C5CBF" },
  { name: "Blue",  value: "#3B6EA8" },
  { name: "Teal",  value: "#2F8F82" },
  { name: "Green", value: "#4F8B3A" },
  { name: "Slate", value: "#5B6472" },
] as const;

const DEFAULT_ACCENT_COLOR = ACCENT_COLORS[0].value;

function applyAccentColor(hex: string) {
  localStorage.setItem("accentColor", hex);
  document.documentElement.style.setProperty("--custom", hex);
}
```

- [ ] **Step 2: Add `accentColor` state and load it on mount**

Find:

```tsx
export default function SettingsPage() {
  const [theme, setTheme]       = useState<Theme>("system");
  const [fontSize, setFontSize] = useState<FontSize>("normal");
```

Replace with:

```tsx
export default function SettingsPage() {
  const [theme, setTheme]       = useState<Theme>("system");
  const [fontSize, setFontSize] = useState<FontSize>("normal");
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_ACCENT_COLOR);
```

Find:

```tsx
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    setTheme(stored ?? "system");
    const storedFs = localStorage.getItem("fontSize") as FontSize | null;
    setFontSize(storedFs ?? "normal");
  }, []);
```

Replace with:

```tsx
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    setTheme(stored ?? "system");
    const storedFs = localStorage.getItem("fontSize") as FontSize | null;
    setFontSize(storedFs ?? "normal");
    const storedAccent = localStorage.getItem("accentColor");
    setAccentColor(storedAccent ?? DEFAULT_ACCENT_COLOR);
  }, []);
```

- [ ] **Step 3: Render the swatch row**

Find (the Appearance `SectionCard`):

```tsx
          {/* Appearance */}
          <SectionCard title="Appearance">
            <div className="flex flex-col gap-3.5">
              <div>
                <Label>Theme</Label>
                <SegmentGroup<Theme>
                  value={theme}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "system", label: "System" },
                    { value: "dark", label: "Dark" },
                  ]}
                  onChange={(t) => { setTheme(t); applyTheme(t); }}
                />
              </div>
              <div>
                <Label>Font size</Label>
                <SegmentGroup<FontSize>
                  value={fontSize}
                  options={(["normal", "large", "xl"] as FontSize[]).map((s) => ({ value: s, label: FONT_LABELS[s] }))}
                  onChange={(s) => { setFontSize(s); applyFontSize(s); }}
                />
              </div>
            </div>
          </SectionCard>
```

Replace with:

```tsx
          {/* Appearance */}
          <SectionCard title="Appearance">
            <div className="flex flex-col gap-3.5">
              <div>
                <Label>Theme</Label>
                <SegmentGroup<Theme>
                  value={theme}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "system", label: "System" },
                    { value: "dark", label: "Dark" },
                  ]}
                  onChange={(t) => { setTheme(t); applyTheme(t); }}
                />
              </div>
              <div>
                <Label>Font size</Label>
                <SegmentGroup<FontSize>
                  value={fontSize}
                  options={(["normal", "large", "xl"] as FontSize[]).map((s) => ({ value: s, label: FONT_LABELS[s] }))}
                  onChange={(s) => { setFontSize(s); applyFontSize(s); }}
                />
              </div>
              <div>
                <Label>Accent color</Label>
                <div className="flex gap-2.5">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-label={c.name}
                      title={c.name}
                      onClick={() => { setAccentColor(c.value); applyAccentColor(c.value); }}
                      className="w-6 h-6 rounded-full cursor-pointer border-none p-0"
                      style={{
                        backgroundColor: c.value,
                        boxShadow:
                          accentColor === c.value
                            ? `0 0 0 2px var(--color-background-primary), 0 0 0 4px ${c.value}`
                            : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
```

- [ ] **Step 4: Visual check**

On `/settings`, click each of the 8 swatches in turn:
- The selected swatch should show a "halo" ring (background-colored gap + colored ring).
- The app's primary accent (active nav tab, "Save" buttons, badges) should recolor instantly across the whole app — navigate to `/applications` or `/leads` to confirm.
- Reload the page (`Cmd+R`) — the chosen color and its selection ring should persist (this also exercises Task 5, do this check again after Task 5 if it doesn't yet pass).

- [ ] **Step 5: Commit**

```bash
git add app/frontend/app/settings/page.tsx
git commit -m "feat(settings): add accent color picker"
```

---

### Task 5: Apply the stored accent color before paint

**Files:**
- Modify: `app/frontend/app/layout.tsx`

- [ ] **Step 1: Extend the pre-paint script**

Find (in the `<head>` inline script):

```tsx
            __html: `(function(){var s=localStorage.getItem('theme'),m=window.matchMedia('(prefers-color-scheme: dark)');if(s==='dark'||(!s&&m.matches))document.documentElement.classList.add('dark');m.addEventListener('change',function(e){if(!localStorage.getItem('theme'))document.documentElement.classList.toggle('dark',e.matches);});var z={'large':'1.15','xl':'1.3'};var fs=localStorage.getItem('fontSize');if(fs&&z[fs])document.documentElement.style.zoom=z[fs];})();`,
```

Replace with:

```tsx
            __html: `(function(){var s=localStorage.getItem('theme'),m=window.matchMedia('(prefers-color-scheme: dark)');if(s==='dark'||(!s&&m.matches))document.documentElement.classList.add('dark');m.addEventListener('change',function(e){if(!localStorage.getItem('theme'))document.documentElement.classList.toggle('dark',e.matches);});var z={'large':'1.15','xl':'1.3'};var fs=localStorage.getItem('fontSize');if(fs&&z[fs])document.documentElement.style.zoom=z[fs];var ac=localStorage.getItem('accentColor');if(ac)document.documentElement.style.setProperty('--custom',ac);})();`,
```

- [ ] **Step 2: Visual check**

1. On `/settings`, pick a non-default accent color (e.g. Blue).
2. Hard-refresh the page (`Cmd+Shift+R`).
3. Confirm there is no flash of the old amber color before the page settles on blue — the active nav tab, sidebar icon, and "Save" buttons should be blue from the very first paint.
4. Switch back to "Amber" and confirm it round-trips correctly.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/app/layout.tsx
git commit -m "feat(settings): apply stored accent color before paint"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Run the linter**

```bash
cd app/frontend && npm run lint
```

Expected: no new errors introduced by this plan.

- [ ] **Step 2: Full manual sweep**

With the dev server running, for at least two accent colors (e.g. default Amber and one other, e.g. Teal) and both themes (light/dark), check:

| Page | What to look for |
|---|---|
| `/` (dashboard) | Kanban card hover border, "Applied"/"Interview" dot colors, icon backgrounds |
| `/applications` | Status badges ("Applied", default case), checkbox `accent-custom` |
| `/apply/[id]` (open any application) | "Honest"/"Watch out" chips, active step indicator, "Confirm" button, mailto link |
| `/apply/new` (start a new application) | Step indicator (active/done/upcoming), language toggle, "Watch out" chips |
| `/leads` | Status badges, lead avatar circle, "Approve" button |
| `/interview` | Active interview highlight, hover border on inactive rows |
| `/skills` | Tier 3 "Familiar" badge + outline |
| `/settings` | Theme/Font-size segment active state, "Save" buttons, swatch selection ring |
| Sidebar / topbar (`AppShell`) | Active tab underline + text color, dashboard icon background |

Everything driven by the accent should recolor consistently; nothing should remain stuck on the old amber when a different color is selected, and no element should look broken/illegible in either theme.

- [ ] **Step 3: Final commit (if any fixes were needed)**

If Step 2 turned up any missed spots, fix them, then:

```bash
git add -A
git commit -m "fix(ui): address accent color regressions from manual sweep"
```
