# Milestone 9 — Design Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the live Dr Shoes application up to parity with `handoff/design/` — graffiti design system, dark-ribbon admin shell, every admin view to design fidelity, full public landing.

**Architecture:** Fundament-first. Wave 1 rewrites the design system in `packages/ui/` (tokens, fonts, primitives), Wave 2 ships the admin shell, Waves 3–6 reskin every admin view with new primitives + add missing features (step timeline, sticky notes, kanban popup, client mini-profile, trigger edit-in-place, reservations queue), Wave 7 builds the public landing, Wave 8 audits + closes.

**Tech Stack:** Next.js 16 App Router + TypeScript + Tailwind + `packages/ui` workspace package + Spring Boot 3.4 backend (one slice for V016 product_reservation migration in 9-34). Vitest for component tests, Playwright for E2E.

**Spec source of truth:** `docs/superpowers/specs/2026-05-15-milestone-09-design-parity-design.md`

---

## Plan overview

**43 tasks across 8 waves** (`9-1` through `9-43`). All combined single-stage per anti-bloat directive 2026-05-11 (TWO-STAGE reserved for backend/security/state-machines/migrations; only 9-34's V016 backend slice qualifies but it's small enough to fit single-stage with strong test coverage).

| Wave | Tasks | Scope | Slice file (post-assembly) |
|---|---|---|---|
| 1 | 9-1 .. 9-14 (14 tasks) | Design system: tokens, fonts, Tailwind preset, 12 primitives + icons | Section A |
| 2 | 9-15 .. 9-17 (3 tasks) | Admin shell: AdminSidebar rewrite, AdminTopbar + PageHeaderContext, layout integration | Section B (waves 2+3) |
| 3 | 9-18 .. 9-22 (5 tasks) | Dashboard parity: StatTile integration, OrdersWeekChart restyle, MixDonut restyle, panels reskin, FreshReservationsPanel NEW | Section B |
| 4 | 9-23 .. 9-27 (5 tasks) | Orders list + drawer: .tbl table reskin, drawer step timeline NEW, sticky notes NEW, photo grid reskin, footer actions reskin | Section C (waves 4+5) |
| 5 | 9-28 .. 9-29 (2 tasks) | Calendar + Kanban: month/week/day restyle + UnscheduledOrdersPanel NEW, kanban reskin + post-drag popup | Section C |
| 6 | 9-30 .. 9-34 (5 tasks) | Messages + Triggers + Templates + Sklep + ReservationsQueue (includes V016 migration) | Section D |
| 7 | 9-35 .. 9-40 (6 tasks) | Public landing: StickyNav, Hero, Services, NewsTeaser, SklepTeaser, Contact + Footer | Section E |
| 8 | 9-41 .. 9-43 (3 tasks) | Parity audit + Clients reskin + milestone-9 tag | Section F |

---

## Cross-cutting integration notes (orchestrator MUST track)

These are NOT extra tasks — they are deviations / dependencies the slicers flagged that the executor must honour as they progress:

### A. After 9-1 lands: grep audit for `orderStatusColor` direct readers

The 9-1 token rewrite changes `orderStatusColor.W_REALIZACJI` from `#e6ff3a` (acid) → `#ff5a1f` (orange) and `GOTOWE_DO_ODBIORU` from `#ff2e88` (magenta) → `#18b06b` (green). Any existing component that reads `orderStatusColor` directly (instead of through the new `<Pill>` primitive) will silently render the wrong colour until those callsites are migrated to `<Pill>`.

**Action:** Immediately after 9-1 lands its commit, run:
```bash
grep -rn "orderStatusColor\|GOTOWE_DO_ODBIORU\|W_REALIZACJI" apps/web/app apps/web/components apps/web/lib --include='*.tsx' --include='*.ts'
```
Each hit must be either (a) migrated to `<Pill status={...}>` in the relevant wave 3/4/5/6 task, or (b) explicitly noted as intentional and left alone. The migrations naturally happen during the view-by-view reskins — but DO the grep so nothing slips through.

### B. 9-22 depends on 9-34's V016 endpoint

Slicer B flagged 9-22 (`FreshReservationsPanel`) as blocked on missing `/api/admin/reservations` endpoint and ships it with static placeholder data + `TODO(M10)` comments. Slicer D's 9-34 creates V016 `product_reservation` table + `ProductReservationController` exposing `GET /api/admin/sklep/{productId}/reservations`.

**Action:** After 9-34 lands, add a **5-line step at the end of 9-34's dispatch log** (or open `9-34b` as a hygiene followup if the executor prefers strict task atomicity) to wire `FreshReservationsPanel` to a new `GET /api/admin/reservations?limit=3&sort=createdAt,desc` endpoint. The endpoint may need a small additional controller method (list across products rather than per-product). The dashboard panel updates from placeholder rows to real data in this step.

### C. `packages/ui` has no vitest

The package's `package.json` test script is `echo "(no tests in 0A)"` and there's no vitest dep in `packages/ui`. Wave 1 primitive tests run in `apps/web`'s vitest context (jsdom + RTL already wired). Test files live under `packages/ui/src/components/__tests__/` and are picked up by `apps/web`'s `vitest.config.ts` content glob (verify the glob pattern in 9-1's setup steps).

### D. `log.debug` in primitives — omitted per "presentational" qualifier

Spec says `log.debug('op=<name>.render', { props })` in every primitive, but the spec also qualifies "log.debug optional" for presentational components. All 12 primitives in wave 1 ship WITHOUT log.debug to avoid coupling `packages/ui` to `apps/web`'s `lib/log.ts`. The shell components (AdminSidebar, AdminTopbar, AdminPageHeaderContext) DO include log.debug per the named-logger pattern.

### E. `*IntegrationTest.java` not `*IT.java`

Backend slice in 9-34 (V016 migration + ProductReservation entity + controller) uses `*IntegrationTest.java` suffix. The Failsafe `*IT.java` pattern is pluginManagement-only and does NOT execute in this project (M3 hygiene fact, see memory `project_session_2026_05_09_part4`). Slicer D applied this correctly — flagged here as a reminder for the executor.

### F. Drag-drop interactions stubbed

Per spec section 7 deferrals, drag-drop handlers in `<UnscheduledOrdersPanel>` (9-28), kanban "+ dodaj" column button (9-29), and order drawer "+ dodaj tag" chip (9-26) all stub their click/drag handlers with `console.warn('<feature> wkrótce')` + `// TODO M10` comments. UI ships visually; behaviour wires in M10.

---

## Dispatch protocol (per `feedback_dispatch_protocol.md`)

1. **Thin prompts.** Each dispatch points the subagent at this plan + task id + dispatch log template — NOT at the full task text. Subagent reads `docs/superpowers/plans/2026-05-15-milestone-09-design-parity.md` itself.
2. **Dispatch log per task.** Each subagent writes `docs/dispatch-log/9-N-<UTC>.md` with files, commands, test summary, decisions, commit SHA.
3. **Cross-session tracker.** `docs/dispatch-log/tasks.json` is authoritative across sessions. The 43 entries `9-1`..`9-43` were pre-created with status=pending. Each dispatch updates its entry's status and `commit_sha` field.
4. **Combined single-stage.** No TWO-STAGE in M9 per anti-bloat directive 2026-05-11.
5. **Foundation-first.** 9-1 dispatched solo. Owner approves the new token visuals (3 screenshots of existing pages with new tokens applied) before wave 1 fans out parallel.
6. **Wave gating.** Within a wave, parallel dispatch where there are no cross-file deps. Across waves, sequential — wave N+1 cannot start before wave N's tasks all merged.
7. **Anti-bloat dispatch template** (locked 2026-05-11): TS modules ≤ 80 LOC per granulate directive. If a component balloons past 80 LOC during impl, the subagent splits into sub-components AND flags it in their dispatch log for orchestrator visibility.

---

## Resume from a fresh session

After `/clear`, paste:

```
Read docs/superpowers/specs/2026-05-15-milestone-09-design-parity-design.md.
Read docs/superpowers/plans/2026-05-15-milestone-09-design-parity.md (start with the "Cross-cutting integration notes" section).
Verify HEAD with git log --oneline -1.
Confirm task status:
  python3 -c "import json;d=json.load(open('docs/dispatch-log/tasks.json'));[print(t['id'],t['status']) for t in d['tasks'] if t['id'].startswith('9-')]"
Then dispatch the next pending 9-N task per the dispatch template — thin prompt pointing at the plan + task id + dispatch log path.
```

---

# Wave 1 — Design system (9-1 .. 9-14)

> **Agentic workers:** implement task-by-task using `superpowers:subagent-driven-development`. Each task is a single commit. Read the spec at `docs/superpowers/specs/2026-05-15-milestone-09-design-parity-design.md` before starting. Write your dispatch log to `docs/dispatch-log/9-N-<UTC>.md` after each task.

---

## Task 9-1: Tokens + fonts + Tailwind preset + layout.tsx font wiring + globals.css utility classes

**Review:** combined single-stage (foundation dispatch — run solo before fanning out parallel 9-2..9-14)

**Why solo:** This task rewrites the shared token/font contract that every other Wave 1 task depends on. Token colours in the old file (`acid: "#e6ff3a"`, Bungee, Inter) differ from the new design system (`acid: "#d8ff3a"`, Anton, Inter Tight). Running this first and verifying the build compiles before any primitive is written prevents rebase churn across 13 parallel tasks.

**Files:**
- Modify: `packages/ui/src/tokens.ts` — full rewrite (new colour values + extended orderStatusColor)
- Modify: `packages/ui/src/fonts.ts` — add stencil descriptor + stencil CSS var
- Modify: `packages/ui/tailwind-preset.ts` — new boxShadow + gridTemplateColumns + fontFamily.stencil
- Modify: `apps/web/app/layout.tsx` — import Anton + Big_Shoulders_Stencil_Display + Inter_Tight; emit 5 font vars in `<html>` className
- Modify: `apps/web/app/globals.css` — append full graffiti utility class set verbatim from handoff/design/styles.css
- Create: `packages/ui/src/components/__tests__/tokens.test.ts` — vitest assertions for colour values + orderStatusColor mapping

**Acceptance:**
- `pnpm --filter @drshoes/web typecheck` exits 0.
- `pnpm --filter @drshoes/web test -- tokens` exits 0 with all assertions green.
- `pnpm --filter @drshoes/web build` completes without errors (font files fetched from Google Fonts CDN during build).

---

- [ ] **Step 1: RED — create tokens test, run, confirm fail**

  Create `packages/ui/src/components/__tests__/tokens.test.ts`:

  ```typescript
  import { describe, it, expect } from "vitest";
  import { colors, orderStatusColor } from "../../tokens";

  describe("colors", () => {
    it("acid is #d8ff3a per design spec", () => {
      expect(colors.acid).toBe("#d8ff3a");
    });
    it("magenta is #ff2e7e", () => {
      expect(colors.magenta).toBe("#ff2e7e");
    });
    it("ink is #0a0a0a", () => {
      expect(colors.ink).toBe("#0a0a0a");
    });
    it("ink2 is #1a1a1a", () => {
      expect(colors.ink2).toBe("#1a1a1a");
    });
    it("ink3 is #2a2a2a", () => {
      expect(colors.ink3).toBe("#2a2a2a");
    });
    it("paper is #f4efe6", () => {
      expect(colors.paper).toBe("#f4efe6");
    });
    it("paper2 is #ebe4d4", () => {
      expect(colors.paper2).toBe("#ebe4d4");
    });
    it("paper3 is #ddd3bd", () => {
      expect(colors.paper3).toBe("#ddd3bd");
    });
    it("blue is #2b5cff", () => {
      expect(colors.blue).toBe("#2b5cff");
    });
    it("orange is #ff5a1f", () => {
      expect(colors.orange).toBe("#ff5a1f");
    });
    it("green is #18b06b", () => {
      expect(colors.green).toBe("#18b06b");
    });
    it("red is #e1342b", () => {
      expect(colors.red).toBe("#e1342b");
    });
    it("adminMute is #6b6960", () => {
      expect(colors.adminMute).toBe("#6b6960");
    });
  });

  describe("orderStatusColor", () => {
    it("WSTEPNIE_PRZYJETE maps to adminMute", () => {
      expect(orderStatusColor.WSTEPNIE_PRZYJETE).toBe("#6b6960");
    });
    it("PRZYJETE maps to blue", () => {
      expect(orderStatusColor.PRZYJETE).toBe("#2b5cff");
    });
    it("W_REALIZACJI maps to orange", () => {
      expect(orderStatusColor.W_REALIZACJI).toBe("#ff5a1f");
    });
    it("CZEKA_NA_KLIENTA maps to dark yellow #a17a00", () => {
      expect(orderStatusColor.CZEKA_NA_KLIENTA).toBe("#a17a00");
    });
    it("GOTOWE_DO_ODBIORU maps to green (NOT magenta)", () => {
      expect(orderStatusColor.GOTOWE_DO_ODBIORU).toBe("#18b06b");
    });
    it("WYDANE maps to ink3", () => {
      expect(orderStatusColor.WYDANE).toBe("#2a2a2a");
    });
    it("ANULOWANE maps to red", () => {
      expect(orderStatusColor.ANULOWANE).toBe("#e1342b");
    });
  });
  ```

  Run — expected failure (current `tokens.ts` has `acid: "#e6ff3a"`, missing `ink2`/`ink3`/`paper3`/`red`, GOTOWE_DO_ODBIORU→magenta, WYDANE→green):

  ```bash
  cd apps/web && pnpm test -- tokens.test
  # FAIL: colors > acid is #d8ff3a per design spec
  # FAIL: colors > ink2 is #1a1a1a
  # ... (multiple failures expected)
  ```

- [ ] **Step 2: Rewrite `packages/ui/src/tokens.ts`**

  ```typescript
  // packages/ui/src/tokens.ts
  // Design token source of truth for Dr Shoes.
  // Values mirror handoff/design/styles.css verbatim — do not tweak.

  export const colors = {
    ink:           "#0a0a0a",
    ink2:          "#1a1a1a",
    ink3:          "#2a2a2a",
    paper:         "#f4efe6",
    paper2:        "#ebe4d4",
    paper3:        "#ddd3bd",
    adminBg:       "#f7f5ef",
    adminSurface:  "#ffffff",
    adminLine:     "#e3ddcc",
    adminInk:      "#1a1a1c",
    adminMute:     "#6b6960",
    acid:          "#d8ff3a",
    magenta:       "#ff2e7e",
    pink:          "#ff2e7e",   // alias — same hex, used in design JSX as both "magenta" and "pink"
    blue:          "#2b5cff",
    orange:        "#ff5a1f",
    green:         "#18b06b",
    red:           "#e1342b",
    line:          "rgba(10,10,10,0.18)",
    line2:         "rgba(10,10,10,0.08)",
  } as const;

  // BREAKING vs M7: GOTOWE_DO_ODBIORU was magenta — design spec says green.
  // BREAKING vs M7: W_REALIZACJI was acid — design spec says orange.
  // BREAKING vs M7: WYDANE was green — design spec says ink3 (muted).
  // BREAKING vs M7: ANULOWANE was adminMute — design spec says red.
  // Update every <Pill> call-site during task 9-5 (Pill primitive).
  export const orderStatusColor = {
    WSTEPNIE_PRZYJETE: colors.adminMute,
    PRZYJETE:          colors.blue,
    W_REALIZACJI:      colors.orange,
    CZEKA_NA_KLIENTA:  "#a17a00",   // dark yellow per design pill-czeka class
    GOTOWE_DO_ODBIORU: colors.green,
    WYDANE:            colors.ink3,
    ANULOWANE:         colors.red,
  } as const;

  export const productStatusColor = {
    DOSTEPNE:     colors.green,
    ZAREZERWOWANE: colors.magenta,
    SPRZEDANE:    colors.adminMute,
  } as const;

  export const radii = { xs: "2px", sm: "4px", md: "8px", lg: "16px" } as const;

  export const spacing = {
    none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, "2xl": 24, "3xl": 32, "4xl": 48,
  } as const;

  export const motion = {
    hoverZoom:  "300ms ease-out",
    drawer:     "240ms ease-out",
    statusFade: "160ms ease-out",
  } as const;
  ```

- [ ] **Step 3: Rewrite `packages/ui/src/fonts.ts`**

  ```typescript
  // packages/ui/src/fonts.ts
  // Font descriptors consumed by apps/web/app/layout.tsx via next/font/google.
  // CSS variable names must stay stable — consumed by tailwind-preset.ts and globals.css.

  export const fontDescriptors = {
    display: {
      name: "Anton",
      weights: [400],
      subsets: ["latin", "latin-ext"],
    },
    stencil: {
      name: "Big Shoulders Stencil Display",
      weights: [700, 800],
      subsets: ["latin", "latin-ext"],
    },
    marker: {
      name: "Permanent Marker",
      weights: [400],
      subsets: ["latin", "latin-ext"],
    },
    body: {
      name: "Inter Tight",
      weights: [300, 400, 500, 600, 700, 800],
      subsets: ["latin", "latin-ext"],
    },
    mono: {
      name: "JetBrains Mono",
      weights: [400, 500, 700],
      subsets: ["latin", "latin-ext"],
    },
  } as const;

  export const cssVars = {
    fontDisplay: "var(--font-display)",
    fontStencil: "var(--font-stencil)",
    fontMarker:  "var(--font-marker)",
    fontBody:    "var(--font-body)",
    fontMono:    "var(--font-mono)",
  } as const;
  ```

- [ ] **Step 4: Extend `packages/ui/tailwind-preset.ts`**

  ```typescript
  // packages/ui/tailwind-preset.ts
  import type { Config } from "tailwindcss";
  import { colors, radii, motion } from "./src/tokens";
  import { cssVars } from "./src/fonts";

  const preset: Partial<Config> = {
    theme: {
      extend: {
        colors: {
          ink:             colors.ink,
          "ink-2":         colors.ink2,
          "ink-3":         colors.ink3,
          paper:           colors.paper,
          "paper-2":       colors.paper2,
          "paper-3":       colors.paper3,
          "admin-bg":      colors.adminBg,
          "admin-surface": colors.adminSurface,
          "admin-line":    colors.adminLine,
          "admin-ink":     colors.adminInk,
          "admin-mute":    colors.adminMute,
          acid:            colors.acid,
          magenta:         colors.magenta,
          pink:            colors.pink,
          blue:            colors.blue,
          orange:          colors.orange,
          green:           colors.green,
          red:             colors.red,
        },
        borderRadius: { xs: radii.xs, sm: radii.sm, md: radii.md, lg: radii.lg },
        fontFamily: {
          display: [cssVars.fontDisplay, "Impact", "sans-serif"],
          stencil: [cssVars.fontStencil, "Impact", "sans-serif"],
          marker:  [cssVars.fontMarker,  "cursive"],
          sans:    [cssVars.fontBody,    "ui-sans-serif", "system-ui"],
          mono:    [cssVars.fontMono,    "ui-monospace", "monospace"],
        },
        boxShadow: {
          "pop":       "5px 5px 0 #0a0a0a",
          "pop-sm":    "3px 3px 0 #0a0a0a",
          "pop-card":  "3px 3px 0 #0a0a0a",
          "pop-pink":  "-6px 6px 0 #ff2e7e, -6px 6px 0 1.5px #0a0a0a",
          "pop-acid":  "-6px 6px 0 #d8ff3a, -6px 6px 0 1.5px #0a0a0a",
          "pop-blue":  "-6px 6px 0 #2b5cff, -6px 6px 0 1.5px #0a0a0a",
        },
        gridTemplateColumns: {
          "admin-msg-3": "320px 1fr 280px",
          "admin-trig":  "1.4fr 1fr",
          "admin-sklep": "1.5fr 1fr",
        },
        aspectRatio: {
          "4-3":   "4 / 3",
          "16-10": "16 / 10",
        },
        transitionTimingFunction: {
          "hover-zoom":  motion.hoverZoom.split(" ").pop()!,
          drawer:        motion.drawer.split(" ").pop()!,
          "status-fade": motion.statusFade.split(" ").pop()!,
        },
      },
    },
  };

  export default preset;
  ```

- [ ] **Step 5: Update `apps/web/app/layout.tsx` — wire 5 font instances**

  The old file imports `Bungee` and `Inter`; replace with `Anton`, `Big_Shoulders_Stencil_Display`, `Inter_Tight`. The `<html>` className gets all 5 variable classnames. Body stays clean (no className on body — font applied via globals.css `font-family: theme(fontFamily.sans)`).

  ```tsx
  // apps/web/app/layout.tsx
  import type { Metadata } from "next";
  import {
    Anton,
    Big_Shoulders_Stencil_Display,
    Permanent_Marker,
    Inter_Tight,
    JetBrains_Mono,
  } from "next/font/google";
  import "./globals.css";

  const fontDisplay = Anton({
    weight: "400",
    subsets: ["latin", "latin-ext"],
    variable: "--font-display",
    display: "swap",
  });
  const fontStencil = Big_Shoulders_Stencil_Display({
    weight: ["700", "800"],
    subsets: ["latin", "latin-ext"],
    variable: "--font-stencil",
    display: "swap",
  });
  const fontMarker = Permanent_Marker({
    weight: "400",
    subsets: ["latin"],
    variable: "--font-marker",
    display: "swap",
  });
  const fontBody = Inter_Tight({
    subsets: ["latin", "latin-ext"],
    variable: "--font-body",
    display: "swap",
  });
  const fontMono = JetBrains_Mono({
    subsets: ["latin", "latin-ext"],
    variable: "--font-mono",
    display: "swap",
  });

  export const metadata: Metadata = {
    title: "Dr Shoes — naprawy, custom malowanie, kurtki",
    description: "Pracownia szewska i custom painting. Naprawiamy, malujemy, ratujemy.",
  };

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    const fontVars = [
      fontDisplay.variable,
      fontStencil.variable,
      fontMarker.variable,
      fontBody.variable,
      fontMono.variable,
    ].join(" ");

    return (
      <html lang="pl" className={fontVars}>
        <body>{children}</body>
      </html>
    );
  }
  ```

- [ ] **Step 6: Append graffiti utility classes to `apps/web/app/globals.css`**

  The existing file ends at line 17. Append everything below after the existing `body { margin: 0; }` line. Values are verbatim from `handoff/design/styles.css` — do not paraphrase.

  ```css
  /* ============================================================
     Dr Shoes graffiti utility classes — sourced verbatim from
     handoff/design/styles.css. Do not edit values here;
     update handoff/design/styles.css and re-sync.
     ============================================================ */

  /* ---------- type ---------- */
  .t-display {
    font-family: var(--font-display);
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 0.92;
    text-transform: uppercase;
  }
  .t-stencil {
    font-family: var(--font-stencil);
    font-weight: 800;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }
  .t-tag { font-family: var(--font-marker); font-weight: 400; }
  .t-mono { font-family: var(--font-mono); }

  /* ---------- spray-paint noise ---------- */
  .noise::before {
    content: "";
    position: absolute; inset: 0;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>");
    mix-blend-mode: multiply;
    opacity: 0.18;
    pointer-events: none;
  }

  /* ---------- halftone overlay ---------- */
  .halftone::after {
    content: "";
    position: absolute; inset: 0;
    background-image: radial-gradient(rgba(0,0,0,0.85) 1px, transparent 1.5px);
    background-size: 5px 5px;
    mix-blend-mode: multiply;
    opacity: 0.18;
    pointer-events: none;
  }

  /* ---------- masking tape ---------- */
  .tape {
    position: relative;
    display: inline-block;
    padding: 4px 14px;
    background: rgba(216,255,58,0.85);
    color: var(--ink, #0a0a0a);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transform: rotate(-1.2deg);
    box-shadow: 1px 1px 0 rgba(0,0,0,0.15);
  }
  .tape::before, .tape::after {
    content: "";
    position: absolute; top: 0; bottom: 0; width: 8px;
    background: repeating-linear-gradient(135deg, rgba(0,0,0,0.12) 0 2px, transparent 2px 4px);
  }
  .tape::before { left: 0; }
  .tape::after { right: 0; }
  .tape-pink  { background: rgba(255,46,126,0.85); color: #f4efe6; }
  .tape-blue  { background: rgba(43,92,255,0.85);  color: #f4efe6; }
  .tape-paper { background: rgba(244,239,230,0.95); color: #0a0a0a; }

  /* ---------- stencil stamp ---------- */
  .stamp {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 2px solid currentColor;
    font-family: var(--font-stencil);
    font-weight: 800;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transform: rotate(-2deg);
    position: relative;
  }
  .stamp::before {
    content: "";
    position: absolute; inset: -2px;
    border: 2px solid currentColor;
    opacity: 0.35;
    transform: translate(2px, 2px);
    pointer-events: none;
  }
  .stamp-green { color: #0a7e44; }
  .stamp-pink  { color: #ff2e7e; }
  .stamp-ink   { color: #0a0a0a; }
  .stamp-blue  { color: #2b5cff; }

  /* ---------- spray-painted frame ---------- */
  .spray-frame {
    position: relative;
    outline: 3px solid #0a0a0a;
    outline-offset: 0;
    box-shadow: -6px 6px 0 #d8ff3a, -6px 6px 0 1.5px #0a0a0a;
  }
  .spray-frame.pink { box-shadow: -6px 6px 0 #ff2e7e, -6px 6px 0 1.5px #0a0a0a; }
  .spray-frame.blue { box-shadow: -6px 6px 0 #2b5cff, -6px 6px 0 1.5px #0a0a0a; }

  /* ---------- paint drip ---------- */
  .drip { position: relative; }
  .drip::after {
    content: "";
    position: absolute;
    left: 14%; top: 100%;
    width: 8px; height: 18px;
    background: currentColor;
    border-radius: 0 0 50% 50%;
  }

  /* ---------- sticker ---------- */
  .sticker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: #f4efe6;
    color: #0a0a0a;
    border: 2px solid #0a0a0a;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-radius: 999px;
    box-shadow: 2px 2px 0 #0a0a0a;
    transform: rotate(-1deg);
  }

  /* ---------- button system ---------- */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 22px;
    font-family: var(--font-stencil);
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 2.5px solid #0a0a0a;
    background: #0a0a0a;
    color: #f4efe6;
    cursor: pointer;
    position: relative;
    box-shadow: 5px 5px 0 #0a0a0a;
    transition: transform .12s, box-shadow .12s;
    text-decoration: none;
  }
  .btn:hover  { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 #0a0a0a; }
  .btn:active { transform: translate(2px, 2px);   box-shadow: 2px 2px 0 #0a0a0a; }
  .btn-acid  { background: #d8ff3a; color: #0a0a0a; box-shadow: 5px 5px 0 #0a0a0a; }
  .btn-pink  { background: #ff2e7e; color: #f4efe6; }
  .btn-paper { background: #f4efe6; color: #0a0a0a; }
  .btn-ghost { background: transparent; color: #0a0a0a; box-shadow: none; }
  .btn-ghost:hover { background: #0a0a0a; color: #f4efe6; transform: none; box-shadow: none; }
  .btn-sm { padding: 8px 14px; font-size: 12px; box-shadow: 3px 3px 0 #0a0a0a; }
  .btn-sm:hover { box-shadow: 5px 5px 0 #0a0a0a; }

  /* ---------- admin clean button variants ---------- */
  .btn-clean {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0;
    text-transform: none;
    border: 1.5px solid #0a0a0a;
    background: #fff;
    color: #0a0a0a;
    cursor: pointer;
    box-shadow: 2px 2px 0 #0a0a0a;
    transition: transform .1s, box-shadow .1s;
  }
  .btn-clean:hover   { transform: translate(-1px,-1px); box-shadow: 3px 3px 0 #0a0a0a; }
  .btn-clean.primary { background: #0a0a0a; color: #f4efe6; }
  .btn-clean.acid    { background: #d8ff3a; color: #0a0a0a; }

  /* ---------- image placeholder — diagonal stripes ---------- */
  .ph-img {
    position: relative;
    overflow: hidden;
    background:
      repeating-linear-gradient(45deg,
        #ebe4d4 0 14px,
        #ddd3bd 14px 28px);
    border: 2px solid #0a0a0a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(0,0,0,0.55);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-align: center;
  }
  .ph-img.dark {
    background:
      repeating-linear-gradient(45deg,
        #1c1c1c 0 14px,
        #262626 14px 28px);
    color: rgba(255,255,255,0.45);
    border-color: #f4efe6;
  }

  /* ---------- animated hover zoom for product cards ---------- */
  .zoom-card {
    position: relative;
    overflow: hidden;
    transition: transform .25s ease, box-shadow .25s ease;
  }
  .zoom-card .ph-img,
  .zoom-card .zoom-img {
    transition: transform .35s cubic-bezier(.2,.8,.2,1);
  }
  .zoom-card:hover .ph-img,
  .zoom-card:hover .zoom-img {
    transform: scale(1.55) rotate(-1.5deg);
  }

  /* ---------- admin shell ---------- */
  .admin-card {
    background: #fff;
    border: 1.5px solid #0a0a0a;
    box-shadow: 3px 3px 0 #0a0a0a;
  }

  /* ---------- tables ---------- */
  .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tbl th {
    text-align: left;
    font-family: var(--font-stencil);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 12px 14px;
    border-bottom: 2px solid #0a0a0a;
    background: #ebe4d4;
    color: #0a0a0a;
    font-weight: 700;
  }
  .tbl td {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(10,10,10,0.18);
    vertical-align: middle;
  }
  .tbl tr:hover td { background: rgba(216,255,58,0.18); cursor: pointer; }

  /* ---------- chips ---------- */
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px;
    border: 1.5px solid #0a0a0a;
    background: #fff;
    border-radius: 999px;
    font-size: 12px;
    font-family: var(--font-mono);
    font-weight: 600;
    cursor: pointer;
  }
  .chip.active { background: #d8ff3a; }
  .chip.pink   { background: #ff2e7e; color: #f4efe6; }

  /* ---------- status pills ---------- */
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 9px;
    font-family: var(--font-stencil);
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    border: 1.5px solid #0a0a0a;
    background: #fff;
  }
  .pill::before { content:""; width:7px; height:7px; border-radius:50%; background: currentColor; }
  .pill-przyjete   { color: #2b5cff; }
  .pill-realizacja { color: #ff5a1f; }
  .pill-czeka      { color: #a17a00; }
  .pill-gotowe     { color: #18b06b; }
  .pill-wydane     { color: #2a2a2a; opacity: .75; }
  .pill-anulowane  { color: #e1342b; }
  .pill-wstepne    { color: #6b6960; }

  /* ---------- sidebar links ---------- */
  .sb-link {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    font-family: var(--font-stencil);
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #f4efe6;
    text-decoration: none;
    border-left: 3px solid transparent;
    cursor: pointer;
  }
  .sb-link:hover { background: rgba(255,255,255,0.06); }
  .sb-link.active {
    background: rgba(216,255,58,0.12);
    border-left-color: #d8ff3a;
    color: #d8ff3a;
  }

  /* ---------- form fields ---------- */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .field input, .field textarea, .field select {
    font-family: var(--font-body);
    font-size: 14px;
    padding: 10px 12px;
    border: 1.5px solid #0a0a0a;
    background: #fff;
    color: #0a0a0a;
    box-shadow: 2px 2px 0 #0a0a0a;
  }
  .field input:focus,
  .field textarea:focus,
  .field select:focus {
    outline: 2px solid #d8ff3a;
    outline-offset: 1px;
  }

  /* ---------- rotation utilities ---------- */
  .rotate--2 { transform: rotate(-2deg); }
  .rotate--1 { transform: rotate(-1deg); }
  .rotate-1  { transform: rotate(1deg); }
  .rotate-2  { transform: rotate(2deg); }

  /* ---------- keyframes ---------- */
  @keyframes drawerIn {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }

  @keyframes hoverZoom {
    from { transform: scale(1)    rotate(0deg); }
    to   { transform: scale(1.55) rotate(-1.5deg); }
  }
  ```

- [ ] **Step 7: GREEN — run tests + typecheck**

  ```bash
  cd apps/web && pnpm test -- tokens.test
  # Expected: all 20 assertions PASS

  pnpm typecheck
  # Expected: 0 errors (new cssVars.fontStencil referenced in preset, layout references correct font classes)

  # Verify next/font names exist in the next/font/google package:
  node -e "const {Anton, Big_Shoulders_Stencil_Display, Inter_Tight} = require('next/font/google'); console.log('fonts ok');"
  # Expected: "fonts ok"
  ```

- [ ] **Step 8: Update `packages/ui/src/index.ts` barrel** (no-op now — tokens and fonts already exported; verify)

  ```typescript
  // packages/ui/src/index.ts
  export * from "./tokens";
  export * from "./fonts";
  ```

  Confirm it still compiles. The components barrel entries will be added incrementally by tasks 9-2..9-14.

- [ ] **Step 9: Commit**

  ```bash
  git add packages/ui/src/tokens.ts \
          packages/ui/src/fonts.ts \
          packages/ui/tailwind-preset.ts \
          packages/ui/src/index.ts \
          packages/ui/src/components/__tests__/tokens.test.ts \
          apps/web/app/layout.tsx \
          apps/web/app/globals.css
  git commit -m "$(cat <<'EOF'
  feat(ui): rewrite design tokens, fonts, tailwind preset; wire 5 next/font instances; append graffiti utility classes [milestone:9][task:9-1]

  - tokens.ts: new colour values (acid #d8ff3a, ink #0a0a0a, ink2/3, paper2/3, red);
    orderStatusColor updated (GOTOWE green not magenta, W_REALIZACJI orange, WYDANE ink3, ANULOWANE red)
  - fonts.ts: add stencil descriptor (Big Shoulders Stencil Display 700/800); switch display Bungee→Anton, body Inter→Inter Tight
  - tailwind-preset.ts: add boxShadow pop/pop-sm/pop-card/pop-pink/pop-acid/pop-blue;
    gridTemplateColumns admin-msg-3/admin-trig/admin-sklep; fontFamily.stencil; aspectRatio 4-3/16-10; new color tokens
  - layout.tsx: 5 next/font instances with CSS variable emission (display/stencil/marker/body/mono)
  - globals.css: full graffiti utility class set verbatim from handoff/design/styles.css
    (.t-display .t-stencil .t-tag .t-mono .tape .stamp .sticker .spray-frame .drip .ph-img
     .zoom-card .admin-card .tbl .chip .pill .sb-link .field .btn* .btn-clean* @keyframes)

  Refs: docs/dispatch-log/9-1-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-2: `Tape.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/Tape.tsx`
- Create: `packages/ui/src/components/__tests__/Tape.test.tsx`
- Modify: `packages/ui/src/index.ts` — append `export * from "./components/Tape"`

**Acceptance:** `pnpm --filter @drshoes/web test -- Tape` exits 0.

---

- [ ] **Step 1: RED — write Tape test**

  Create `packages/ui/src/components/__tests__/Tape.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { Tape } from "../Tape";

  describe("Tape", () => {
    it("renders children", () => {
      render(<Tape>hello</Tape>);
      expect(screen.getByText("hello")).toBeInTheDocument();
    });

    it("defaults to acid color class", () => {
      const { container } = render(<Tape>x</Tape>);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("tape");
      expect(el.className).not.toContain("tape-pink");
      expect(el.className).not.toContain("tape-blue");
    });

    it("applies tape-pink class when color=pink", () => {
      const { container } = render(<Tape color="pink">y</Tape>);
      expect((container.firstChild as HTMLElement).className).toContain("tape-pink");
    });

    it("applies tape-blue class when color=blue", () => {
      const { container } = render(<Tape color="blue">z</Tape>);
      expect((container.firstChild as HTMLElement).className).toContain("tape-blue");
    });

    it("applies tape-paper class when color=paper", () => {
      const { container } = render(<Tape color="paper">w</Tape>);
      expect((container.firstChild as HTMLElement).className).toContain("tape-paper");
    });

    it("applies custom angle via style", () => {
      const { container } = render(<Tape angle={3}>a</Tape>);
      const style = (container.firstChild as HTMLElement).getAttribute("style");
      expect(style).toContain("rotate(3deg)");
    });
  });
  ```

  Run — expected compile fail (Tape not yet created):

  ```bash
  cd apps/web && pnpm test -- Tape.test
  # Expected: Cannot find module '../Tape'
  ```

- [ ] **Step 2: GREEN — create `packages/ui/src/components/Tape.tsx`**

  ```tsx
  // packages/ui/src/components/Tape.tsx
  // Masking-tape decoration strip. Inherits .tape + color variant from globals.css.
  // < 40 LOC per granulate directive.

  import React from "react";

  export type TapeColor = "acid" | "pink" | "blue" | "paper";

  export interface TapeProps {
    children: React.ReactNode;
    color?: TapeColor;
    angle?: number;
    style?: React.CSSProperties;
    className?: string;
  }

  export function Tape({
    children,
    color = "acid",
    angle = -1.5,
    style,
    className = "",
  }: TapeProps) {
    const colorClass =
      color === "pink"  ? " tape-pink"  :
      color === "blue"  ? " tape-blue"  :
      color === "paper" ? " tape-paper" :
      "";

    return (
      <span
        className={`tape${colorClass} ${className}`.trim()}
        style={{ transform: `rotate(${angle}deg)`, ...style }}
      >
        {children}
      </span>
    );
  }
  ```

- [ ] **Step 3: Add barrel export**

  Append to `packages/ui/src/index.ts`:

  ```typescript
  export * from "./tokens";
  export * from "./fonts";
  export * from "./components/Tape";
  ```

- [ ] **Step 4: Run tests — GREEN**

  ```bash
  cd apps/web && pnpm test -- Tape.test
  # Expected: 6 tests PASS
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/ui/src/components/Tape.tsx \
          packages/ui/src/components/__tests__/Tape.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add Tape primitive [milestone:9][task:9-2]

  Masking-tape decoration strip with acid/pink/blue/paper color variants
  and configurable rotation angle. CSS class-based, no inline styles beyond transform.

  Refs: docs/dispatch-log/9-2-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-3: `Stamp.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/Stamp.tsx`
- Create: `packages/ui/src/components/__tests__/Stamp.test.tsx`
- Modify: `packages/ui/src/index.ts` — append `export * from "./components/Stamp"`

**Acceptance:** `pnpm --filter @drshoes/web test -- Stamp` exits 0.

---

- [ ] **Step 1: RED — write Stamp test**

  Create `packages/ui/src/components/__tests__/Stamp.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { Stamp } from "../Stamp";

  describe("Stamp", () => {
    it("renders children", () => {
      render(<Stamp>dostępne</Stamp>);
      expect(screen.getByText("dostępne")).toBeInTheDocument();
    });

    it("has .stamp base class", () => {
      const { container } = render(<Stamp>x</Stamp>);
      expect((container.firstChild as HTMLElement).className).toContain("stamp");
    });

    it("defaults to stamp-ink color class", () => {
      const { container } = render(<Stamp>x</Stamp>);
      expect((container.firstChild as HTMLElement).className).toContain("stamp-ink");
    });

    it("applies stamp-green class when color=green", () => {
      const { container } = render(<Stamp color="green">x</Stamp>);
      expect((container.firstChild as HTMLElement).className).toContain("stamp-green");
    });

    it("applies stamp-pink class when color=pink", () => {
      const { container } = render(<Stamp color="pink">x</Stamp>);
      expect((container.firstChild as HTMLElement).className).toContain("stamp-pink");
    });

    it("applies stamp-blue class when color=blue", () => {
      const { container } = render(<Stamp color="blue">x</Stamp>);
      expect((container.firstChild as HTMLElement).className).toContain("stamp-blue");
    });

    it("applies custom angle via style", () => {
      const { container } = render(<Stamp angle={0}>x</Stamp>);
      const style = (container.firstChild as HTMLElement).getAttribute("style");
      expect(style).toContain("rotate(0deg)");
    });
  });
  ```

  Run — expected fail (Stamp not yet created).

- [ ] **Step 2: GREEN — create `packages/ui/src/components/Stamp.tsx`**

  ```tsx
  // packages/ui/src/components/Stamp.tsx
  // Stencil spray-stamp badge. Inherits .stamp + color variant from globals.css.
  // < 40 LOC per granulate directive.

  import React from "react";

  export type StampColor = "green" | "pink" | "ink" | "blue";

  export interface StampProps {
    children: React.ReactNode;
    color?: StampColor;
    angle?: number;
    className?: string;
  }

  export function Stamp({
    children,
    color = "ink",
    angle = -2,
    className = "",
  }: StampProps) {
    return (
      <span
        className={`stamp stamp-${color} ${className}`.trim()}
        style={{ transform: `rotate(${angle}deg)` }}
      >
        {children}
      </span>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/Stamp";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- Stamp.test
  # Expected: 7 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/Stamp.tsx \
          packages/ui/src/components/__tests__/Stamp.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add Stamp primitive [milestone:9][task:9-3]

  Stencil spray-stamp badge with green/pink/ink/blue color variants and configurable
  rotation angle. Double-border illusion via CSS ::before pseudo-element in globals.css.

  Refs: docs/dispatch-log/9-3-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-4: `Sticker.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/Sticker.tsx`
- Create: `packages/ui/src/components/__tests__/Sticker.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- Sticker` exits 0.

---

- [ ] **Step 1: RED — write Sticker test**

  Create `packages/ui/src/components/__tests__/Sticker.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { Sticker } from "../Sticker";

  describe("Sticker", () => {
    it("renders children", () => {
      render(<Sticker>@dr_shoes · 38.4k</Sticker>);
      expect(screen.getByText("@dr_shoes · 38.4k")).toBeInTheDocument();
    });

    it("has .sticker class", () => {
      const { container } = render(<Sticker>x</Sticker>);
      expect((container.firstChild as HTMLElement).className).toContain("sticker");
    });

    it("applies default -1deg rotation", () => {
      const { container } = render(<Sticker>x</Sticker>);
      const style = (container.firstChild as HTMLElement).getAttribute("style");
      expect(style).toContain("rotate(-1deg)");
    });

    it("applies custom angle", () => {
      const { container } = render(<Sticker angle={2}>x</Sticker>);
      const style = (container.firstChild as HTMLElement).getAttribute("style");
      expect(style).toContain("rotate(2deg)");
    });
  });
  ```

  Run — expected fail.

- [ ] **Step 2: GREEN — create `packages/ui/src/components/Sticker.tsx`**

  ```tsx
  // packages/ui/src/components/Sticker.tsx
  // Pill-shaped sticker badge with ink border + 2px ink box-shadow.
  // < 30 LOC per granulate directive.

  import React from "react";

  export interface StickerProps {
    children: React.ReactNode;
    angle?: number;
    style?: React.CSSProperties;
    className?: string;
  }

  export function Sticker({ children, angle = -1, style, className = "" }: StickerProps) {
    return (
      <span
        className={`sticker ${className}`.trim()}
        style={{ transform: `rotate(${angle}deg)`, ...style }}
      >
        {children}
      </span>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/Sticker";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- Sticker.test
  # Expected: 4 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/Sticker.tsx \
          packages/ui/src/components/__tests__/Sticker.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add Sticker primitive [milestone:9][task:9-4]

  Pill-shaped sticker with mono font, ink border + 2px shadow, configurable rotation.

  Refs: docs/dispatch-log/9-4-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-5: `Pill.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/Pill.tsx`
- Create: `packages/ui/src/components/__tests__/Pill.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- Pill` exits 0. Each `OrderStatus` value renders with the correct pill CSS class and colour from the updated `orderStatusColor` map.

> **Important:** The `orderStatusColor` mapping changed in 9-1. After shipping 9-5, search `apps/web` for existing `<Pill>` usages and update any hardcoded status string or color prop — the new component drives colour from `orderStatusColor` internally.

---

- [ ] **Step 1: RED — write Pill test**

  Create `packages/ui/src/components/__tests__/Pill.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { Pill } from "../Pill";

  // The human-readable Polish labels per status key
  const LABEL: Record<string, string> = {
    WSTEPNIE_PRZYJETE: "wstępnie przyjęte",
    PRZYJETE:          "przyjęte",
    W_REALIZACJI:      "w realizacji",
    CZEKA_NA_KLIENTA:  "czeka na klienta",
    GOTOWE_DO_ODBIORU: "gotowe do odbioru",
    WYDANE:            "wydane",
    ANULOWANE:         "anulowane",
  };

  const STATUS_CLASS: Record<string, string> = {
    WSTEPNIE_PRZYJETE: "pill-wstepne",
    PRZYJETE:          "pill-przyjete",
    W_REALIZACJI:      "pill-realizacja",
    CZEKA_NA_KLIENTA:  "pill-czeka",
    GOTOWE_DO_ODBIORU: "pill-gotowe",
    WYDANE:            "pill-wydane",
    ANULOWANE:         "pill-anulowane",
  };

  const statuses = Object.keys(LABEL) as (keyof typeof LABEL)[];

  describe("Pill", () => {
    it("renders the Polish label for each status", () => {
      for (const s of statuses) {
        const { unmount } = render(<Pill status={s as any} />);
        expect(screen.getByText(LABEL[s])).toBeInTheDocument();
        unmount();
      }
    });

    it("applies the correct CSS class for each status", () => {
      for (const s of statuses) {
        const { container, unmount } = render(<Pill status={s as any} />);
        expect((container.firstChild as HTMLElement).className).toContain(STATUS_CLASS[s]);
        unmount();
      }
    });

    it("has .pill base class always", () => {
      const { container } = render(<Pill status="PRZYJETE" />);
      expect((container.firstChild as HTMLElement).className).toContain("pill");
    });
  });
  ```

  Run — expected fail (Pill not yet created).

- [ ] **Step 2: GREEN — create `packages/ui/src/components/Pill.tsx`**

  ```tsx
  // packages/ui/src/components/Pill.tsx
  // Order status pill badge. Colour driven by CSS class (globals.css .pill-* rules).
  // Polish labels are the canonical human-readable names per design.
  // < 50 LOC per granulate directive.

  import React from "react";

  export type OrderStatus =
    | "WSTEPNIE_PRZYJETE"
    | "PRZYJETE"
    | "W_REALIZACJI"
    | "CZEKA_NA_KLIENTA"
    | "GOTOWE_DO_ODBIORU"
    | "WYDANE"
    | "ANULOWANE";

  const STATUS_META: Record<OrderStatus, { cls: string; label: string }> = {
    WSTEPNIE_PRZYJETE: { cls: "pill-wstepne",    label: "wstępnie przyjęte" },
    PRZYJETE:          { cls: "pill-przyjete",    label: "przyjęte" },
    W_REALIZACJI:      { cls: "pill-realizacja",  label: "w realizacji" },
    CZEKA_NA_KLIENTA:  { cls: "pill-czeka",       label: "czeka na klienta" },
    GOTOWE_DO_ODBIORU: { cls: "pill-gotowe",      label: "gotowe do odbioru" },
    WYDANE:            { cls: "pill-wydane",       label: "wydane" },
    ANULOWANE:         { cls: "pill-anulowane",   label: "anulowane" },
  };

  export interface PillProps {
    status: OrderStatus;
    className?: string;
  }

  export function Pill({ status, className = "" }: PillProps) {
    const { cls, label } = STATUS_META[status] ?? { cls: "pill-wstepne", label: status };
    return (
      <span className={`pill ${cls} ${className}`.trim()}>
        {label}
      </span>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/Pill";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- Pill.test
  # Expected: 3 tests (covering all 7 statuses) PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/Pill.tsx \
          packages/ui/src/components/__tests__/Pill.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add Pill order-status primitive [milestone:9][task:9-5]

  Status pill with Polish labels and CSS class colour mapping.
  GOTOWE_DO_ODBIORU now maps to pill-gotowe (green) per updated design spec.
  Existing call-sites using hardcoded colour props must be updated in consuming views.

  Refs: docs/dispatch-log/9-5-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-6: `Chip.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/Chip.tsx`
- Create: `packages/ui/src/components/__tests__/Chip.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- Chip` exits 0.

---

- [ ] **Step 1: RED — write Chip test**

  Create `packages/ui/src/components/__tests__/Chip.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { Chip } from "../Chip";

  describe("Chip", () => {
    it("renders children", () => {
      render(<Chip>tydzień</Chip>);
      expect(screen.getByText("tydzień")).toBeInTheDocument();
    });

    it("has .chip base class", () => {
      const { container } = render(<Chip>x</Chip>);
      expect((container.firstChild as HTMLElement).className).toContain("chip");
    });

    it("adds .active class when active=true", () => {
      const { container } = render(<Chip active>x</Chip>);
      expect((container.firstChild as HTMLElement).className).toContain("active");
    });

    it("does not add .active when active=false", () => {
      const { container } = render(<Chip active={false}>x</Chip>);
      expect((container.firstChild as HTMLElement).className).not.toContain("active");
    });

    it("adds .pink class when color=pink", () => {
      const { container } = render(<Chip color="pink">x</Chip>);
      expect((container.firstChild as HTMLElement).className).toContain("pink");
    });

    it("calls onClick when clicked", () => {
      const handler = vi.fn();
      render(<Chip onClick={handler}>click me</Chip>);
      fireEvent.click(screen.getByText("click me"));
      expect(handler).toHaveBeenCalledOnce();
    });

    it("renders icon slot if provided", () => {
      render(<Chip icon={<span data-testid="ico" />}>x</Chip>);
      expect(screen.getByTestId("ico")).toBeInTheDocument();
    });
  });
  ```

  Run — expected fail.

- [ ] **Step 2: GREEN — create `packages/ui/src/components/Chip.tsx`**

  ```tsx
  // packages/ui/src/components/Chip.tsx
  // Filter chip — toggleable pill with active/pink states from globals.css.
  // < 40 LOC per granulate directive.

  import React from "react";

  export type ChipColor = "default" | "pink";

  export interface ChipProps {
    children: React.ReactNode;
    active?: boolean;
    color?: ChipColor;
    onClick?: () => void;
    icon?: React.ReactNode;
    className?: string;
  }

  export function Chip({
    children,
    active = false,
    color = "default",
    onClick,
    icon,
    className = "",
  }: ChipProps) {
    const cls = [
      "chip",
      active ? "active" : "",
      color === "pink" ? "pink" : "",
      className,
    ].filter(Boolean).join(" ");

    return (
      <span className={cls} onClick={onClick} role={onClick ? "button" : undefined}>
        {icon && <span className="flex items-center">{icon}</span>}
        {children}
      </span>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/Chip";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- Chip.test
  # Expected: 7 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/Chip.tsx \
          packages/ui/src/components/__tests__/Chip.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add Chip filter-chip primitive [milestone:9][task:9-6]

  Toggleable filter chip with active/pink variants and optional icon slot.
  Driven by .chip / .chip.active / .chip.pink from globals.css.

  Refs: docs/dispatch-log/9-6-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-7: `Splatter.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/Splatter.tsx`
- Create: `packages/ui/src/components/__tests__/Splatter.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- Splatter` exits 0.

---

- [ ] **Step 1: RED — write Splatter test**

  Create `packages/ui/src/components/__tests__/Splatter.test.tsx`:

  ```tsx
  import { render } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { Splatter } from "../Splatter";

  describe("Splatter", () => {
    it("renders an svg element", () => {
      const { container } = render(<Splatter color="#d8ff3a" />);
      expect(container.querySelector("svg")).toBeTruthy();
    });

    it("sets width and height from size prop", () => {
      const { container } = render(<Splatter color="#d8ff3a" size={180} />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("width")).toBe("180");
      expect(svg.getAttribute("height")).toBe("180");
    });

    it("uses default size 220 when not specified", () => {
      const { container } = render(<Splatter color="red" />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("width")).toBe("220");
    });

    it("fills circles with the provided color", () => {
      const { container } = render(<Splatter color="#ff2e7e" />);
      const g = container.querySelector("g");
      expect(g?.getAttribute("fill")).toBe("#ff2e7e");
    });

    it("is absolutely positioned with pointer-events none", () => {
      const { container } = render(<Splatter color="blue" />);
      const svg = container.querySelector("svg")!;
      const style = svg.getAttribute("style") ?? "";
      expect(style).toContain("position: absolute");
      expect(style).toContain("pointer-events: none");
    });
  });
  ```

  Run — expected fail.

- [ ] **Step 2: GREEN — create `packages/ui/src/components/Splatter.tsx`**

  The shape is verbatim from `handoff/design/shared.jsx` Splatter component.

  ```tsx
  // packages/ui/src/components/Splatter.tsx
  // SVG spray splatter blob — absolute-positioned decorative accent.
  // Circle coordinates verbatim from handoff/design/shared.jsx.
  // < 50 LOC per granulate directive.

  import React from "react";

  export interface SplatterProps {
    color: string;
    size?: number;
    opacity?: number;
    style?: React.CSSProperties;
    className?: string;
  }

  export function Splatter({
    color,
    size = 220,
    opacity = 1,
    style,
    className = "",
  }: SplatterProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        className={className}
        style={{ position: "absolute", pointerEvents: "none", opacity, ...style }}
      >
        <g fill={color}>
          <circle cx="100" cy="100" r="48" />
          <circle cx="40"  cy="60"  r="9"  />
          <circle cx="170" cy="80"  r="6"  />
          <circle cx="160" cy="160" r="11" />
          <circle cx="50"  cy="170" r="7"  />
          <circle cx="20"  cy="120" r="4"  />
          <circle cx="180" cy="40"  r="3"  />
          <circle cx="135" cy="40"  r="5"  />
          <circle cx="75"  cy="30"  r="3"  />
          <circle cx="190" cy="120" r="4"  />
          <circle cx="100" cy="190" r="3"  />
          <circle cx="65"  cy="105" r="2.5"/>
          <circle cx="145" cy="120" r="2"  />
        </g>
      </svg>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/Splatter";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- Splatter.test
  # Expected: 5 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/Splatter.tsx \
          packages/ui/src/components/__tests__/Splatter.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add Splatter SVG accent primitive [milestone:9][task:9-7]

  Absolutely-positioned spray-splatter SVG blob with configurable color, size, opacity.
  Circle coordinates verbatim from handoff/design/shared.jsx.

  Refs: docs/dispatch-log/9-7-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-8: `PhImg.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/PhImg.tsx`
- Create: `packages/ui/src/components/__tests__/PhImg.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- PhImg` exits 0.

---

- [ ] **Step 1: RED — write PhImg test**

  Create `packages/ui/src/components/__tests__/PhImg.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { PhImg } from "../PhImg";

  describe("PhImg", () => {
    it("renders label text", () => {
      render(<PhImg label="ZDJĘCIE" />);
      expect(screen.getByText("ZDJĘCIE")).toBeInTheDocument();
    });

    it("defaults label to IMG when not specified", () => {
      render(<PhImg />);
      expect(screen.getByText("IMG")).toBeInTheDocument();
    });

    it("has .ph-img base class", () => {
      const { container } = render(<PhImg label="x" />);
      expect((container.firstChild as HTMLElement).className).toContain("ph-img");
    });

    it("adds .dark class when dark=true", () => {
      const { container } = render(<PhImg label="x" dark />);
      expect((container.firstChild as HTMLElement).className).toContain("dark");
    });

    it("does not add .dark class when dark=false", () => {
      const { container } = render(<PhImg label="x" dark={false} />);
      expect((container.firstChild as HTMLElement).className).not.toContain("dark");
    });

    it("passes through style prop", () => {
      const { container } = render(<PhImg label="x" style={{ width: 80, height: 80 }} />);
      const el = container.firstChild as HTMLElement;
      expect(el.style.width).toBe("80px");
      expect(el.style.height).toBe("80px");
    });

    it("passes through aspectRatio style", () => {
      const { container } = render(<PhImg label="x" aspectRatio="4/3" />);
      const el = container.firstChild as HTMLElement;
      expect(el.style.aspectRatio).toBe("4/3");
    });
  });
  ```

  Run — expected fail.

- [ ] **Step 2: GREEN — create `packages/ui/src/components/PhImg.tsx`**

  ```tsx
  // packages/ui/src/components/PhImg.tsx
  // Diagonal-stripe image placeholder. Inherits .ph-img / .ph-img.dark from globals.css.
  // < 40 LOC per granulate directive.

  import React from "react";

  export interface PhImgProps {
    label?: string;
    dark?: boolean;
    aspectRatio?: string;
    style?: React.CSSProperties;
    className?: string;
  }

  export function PhImg({
    label = "IMG",
    dark = false,
    aspectRatio,
    style,
    className = "",
  }: PhImgProps) {
    return (
      <div
        className={`ph-img ${dark ? "dark" : ""} ${className}`.trim()}
        style={{ aspectRatio, ...style }}
      >
        <span style={{ padding: "0 12px" }}>{label}</span>
      </div>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/PhImg";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- PhImg.test
  # Expected: 7 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/PhImg.tsx \
          packages/ui/src/components/__tests__/PhImg.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add PhImg placeholder image primitive [milestone:9][task:9-8]

  Diagonal-stripe placeholder div with light/dark variants, aspectRatio passthrough,
  and label text. CSS-driven via .ph-img and .ph-img.dark from globals.css.

  Refs: docs/dispatch-log/9-8-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-9: `DrShoesMark.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/DrShoesMark.tsx`
- Create: `packages/ui/src/components/__tests__/DrShoesMark.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- DrShoesMark` exits 0. The mark renders "Dr.Shoes" display text with the accent dot.

---

- [ ] **Step 1: RED — write DrShoesMark test**

  Create `packages/ui/src/components/__tests__/DrShoesMark.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { DrShoesMark } from "../DrShoesMark";

  describe("DrShoesMark", () => {
    it("renders the Dr and Shoes text parts", () => {
      const { container } = render(<DrShoesMark size={1} color="#0a0a0a" accent="#d8ff3a" />);
      expect(container.textContent).toContain("Dr");
      expect(container.textContent).toContain("Shoes");
    });

    it("renders the accent dot as a span with the accent color", () => {
      const { container } = render(<DrShoesMark size={1} color="#0a0a0a" accent="#d8ff3a" />);
      const dot = container.querySelector("span");
      expect(dot?.textContent).toBe(".");
      const style = dot?.getAttribute("style") ?? "";
      expect(style).toContain("#d8ff3a");
    });

    it("scales font-size by size prop", () => {
      const { container } = render(<DrShoesMark size={0.5} color="#0a0a0a" accent="#d8ff3a" />);
      const inner = container.firstChild as HTMLElement;
      // fontSize = 64 * 0.5 = 32
      expect(inner.style.fontSize).toBe("32px");
    });

    it("applies color to wrapper text", () => {
      const { container } = render(<DrShoesMark size={1} color="#ffffff" accent="#d8ff3a" />);
      const inner = container.firstChild as HTMLElement;
      expect(inner.style.color).toBe("rgb(255, 255, 255)");
    });
  });
  ```

  Run — expected fail.

- [ ] **Step 2: GREEN — create `packages/ui/src/components/DrShoesMark.tsx`**

  Layout verbatim from `handoff/design/shared.jsx` DrShoesMark function, converted to TypeScript React.

  ```tsx
  // packages/ui/src/components/DrShoesMark.tsx
  // Brand wordmark — "Dr.Shoes" in display font with accent dot.
  // Layout verbatim from handoff/design/shared.jsx DrShoesMark component.
  // < 60 LOC per granulate directive.

  import React from "react";

  export interface DrShoesMarkProps {
    size?: number;
    color?: string;
    accent?: string;
    style?: React.CSSProperties;
    className?: string;
  }

  export function DrShoesMark({
    size = 1,
    color = "var(--ink, #0a0a0a)",
    accent = "var(--acid, #d8ff3a)",
    style,
    className = "",
  }: DrShoesMarkProps) {
    return (
      <div
        className={className}
        style={{ display: "inline-block", position: "relative", ...style }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 64 * size,
            lineHeight: 0.85,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color,
            position: "relative",
            zIndex: 1,
          }}
        >
          Dr
          <span
            style={{
              color: accent,
              WebkitTextStroke: `2px ${color}`,
            }}
          >
            .
          </span>
          Shoes
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/DrShoesMark";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- DrShoesMark.test
  # Expected: 4 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/DrShoesMark.tsx \
          packages/ui/src/components/__tests__/DrShoesMark.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add DrShoesMark brand wordmark primitive [milestone:9][task:9-9]

  Display-font wordmark "Dr.Shoes" with configurable size scale, text color,
  and accent dot color. Layout verbatim from handoff/design/shared.jsx.

  Refs: docs/dispatch-log/9-9-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-10: `AdminCard.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/AdminCard.tsx`
- Create: `packages/ui/src/components/__tests__/AdminCard.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- AdminCard` exits 0.

---

- [ ] **Step 1: RED — write AdminCard test**

  Create `packages/ui/src/components/__tests__/AdminCard.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { AdminCard } from "../AdminCard";

  describe("AdminCard", () => {
    it("renders children", () => {
      render(<AdminCard>content here</AdminCard>);
      expect(screen.getByText("content here")).toBeInTheDocument();
    });

    it("has .admin-card class", () => {
      const { container } = render(<AdminCard>x</AdminCard>);
      expect((container.firstChild as HTMLElement).className).toContain("admin-card");
    });

    it("applies padding style when padding prop provided", () => {
      const { container } = render(<AdminCard padding={18}>x</AdminCard>);
      const el = container.firstChild as HTMLElement;
      expect(el.style.padding).toBe("18px");
    });

    it("has no inline padding when padding prop omitted", () => {
      const { container } = render(<AdminCard>x</AdminCard>);
      const el = container.firstChild as HTMLElement;
      expect(el.style.padding).toBe("");
    });
  });
  ```

  Run — expected fail.

- [ ] **Step 2: GREEN — create `packages/ui/src/components/AdminCard.tsx`**

  ```tsx
  // packages/ui/src/components/AdminCard.tsx
  // White admin surface card with 1.5px ink border + 3px pop-card shadow.
  // CSS class .admin-card from globals.css.
  // < 30 LOC per granulate directive.

  import React from "react";

  export interface AdminCardProps {
    children: React.ReactNode;
    padding?: number;
    className?: string;
    style?: React.CSSProperties;
  }

  export function AdminCard({ children, padding, className = "", style }: AdminCardProps) {
    return (
      <div
        className={`admin-card ${className}`.trim()}
        style={{ padding: padding !== undefined ? padding : undefined, ...style }}
      >
        {children}
      </div>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/AdminCard";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- AdminCard.test
  # Expected: 4 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/AdminCard.tsx \
          packages/ui/src/components/__tests__/AdminCard.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add AdminCard surface primitive [milestone:9][task:9-10]

  White card with 1.5px ink border and 3px pop-card shadow via .admin-card class.
  Optional padding prop for programmatic internal spacing.

  Refs: docs/dispatch-log/9-10-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-11: `StatTile.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/StatTile.tsx`
- Create: `packages/ui/src/components/__tests__/StatTile.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- StatTile` exits 0. Accent colour rotated square renders for each supported token.

---

- [ ] **Step 1: RED — write StatTile test**

  Create `packages/ui/src/components/__tests__/StatTile.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { StatTile } from "../StatTile";

  describe("StatTile", () => {
    it("renders label", () => {
      render(<StatTile label="W realizacji" value="14" accent="#d8ff3a" />);
      expect(screen.getByText("W realizacji")).toBeInTheDocument();
    });

    it("renders value", () => {
      render(<StatTile label="Przychód" value="18 240 zł" accent="#d8ff3a" />);
      expect(screen.getByText("18 240 zł")).toBeInTheDocument();
    });

    it("renders sub when provided", () => {
      render(<StatTile label="x" value="0" sub="↑ 3 vs zeszły tydzień" accent="#d8ff3a" />);
      expect(screen.getByText("↑ 3 vs zeszły tydzień")).toBeInTheDocument();
    });

    it("does not render sub when omitted", () => {
      const { container } = render(<StatTile label="x" value="0" accent="#d8ff3a" />);
      // No sub element present
      expect(container.querySelectorAll("[data-sub]").length).toBe(0);
    });

    it("renders the accent colour box with correct background", () => {
      const { container } = render(<StatTile label="x" value="0" accent="#ff2e7e" />);
      // accent decorative element carries the color in style
      const accentEl = container.querySelector("[data-accent]") as HTMLElement;
      expect(accentEl.style.background).toBe("rgb(255, 46, 126)");
    });

    it("has .admin-card wrapper", () => {
      const { container } = render(<StatTile label="x" value="0" accent="#d8ff3a" />);
      expect((container.firstChild as HTMLElement).className).toContain("admin-card");
    });
  });
  ```

  Run — expected fail.

- [ ] **Step 2: GREEN — create `packages/ui/src/components/StatTile.tsx`**

  Shape verbatim from `handoff/design/shared.jsx` Stat component, converted to TypeScript React.

  ```tsx
  // packages/ui/src/components/StatTile.tsx
  // Dashboard KPI stat tile: label (mono) + large display value + optional sub + accent blob.
  // Design verbatim from handoff/design/shared.jsx Stat component.
  // < 50 LOC per granulate directive.

  import React from "react";

  export interface StatTileProps {
    label: string;
    value: string | number;
    sub?: string;
    accent: string;
    className?: string;
  }

  export function StatTile({ label, value, sub, accent, className = "" }: StatTileProps) {
    return (
      <div
        className={`admin-card ${className}`.trim()}
        style={{ padding: 18, position: "relative", overflow: "hidden" }}
      >
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,0.55)",
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 44,
          lineHeight: 1,
          marginTop: 6,
          color: "var(--ink, #0a0a0a)",
        }}>
          {value}
        </div>
        {sub && (
          <div
            data-sub
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,0,0,0.55)", marginTop: 8 }}
          >
            {sub}
          </div>
        )}
        <div
          data-accent
          style={{
            position: "absolute", top: -10, right: -10,
            width: 60, height: 60,
            background: accent,
            transform: "rotate(15deg)",
          }}
        />
      </div>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/StatTile";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- StatTile.test
  # Expected: 6 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/StatTile.tsx \
          packages/ui/src/components/__tests__/StatTile.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add StatTile KPI dashboard primitive [milestone:9][task:9-11]

  AdminCard wrapper with mono label, display-font value, optional sub line,
  and a colour-rotated accent blob. Verbatim from handoff/design/shared.jsx Stat.

  Refs: docs/dispatch-log/9-11-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-12: `Toggle.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/Toggle.tsx`
- Create: `packages/ui/src/components/__tests__/Toggle.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- Toggle` exits 0. On state shows acid dot; off state shows muted dot.

---

- [ ] **Step 1: RED — write Toggle test**

  Create `packages/ui/src/components/__tests__/Toggle.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { Toggle } from "../Toggle";

  describe("Toggle", () => {
    it("renders without crashing", () => {
      render(<Toggle on={false} />);
    });

    it("has role=switch", () => {
      render(<Toggle on={false} />);
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("aria-checked=true when on=true", () => {
      render(<Toggle on={true} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("aria-checked=false when on=false", () => {
      render(<Toggle on={false} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    it("calls onChange when clicked", () => {
      const handler = vi.fn();
      render(<Toggle on={false} onChange={handler} />);
      fireEvent.click(screen.getByRole("switch"));
      expect(handler).toHaveBeenCalledWith(true);
    });

    it("calls onChange with false when on=true and clicked", () => {
      const handler = vi.fn();
      render(<Toggle on={true} onChange={handler} />);
      fireEvent.click(screen.getByRole("switch"));
      expect(handler).toHaveBeenCalledWith(false);
    });
  });
  ```

  Run — expected fail.

- [ ] **Step 2: GREEN — create `packages/ui/src/components/Toggle.tsx`**

  ```tsx
  // packages/ui/src/components/Toggle.tsx
  // Ink ribbon toggle: off = muted dot, on = acid dot.
  // No Radix dependency — this is a purely visual custom toggle (Radix Switch
  // is reserved for accessible form fields in the admin views themselves).
  // < 40 LOC per granulate directive.

  import React from "react";

  export interface ToggleProps {
    on: boolean;
    onChange?: (nextValue: boolean) => void;
    disabled?: boolean;
    className?: string;
  }

  export function Toggle({ on, onChange, disabled = false, className = "" }: ToggleProps) {
    const track: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      width: 40,
      height: 22,
      borderRadius: 999,
      background: on ? "#0a0a0a" : "#e3ddcc",
      border: "1.5px solid #0a0a0a",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "background 0.15s",
      padding: "0 3px",
      position: "relative",
    };

    const dot: React.CSSProperties = {
      width: 14,
      height: 14,
      borderRadius: "50%",
      background: on ? "#d8ff3a" : "#6b6960",
      transform: on ? "translateX(18px)" : "translateX(0)",
      transition: "transform 0.15s, background 0.15s",
    };

    return (
      <span
        role="switch"
        aria-checked={on}
        tabIndex={disabled ? -1 : 0}
        className={className}
        style={track}
        onClick={() => !disabled && onChange?.(!on)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") { e.preventDefault(); !disabled && onChange?.(!on); }
        }}
      >
        <span style={dot} />
      </span>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/Toggle";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- Toggle.test
  # Expected: 6 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/Toggle.tsx \
          packages/ui/src/components/__tests__/Toggle.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add Toggle primitive [milestone:9][task:9-12]

  Ink-ribbon toggle with acid dot (on) / muted dot (off). Keyboard accessible
  (Space/Enter). No Radix dependency — purely visual with ARIA role=switch.

  Refs: docs/dispatch-log/9-12-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-13: `Button.tsx` primitive

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/Button.tsx`
- Create: `packages/ui/src/components/__tests__/Button.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- Button` exits 0. Each variant class applied correctly.

---

- [ ] **Step 1: RED — write Button test**

  Create `packages/ui/src/components/__tests__/Button.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { Button } from "../Button";

  describe("Button", () => {
    it("renders children", () => {
      render(<Button>Zamów</Button>);
      expect(screen.getByText("Zamów")).toBeInTheDocument();
    });

    it("primary variant has .btn class and no colour modifier", () => {
      const { container } = render(<Button variant="primary">x</Button>);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("btn");
      expect(el.className).not.toContain("btn-acid");
    });

    it("acid variant has .btn-acid class", () => {
      const { container } = render(<Button variant="acid">x</Button>);
      expect((container.firstChild as HTMLElement).className).toContain("btn-acid");
    });

    it("pink variant has .btn-pink class", () => {
      const { container } = render(<Button variant="pink">x</Button>);
      expect((container.firstChild as HTMLElement).className).toContain("btn-pink");
    });

    it("paper variant has .btn-paper class", () => {
      const { container } = render(<Button variant="paper">x</Button>);
      expect((container.firstChild as HTMLElement).className).toContain("btn-paper");
    });

    it("ghost variant has .btn-ghost class", () => {
      const { container } = render(<Button variant="ghost">x</Button>);
      expect((container.firstChild as HTMLElement).className).toContain("btn-ghost");
    });

    it("sm size adds .btn-sm class", () => {
      const { container } = render(<Button size="sm">x</Button>);
      expect((container.firstChild as HTMLElement).className).toContain("btn-sm");
    });

    it("calls onClick handler", () => {
      const fn = vi.fn();
      render(<Button onClick={fn}>click</Button>);
      fireEvent.click(screen.getByText("click"));
      expect(fn).toHaveBeenCalledOnce();
    });

    it("renders as <button> by default", () => {
      const { container } = render(<Button>x</Button>);
      expect(container.firstChild?.nodeName).toBe("BUTTON");
    });

    it("renders as <a> when href provided", () => {
      const { container } = render(<Button href="/test">link</Button>);
      expect(container.firstChild?.nodeName).toBe("A");
    });
  });
  ```

  Run — expected fail.

- [ ] **Step 2: GREEN — create `packages/ui/src/components/Button.tsx`**

  ```tsx
  // packages/ui/src/components/Button.tsx
  // Graffiti-style button with primary/acid/pink/paper/ghost variants and sm size.
  // CSS-driven via .btn, .btn-acid, .btn-pink, .btn-paper, .btn-ghost, .btn-sm from globals.css.
  // Renders as <a> when href prop is present.
  // < 60 LOC per granulate directive.

  import React from "react";

  export type ButtonVariant = "primary" | "acid" | "pink" | "paper" | "ghost";
  export type ButtonSize = "md" | "sm";

  export interface ButtonProps {
    children: React.ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    href?: string;
    onClick?: React.MouseEventHandler;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
  }

  const VARIANT_CLASS: Record<ButtonVariant, string> = {
    primary: "btn",
    acid:    "btn btn-acid",
    pink:    "btn btn-pink",
    paper:   "btn btn-paper",
    ghost:   "btn btn-ghost",
  };

  export function Button({
    children,
    variant = "primary",
    size = "md",
    href,
    onClick,
    type = "button",
    disabled = false,
    className = "",
    style,
  }: ButtonProps) {
    const cls = [
      VARIANT_CLASS[variant],
      size === "sm" ? "btn-sm" : "",
      className,
    ].filter(Boolean).join(" ");

    if (href) {
      return (
        <a href={href} className={cls} style={style}>
          {children}
        </a>
      );
    }

    return (
      <button type={type} className={cls} style={style} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  }
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/Button";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- Button.test
  # Expected: 10 tests PASS
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ui/src/components/Button.tsx \
          packages/ui/src/components/__tests__/Button.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add Button primitive [milestone:9][task:9-13]

  Graffiti-style button: primary/acid/pink/paper/ghost variants + sm size.
  CSS-driven via globals.css .btn* classes. Renders as <a> when href prop present.

  Refs: docs/dispatch-log/9-13-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-14: `icons.tsx` — icon record

**Review:** combined single-stage

**Files:**
- Create: `packages/ui/src/components/icons.tsx`
- Create: `packages/ui/src/components/__tests__/icons.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Acceptance:** `pnpm --filter @drshoes/web test -- icons.test` exits 0. Every key in `I` is a function; calling each returns something containing an `<svg>` tag.

---

- [ ] **Step 1: RED — write icons test**

  Create `packages/ui/src/components/__tests__/icons.test.tsx`:

  ```tsx
  import { render } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { I } from "../icons";

  const iconKeys = Object.keys(I) as (keyof typeof I)[];

  describe("I (icon record)", () => {
    it("exports at least 25 icon keys", () => {
      expect(iconKeys.length).toBeGreaterThanOrEqual(25);
    });

    it("every value is a React element (not a function)", () => {
      // icons in the design are JSX elements, not functions — wrap to confirm render
      for (const key of iconKeys) {
        const el = I[key];
        expect(el).toBeTruthy();
      }
    });

    it("every icon element renders an svg tag", () => {
      for (const key of iconKeys) {
        const { container } = render(<>{I[key]}</>);
        expect(container.querySelector("svg"), `Icon "${key}" must contain an svg`).toBeTruthy();
      }
    });
  });
  ```

  Run — expected fail (icons.tsx not yet created):

  ```bash
  cd apps/web && pnpm test -- icons.test
  # Expected: Cannot find module '../icons'
  ```

- [ ] **Step 2: GREEN — create `packages/ui/src/components/icons.tsx`**

  SVG path data verbatim from `handoff/design/shared.jsx` constant `I`. Each icon is a JSX element (not a component function — matching the design's usage as `I.search`, `I.bell`, etc.).

  ```tsx
  // packages/ui/src/components/icons.tsx
  // Named 1-stroke SVG icon record. Each icon is a JSX element; use as {I.search}.
  // SVG paths verbatim from handoff/design/shared.jsx constant I.
  // Stroke icons: fill=none, stroke=currentColor, strokeWidth=2, rounded caps.
  // < 200 LOC per granulate directive.

  import React from "react";

  function Icn({ children, size = 18, stroke = 2 }: {
    children: React.ReactNode; size?: number; stroke?: number;
  }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    );
  }

  export const I = {
    search:      <Icn><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icn>,
    plus:        <Icn><path d="M12 5v14" /><path d="M5 12h14" /></Icn>,
    bell:        <Icn><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></Icn>,
    calendar:    <Icn><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></Icn>,
    zap:         <Icn><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></Icn>,
    user:        <Icn><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icn>,
    send:        <Icn><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></Icn>,
    paperclip:   <Icn><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57a4 4 0 0 1 5.66 5.66l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></Icn>,
    image:       <Icn><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></Icn>,
    arrow:       <Icn><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></Icn>,
    arrowLeft:   <Icn><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></Icn>,
    close:       <Icn><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icn>,
    more:        <Icn><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></Icn>,
    edit:        <Icn><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" /></Icn>,
    eye:         <Icn><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Icn>,
    upload:      <Icn><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8 12 3 7 8" /><path d="M12 3v12" /></Icn>,
    trash:       <Icn><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Icn>,
    filter:      <Icn><path d="M3 6h18l-7 8v6l-4-2v-4z" /></Icn>,
    drag:        <Icn><circle cx="9" cy="6" r="1" fill="currentColor" /><circle cx="15" cy="6" r="1" fill="currentColor" /><circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" /><circle cx="9" cy="18" r="1" fill="currentColor" /><circle cx="15" cy="18" r="1" fill="currentColor" /></Icn>,
    clock:       <Icn><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Icn>,
    power:       <Icn><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><path d="M12 2v10" /></Icn>,
    set:         <Icn><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icn>,
    news:        <Icn><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M7 7h10" /><path d="M7 11h10" /><path d="M7 15h6" /></Icn>,
    msg:         <Icn><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /></Icn>,
    store:       <Icn><path d="M3 9 4 4h16l1 5" /><path d="M3 9v11h18V9" /><path d="M9 20v-6h6v6" /></Icn>,
    dash:        <Icn><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></Icn>,
    list:        <Icn><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></Icn>,
  } as const;

  export type IconKey = keyof typeof I;
  ```

- [ ] **Step 3: Add barrel export + run GREEN**

  Append `export * from "./components/icons";` to `packages/ui/src/index.ts`.

  ```bash
  cd apps/web && pnpm test -- icons.test
  # Expected: 3 tests (covering all 27 icons) PASS
  ```

- [ ] **Step 4: Full suite smoke**

  ```bash
  cd apps/web && pnpm test
  # Expected: all 203+ tests PASS (new tests add ~50 on top)
  pnpm typecheck
  # Expected: 0 errors
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/ui/src/components/icons.tsx \
          packages/ui/src/components/__tests__/icons.test.tsx \
          packages/ui/src/index.ts
  git commit -m "$(cat <<'EOF'
  feat(ui): add icons.tsx record of 27 1-stroke SVG icons [milestone:9][task:9-14]

  I.search / plus / bell / calendar / zap / user / send / paperclip / image /
  arrow / arrowLeft / close / more / edit / eye / upload / trash / filter /
  drag / clock / power / set / news / msg / store / dash / list.
  SVG paths verbatim from handoff/design/shared.jsx.

  Refs: docs/dispatch-log/9-14-<UTC>.md
  EOF
  )"
  ```

---

## Wave 1 final state check

After all 14 tasks are committed, run a final validation gate before Wave 2 begins:

```bash
# Full vitest suite
cd apps/web && pnpm test
# Expected: 203 (existing) + ~53 new = ~256 PASS, 0 FAIL

# TypeScript
pnpm typecheck

# Confirm barrel exports
node -e "
const m = require('./packages/ui/src/index.ts');
console.log(Object.keys(m).join(', '));
" 2>/dev/null || echo "(ts-node not available; verify via typecheck)"

# Git log — confirm 14 commits tagged milestone:9
git log --oneline | grep '\[milestone:9\]' | head -14
```

Expected barrel exports from `@drshoes/ui` at end of Wave 1:
`colors, orderStatusColor, productStatusColor, radii, spacing, motion, fontDescriptors, cssVars, Tape, Stamp, Sticker, Pill, Chip, Splatter, PhImg, DrShoesMark, AdminCard, StatTile, Toggle, Button, I, IconKey`

**Wave 2 (9-15 through 9-17) must not start until this gate passes.**
# Waves 2 + 3 — Admin shell + Dashboard (9-15 .. 9-22)

---

## Wave 2 — Admin shell

---

### Task 9-15: Rewrite `AdminSidebar.tsx` + `AdminSidebarNav.tsx`

**Review:** combined single-stage

**Depends on:** Wave 1 complete (tokens, `DrShoesMark`, icon primitives available from `@drshoes/ui`)

**Files:**
- Modify: `apps/web/components/admin/AdminSidebar.tsx` — rewrite to dark 230px sidebar with acid right border, brand mark header, section-labeled nav, acid avatar footer with power button
- Modify: `apps/web/components/admin/AdminSidebarNav.tsx` — rewrite NavLink to use `.sb-link` + `.active` styling; update section headings; update `MessagesNavItem` colour tokens only
- Modify: `apps/web/app/(admin)/admin/_components/Sidebar/MessagesNavItem.tsx` — update active/hover classes from `bg-white/10` → `bg-white/10` (unchanged logic), recolour badge from `bg-red-500` → `bg-[var(--pink)]` to match design
- Create: `apps/web/components/admin/__tests__/AdminSidebar.test.tsx` — snapshot + active-link test
- Create: `apps/web/components/admin/__tests__/AdminSidebarNav.test.tsx` — nav section labels, MessagesNavItem badge preserves when unread > 0

**Acceptance:**
- Sidebar renders at 230px wide with `bg-ink text-paper` and a `borderRight: 3px solid var(--acid)`.
- Header shows `<DrShoesMark>` + `panel pracowni · v2.4` sub line.
- Section labels PULPIT / OPERACJE / KOMUNIKACJA / SKLEP render as `.t-stencil` uppercase headers.
- Active link has `borderLeft: 3px solid var(--acid)`.
- Footer avatar shows correct initials derived from `me.fullName`.
- Power icon button renders a `<form>` POSTing to `/logout`.
- `MessagesNavItem` still renders its unread badge in `bg-[var(--pink)]`.
- All snapshots pass.

- [ ] **Step 1: RED — write AdminSidebar.test.tsx**

  Create `apps/web/components/admin/__tests__/AdminSidebar.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";

  // Mock AdminSidebarNav — tested separately
  vi.mock("../AdminSidebarNav", () => ({
    AdminSidebarNav: ({ userEmail }: { userEmail: string }) => (
      <nav data-testid="sidebar-nav" data-email={userEmail} />
    ),
  }));

  import { AdminSidebar } from "../AdminSidebar";
  import type { MeResponse } from "@/lib/auth/types";

  const me: MeResponse = {
    id: "usr-1",
    email: "daniel@drshoes.pl",
    fullName: "Daniel Roj",
    role: "ADMIN",
  };

  describe("AdminSidebar", () => {
    it("renders panel-pracowni subtitle", () => {
      render(<AdminSidebar me={me} />);
      expect(screen.getByText(/panel pracowni/)).toBeInTheDocument();
    });

    it("derives initials from fullName", () => {
      render(<AdminSidebar me={me} />);
      expect(screen.getByText("DR")).toBeInTheDocument();
    });

    it("renders fullName and role in footer", () => {
      render(<AdminSidebar me={me} />);
      expect(screen.getByText("Daniel Roj")).toBeInTheDocument();
      expect(screen.getByText(/admin/i)).toBeInTheDocument();
    });

    it("logout form posts to /logout", () => {
      render(<AdminSidebar me={me} />);
      const form = document.querySelector("form[action='/logout']");
      expect(form).not.toBeNull();
      expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
    });

    it("passes userEmail to AdminSidebarNav", () => {
      render(<AdminSidebar me={me} />);
      expect(screen.getByTestId("sidebar-nav")).toHaveAttribute(
        "data-email",
        "daniel@drshoes.pl"
      );
    });
  });
  ```

  Expected compile failure: `AdminSidebar` does not yet export the new shape.

- [ ] **Step 2: RED — write AdminSidebarNav.test.tsx**

  Create `apps/web/components/admin/__tests__/AdminSidebarNav.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi, beforeEach } from "vitest";

  // usePathname returns /admin for "Dashboard active" tests
  vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/admin") }));
  vi.mock("@/lib/messaging/useUnreadCount", () => ({ useUnreadCount: vi.fn(() => 3) }));
  vi.mock("@/components/admin/ReportIssueButton", () => ({
    ReportIssueButton: () => <button>report</button>,
  }));

  import { AdminSidebarNav } from "../AdminSidebarNav";
  import { usePathname } from "next/navigation";

  const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

  describe("AdminSidebarNav", () => {
    beforeEach(() => mockUsePathname.mockReturnValue("/admin"));

    it("renders four section headings", () => {
      render(<AdminSidebarNav userEmail="x@x.pl" />);
      expect(screen.getByText("PULPIT")).toBeInTheDocument();
      expect(screen.getByText("OPERACJE")).toBeInTheDocument();
      expect(screen.getByText("KOMUNIKACJA")).toBeInTheDocument();
      expect(screen.getByText("SKLEP")).toBeInTheDocument();
    });

    it("Dashboard link is active on /admin", () => {
      render(<AdminSidebarNav userEmail="x@x.pl" />);
      const dashLink = screen.getByRole("link", { name: /dashboard/i });
      expect(dashLink.className).toMatch(/active/);
    });

    it("Zamówienia link is not active on /admin", () => {
      render(<AdminSidebarNav userEmail="x@x.pl" />);
      const link = screen.getByRole("link", { name: /zamówienia/i });
      expect(link.className).not.toMatch(/active/);
    });

    it("MessagesNavItem renders unread badge", () => {
      render(<AdminSidebarNav userEmail="x@x.pl" />);
      // badge text = "3"
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("Triggery link label is rendered", () => {
      render(<AdminSidebarNav userEmail="x@x.pl" />);
      expect(screen.getByRole("link", { name: /triggery/i })).toBeInTheDocument();
    });
  });
  ```

  Expected failure: old class names don't match `.active` pattern yet.

- [ ] **Step 3: Run tests to confirm RED**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run components/admin/__tests__
  ```

  Expected: multiple failures (class assertions, missing form, etc.).

- [ ] **Step 4: Implement — rewrite `AdminSidebar.tsx`**

  Full rewrite of `apps/web/components/admin/AdminSidebar.tsx`:

  ```tsx
  import type { MeResponse } from "@/lib/auth/types";
  import { AdminSidebarNav } from "./AdminSidebarNav";
  import { DrShoesMark } from "@drshoes/ui";
  import { createLogger } from "@/lib/log";

  const log = createLogger("admin.sidebar");

  function initials(fullName: string): string {
    return fullName
      .split(" ")
      .map((p) => p[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  interface Props {
    me: MeResponse;
  }

  /**
   * SC shell — dark 230px sidebar with acid right border.
   * Nav delegated to AdminSidebarNav (CC) for usePathname active-state.
   * Footer: acid avatar + name + role + power button → POST /logout.
   * ~55 LOC.
   */
  export function AdminSidebar({ me }: Props) {
    log.debug("op=AdminSidebar.render", { userId: me.id });
    const ini = initials(me.fullName);

    return (
      <aside
        style={{ width: 230, borderRight: "3px solid var(--acid)" }}
        className="bg-ink text-paper flex flex-col shrink-0 min-h-screen"
      >
        {/* Header */}
        <div
          style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
          className="px-[18px] py-5"
        >
          <DrShoesMark size={0.32} color="var(--paper)" accent="var(--acid)" />
          <div
            className="t-mono"
            style={{ fontSize: 10, opacity: 0.55, marginTop: 4, letterSpacing: ".15em" }}
          >
            panel pracowni · v2.4
          </div>
        </div>

        {/* Nav */}
        <AdminSidebarNav userEmail={me.email} />

        {/* Footer */}
        <div
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
          className="p-[14px] flex items-center gap-[10px]"
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--acid)", color: "var(--ink)",
              fontFamily: "var(--font-display)", fontSize: 18,
            }}
            className="flex items-center justify-center shrink-0"
          >
            {ini}
          </div>
          <div className="flex-1 min-w-0">
            <div className="t-stencil truncate" style={{ fontSize: 12, color: "var(--paper)" }}>
              {me.fullName}
            </div>
            <div className="t-mono" style={{ fontSize: 10, opacity: 0.55 }}>
              {me.role.toLowerCase()} · pracownia
            </div>
          </div>
          <form action="/logout" method="post">
            <button
              type="submit"
              aria-label="Wyloguj"
              className="text-paper opacity-55 hover:opacity-100 transition-opacity"
            >
              {/* power icon from @drshoes/ui icons barrel */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            </button>
          </form>
        </div>
      </aside>
    );
  }
  ```

  > **LOC note:** 55 LOC — within the 80-LOC granulate budget.

- [ ] **Step 5: Implement — rewrite `AdminSidebarNav.tsx`**

  Full rewrite of `apps/web/components/admin/AdminSidebarNav.tsx`:

  ```tsx
  "use client";

  /**
   * AdminSidebarNav — sidebar nav using .sb-link/.active utility classes from globals.css.
   * Four labeled sections: PULPIT / OPERACJE / KOMUNIKACJA / SKLEP.
   * Extracted as CC so AdminSidebar can stay SC for the me-prop fetch.
   * ~65 LOC.
   */
  import Link from "next/link";
  import type { Route } from "next";
  import { usePathname } from "next/navigation";
  import { MessagesNavItem } from "@/app/(admin)/admin/_components/Sidebar/MessagesNavItem";
  import { ReportIssueButton } from "@/components/admin/ReportIssueButton";
  import { createLogger } from "@/lib/log";

  const log = createLogger("admin.sidebar.nav");

  interface NavLinkProps {
    href: string;
    label: string;
    exact?: boolean;
  }

  function NavLink({ href, label, exact = false }: NavLinkProps) {
    const pathname = usePathname();
    const active = exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href as Route} className={"sb-link" + (active ? " active" : "")}>
        {label}
      </Link>
    );
  }

  function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
      <div
        className="t-stencil px-[18px] mt-5 mb-1"
        style={{ fontSize: 10, opacity: 0.45, letterSpacing: ".15em" }}
      >
        {children}
      </div>
    );
  }

  interface Props {
    userEmail: string;
  }

  export function AdminSidebarNav({ userEmail }: Props) {
    log.debug("op=AdminSidebarNav.render");
    return (
      <nav className="flex flex-col py-[14px] flex-1">
        <SectionLabel>PULPIT</SectionLabel>
        <NavLink href="/admin" label="Dashboard" exact />

        <SectionLabel>OPERACJE</SectionLabel>
        <NavLink href="/admin/orders" label="Zamówienia" />
        <NavLink href="/admin/clients" label="Klienci" />
        <MessagesNavItem />

        <SectionLabel>KOMUNIKACJA</SectionLabel>
        <NavLink href="/admin/triggers" label="Triggery" />
        <NavLink href="/admin/templates" label="Szablony wiadomości" />

        <SectionLabel>SKLEP</SectionLabel>
        <NavLink href="/admin/sklep" label="Sklep" />
        <NavLink href="/admin/aktualnosci" label="Aktualności" />

        <div className="mt-auto px-[14px] pt-4">
          <ReportIssueButton user={userEmail} />
        </div>
      </nav>
    );
  }
  ```

  > **LOC note:** 65 LOC — within budget.

- [ ] **Step 6: Patch `MessagesNavItem.tsx` colour tokens**

  Only two class changes — inline edit, no subagent needed.

  In `apps/web/app/(admin)/admin/_components/Sidebar/MessagesNavItem.tsx`:

  - Change active class: `"bg-white/10 text-paper"` — no change needed (already correct for dark sidebar).
  - Change inactive class: `"text-paper/75 hover:bg-white/5 hover:text-paper"` — no change needed.
  - Change badge class: `bg-red-500 text-white` → `bg-[var(--pink)] text-[var(--ink)]`

  The exact diff:
  ```diff
  -                <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10.5px] font-bold leading-none">
  +                <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-[var(--pink)] text-[var(--ink)] text-[10.5px] font-bold leading-none">
  ```

- [ ] **Step 7: GREEN — run tests**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run components/admin/__tests__
  ```

  Expected: 10/10 pass.

- [ ] **Step 8: Commit**

  ```
  feat(admin): rewrite AdminSidebar + AdminSidebarNav to dark ink shell [milestone:9][task:9-15]

  - 230px bg-ink sidebar with 3px acid right border
  - DrShoesMark header + panel pracowni subtitle
  - Four .t-stencil section labels (PULPIT/OPERACJE/KOMUNIKACJA/SKLEP)
  - .sb-link + .active border-left acid on active nav link
  - Acid avatar footer with initials derived from me.fullName
  - Power icon → POST /logout form
  - MessagesNavItem badge recoloured to var(--pink)/var(--ink)

  Refs: docs/dispatch-log/9-15-<UTC>.md
  ```

---

### Task 9-16: Create `AdminTopbar.tsx` + `AdminPageHeaderContext.tsx`

**Review:** combined single-stage

**Depends on:** 9-15 (sidebar shell)

**Files:**
- Create: `apps/web/app/(admin)/admin/_components/PageHeaderContext.tsx` — context, provider, `usePageHeader` hook
- Create: `apps/web/components/admin/AdminTopbar.tsx` — topbar reading from PageHeaderContext; search input + bell
- Create: `apps/web/components/admin/__tests__/AdminTopbar.test.tsx` — snapshot + bell-dot + context propagation tests

**Acceptance:**
- `PageHeaderProvider` wraps children and exposes `{ title, subtitle }` through context.
- `usePageHeader({ title, subtitle })` called inside a child triggers context update via `useEffect` with `[h.title, h.subtitle]` dep array (no render storm).
- `AdminTopbar` renders `t-display fontSize:38` title + `t-mono 12px opacity-55` subtitle from context.
- Search input is 280px, has `⌘K` badge, has `border-ink shadow-pop-sm`.
- Bell button renders a pink dot when `unreadCount > 0` (from `useUnreadCount`), no dot when 0.
- All tests pass.

- [ ] **Step 1: RED — write AdminTopbar.test.tsx**

  Create `apps/web/components/admin/__tests__/AdminTopbar.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";

  vi.mock("@/lib/messaging/useUnreadCount", () => ({
    useUnreadCount: vi.fn(() => 0),
  }));

  import { AdminTopbar } from "../AdminTopbar";
  import { PageHeaderProvider } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { useUnreadCount } from "@/lib/messaging/useUnreadCount";

  const mockUnread = useUnreadCount as ReturnType<typeof vi.fn>;

  function PageSetter({ title, subtitle }: { title: string; subtitle?: string }) {
    usePageHeader({ title, subtitle });
    return null;
  }

  describe("AdminTopbar", () => {
    it("renders title from context", () => {
      render(
        <PageHeaderProvider>
          <PageSetter title="Dashboard" />
          <AdminTopbar />
        </PageHeaderProvider>
      );
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("renders subtitle from context", () => {
      render(
        <PageHeaderProvider>
          <PageSetter title="Dashboard" subtitle="czwartek · 7 maja 2026" />
          <AdminTopbar />
        </PageHeaderProvider>
      );
      expect(screen.getByText("czwartek · 7 maja 2026")).toBeInTheDocument();
    });

    it("renders search input with placeholder", () => {
      render(
        <PageHeaderProvider>
          <AdminTopbar />
        </PageHeaderProvider>
      );
      expect(screen.getByPlaceholderText(/szukaj/i)).toBeInTheDocument();
    });

    it("renders cmd-K hint", () => {
      render(
        <PageHeaderProvider>
          <AdminTopbar />
        </PageHeaderProvider>
      );
      expect(screen.getByText("⌘K")).toBeInTheDocument();
    });

    it("does NOT render pink dot when unread = 0", () => {
      mockUnread.mockReturnValue(0);
      const { container } = render(
        <PageHeaderProvider>
          <AdminTopbar />
        </PageHeaderProvider>
      );
      expect(container.querySelector("[data-testid='bell-dot']")).toBeNull();
    });

    it("renders pink dot when unread > 0", () => {
      mockUnread.mockReturnValue(5);
      const { container } = render(
        <PageHeaderProvider>
          <AdminTopbar />
        </PageHeaderProvider>
      );
      expect(container.querySelector("[data-testid='bell-dot']")).not.toBeNull();
    });
  });
  ```

  Expected compile failure: `AdminTopbar`, `PageHeaderProvider`, `usePageHeader` do not exist yet.

- [ ] **Step 2: Run tests to confirm RED**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run components/admin/__tests__/AdminTopbar
  ```

  Expected: compile/import errors.

- [ ] **Step 3: Implement `PageHeaderContext.tsx`**

  Create `apps/web/app/(admin)/admin/_components/PageHeaderContext.tsx`:

  ```tsx
  "use client";

  /**
   * PageHeaderContext — lets any admin page set the topbar title + subtitle.
   * usePageHeader(h) is called at the top of each page.tsx and uses useEffect
   * with [h.title, h.subtitle] deps to avoid render storms.
   * ~55 LOC.
   */
  import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
  } from "react";
  import { createLogger } from "@/lib/log";

  const log = createLogger("admin.page-header-ctx");

  export interface PageHeader {
    title: string;
    subtitle?: string;
    right?: ReactNode;
  }

  interface ContextValue {
    current: PageHeader | null;
    set: (h: PageHeader) => void;
  }

  const PageHeaderContext = createContext<ContextValue>({
    current: null,
    set: () => {},
  });

  export function PageHeaderProvider({ children }: { children: ReactNode }) {
    const [current, setCurrent] = useState<PageHeader | null>(null);
    const set = useCallback((h: PageHeader) => {
      log.debug("op=PageHeaderContext.set", { title: h.title });
      setCurrent(h);
    }, []);
    return (
      <PageHeaderContext.Provider value={{ current, set }}>
        {children}
      </PageHeaderContext.Provider>
    );
  }

  export function usePageHeaderContext(): ContextValue {
    return useContext(PageHeaderContext);
  }

  /** Call at the top of a page component to set the topbar heading. */
  export function usePageHeader(h: PageHeader): void {
    const { set } = usePageHeaderContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { set(h); }, [h.title, h.subtitle]);
  }
  ```

  > **LOC note:** 55 LOC — within budget.

- [ ] **Step 4: Implement `AdminTopbar.tsx`**

  Create `apps/web/components/admin/AdminTopbar.tsx`:

  ```tsx
  "use client";

  /**
   * AdminTopbar — page title + global search + bell.
   * Title/subtitle pulled from PageHeaderContext (set per-page via usePageHeader).
   * Search input is a placeholder for M9; handler deferred to M10.
   * Bell dot lights up when useUnreadCount() > 0.
   * ~65 LOC.
   */
  import { usePageHeaderContext } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { useUnreadCount } from "@/lib/messaging/useUnreadCount";
  import { createLogger } from "@/lib/log";

  const log = createLogger("admin.topbar");

  export function AdminTopbar() {
    const { current } = usePageHeaderContext();
    const unread = useUnreadCount();

    log.debug("op=AdminTopbar.render", { title: current?.title, unread });

    return (
      <header className="flex items-center px-7 py-4 bg-paper border-b-2 border-ink gap-4">
        {/* Left: title + subtitle */}
        <div className="flex-1 flex items-center gap-3">
          {current?.title && (
            <h1 className="t-display m-0" style={{ fontSize: 38 }}>
              {current.title}
            </h1>
          )}
          {current?.subtitle && (
            <span className="t-mono" style={{ fontSize: 12, opacity: 0.55, letterSpacing: ".05em" }}>
              {current.subtitle}
            </span>
          )}
        </div>

        {/* Right: search + bell + optional right slot */}
        <div className="flex items-center gap-3">
          {/* Search — placeholder only, M10 wires the handler */}
          <div
            className="flex items-center gap-2 px-3 py-2 border-[1.5px] border-ink bg-white shadow-pop-sm"
            style={{ width: 280 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0 text-[rgba(0,0,0,0.45)]">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Szukaj zlecenia, klienta…"
              className="border-0 outline-none bg-transparent flex-1 text-[13px]"
              style={{ fontFamily: "var(--font-body)" }}
              readOnly
            />
            <span className="t-mono text-[10px] text-[rgba(0,0,0,0.4)] border border-[rgba(0,0,0,0.2)] px-[5px] py-[1px]">
              ⌘K
            </span>
          </div>

          {/* Bell */}
          <button className="btn-clean relative p-2" aria-label="Powiadomienia">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unread > 0 && (
              <span
                data-testid="bell-dot"
                className="absolute top-1 right-1 w-[6px] h-[6px] rounded-full bg-[var(--pink)]"
              />
            )}
          </button>

          {current?.right}
        </div>
      </header>
    );
  }
  ```

  > **LOC note:** 65 LOC — within budget.

- [ ] **Step 5: GREEN — run tests**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run components/admin/__tests__/AdminTopbar
  ```

  Expected: 6/6 pass.

- [ ] **Step 6: Commit**

  ```
  feat(admin): add AdminTopbar + PageHeaderContext for per-page title injection [milestone:9][task:9-16]

  - PageHeaderProvider + usePageHeader(h) hook (useEffect deps [title, subtitle] avoids re-render storms)
  - AdminTopbar reads PageHeaderContext; renders t-display 38px title + t-mono subtitle
  - 280px search input placeholder (handler deferred M10); bell dot via useUnreadCount

  Refs: docs/dispatch-log/9-16-<UTC>.md
  ```

---

### Task 9-17: Integrate AdminTopbar into `AdminLayout.tsx` + wire `usePageHeader` on every admin page

**Review:** combined single-stage

**Depends on:** 9-16

**Files:**
- Modify: `apps/web/app/(admin)/admin/layout.tsx` — wrap children in `PageHeaderProvider`; render `AdminTopbar` before children inside `<main>`
- Modify: `apps/web/app/(admin)/admin/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/orders/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/orders/calendar/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/orders/kanban/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/orders/new/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/clients/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/clients/[id]/page.tsx` — add `usePageHeader` call (title = client name, handled dynamically)
- Modify: `apps/web/app/(admin)/admin/messages/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/triggers/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/triggers/[id]/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/templates/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/templates/new/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/templates/[id]/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/sklep/page.tsx` — add `usePageHeader` call
- Modify: `apps/web/app/(admin)/admin/aktualnosci/page.tsx` — add `usePageHeader` call
- **Skip:** `login/page.tsx` and `quicklogin/page.tsx` — they bypass the layout guard and render outside the sidebar/topbar.
- **Skip:** `clients/[id]/wiadomosci/page.tsx` and `clients/[id]/zlecenia/page.tsx` — nested under client detail; handled by the detail layout; call `usePageHeader` only if they render their own title independently (check at dispatch time).

**Acceptance:**
- AdminLayout renders `<PageHeaderProvider>` wrapping `<AdminSidebar>` + `<main>` containing `<AdminTopbar>` above `children`.
- Each page listed above calls `usePageHeader({ title, subtitle })` so the topbar displays a meaningful heading on navigation.
- Existing Playwright smoke (demo-flow.spec.ts) stays green.

- [ ] **Step 1: Implement — `AdminLayout.tsx` rewrite**

  Full rewrite of `apps/web/app/(admin)/admin/layout.tsx`:

  ```tsx
  import { redirect } from "next/navigation";
  import { headers } from "next/headers";
  import { getMe } from "@/lib/auth/session";
  import { AdminSidebar } from "@/components/admin/AdminSidebar";
  import { AdminTopbar } from "@/components/admin/AdminTopbar";
  import { BrowserOtelInit } from "@/components/admin/BrowserOtelInit";
  import { PageHeaderProvider } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { createLogger } from "@/lib/log";

  const log = createLogger("admin-layout");

  export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "";

    if (path.startsWith("/admin/login") || path.startsWith("/admin/quicklogin")) {
      return <>{children}</>;
    }

    const me = await getMe();
    if (!me) {
      log.info("op=guard outcome=redirect-to-login", { path });
      redirect(`/admin/login?next=${encodeURIComponent(path || "/admin")}`);
    }

    log.info("op=guard outcome=ok", { path, userId: me.id, role: me.role });

    return (
      <PageHeaderProvider>
        <div className="min-h-screen bg-admin-bg text-admin-ink flex">
          <BrowserOtelInit />
          <AdminSidebar me={me} />
          <main className="flex-1 flex flex-col overflow-auto">
            <AdminTopbar />
            <div className="flex-1 p-6">{children}</div>
          </main>
        </div>
      </PageHeaderProvider>
    );
  }
  ```

  > **Note:** `AdminTopbar` is a CC (`"use client"`). It is imported into this SC — Next.js App Router allows this because CC boundary is respected at render time.

- [ ] **Step 2: Wire `usePageHeader` — `page.tsx` diffs**

  Each page below needs a client-side wrapper or a dedicated header-setter component. Because these pages are currently Server Components, the pattern is: create a small `"use client"` helper component `<PageHeaderSetter>` local to each page that calls `usePageHeader`.

  **Shared helper pattern** (define once per page file, not extracted to a shared module — keeps each page self-contained and ≤80 LOC):

  ```tsx
  // At top of page file:
  "use client";
  function PageHeaderSetter() {
    usePageHeader({ title: "...", subtitle: "..." });
    return null;
  }
  ```

  Then inside the SC page JSX: `<PageHeaderSetter />` as the first child.

  **Full diff for each page:**

  **`apps/web/app/(admin)/admin/page.tsx`** — Dashboard:
  ```diff
  + import { PageHeaderSetter } from "./_components/DashboardPageHeaderSetter";
  // ...
  export default async function AdminPage() {
    return (
      <div className="flex flex-col gap-5">
  +     <PageHeaderSetter />
        ...
  ```

  Create `apps/web/app/(admin)/admin/_components/DashboardPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function PageHeaderSetter() {
    const today = new Date().toLocaleDateString("pl-PL", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      timeZone: "Europe/Warsaw",
    });
    usePageHeader({ title: "Dashboard", subtitle: today });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/orders/page.tsx`** — Zamówienia:
  ```diff
  + import { OrdersPageHeaderSetter } from "./_components/OrdersPageHeaderSetter";
  // In JSX:
  +   <OrdersPageHeaderSetter activeCount={...} readyCount={...} />
  ```
  Create `apps/web/app/(admin)/admin/orders/_components/OrdersPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  interface Props { activeCount: number; readyCount: number; }
  export function OrdersPageHeaderSetter({ activeCount, readyCount }: Props) {
    usePageHeader({
      title: "Zamówienia",
      subtitle: `${activeCount} aktywnych · ${readyCount} gotowych do odbioru`,
    });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/orders/calendar/page.tsx`** — Kalendarz:
  ```diff
  + import { CalendarPageHeaderSetter } from "./_components/CalendarPageHeaderSetter";
  ```
  Create `apps/web/app/(admin)/admin/orders/calendar/_components/CalendarPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function CalendarPageHeaderSetter() {
    usePageHeader({ title: "Kalendarz", subtitle: "widok miesięczny" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/orders/kanban/page.tsx`** — Kanban:
  ```diff
  + import { KanbanPageHeaderSetter } from "./_components/KanbanPageHeaderSetter";
  ```
  Create `apps/web/app/(admin)/admin/orders/kanban/_components/KanbanPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function KanbanPageHeaderSetter() {
    usePageHeader({ title: "Kanban", subtitle: "widok tablicy" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/orders/new/page.tsx`** — Nowe zlecenie:
  ```diff
  + import { NewOrderPageHeaderSetter } from "./_components/NewOrderPageHeaderSetter";
  ```
  Create `apps/web/app/(admin)/admin/orders/new/_components/NewOrderPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function NewOrderPageHeaderSetter() {
    usePageHeader({ title: "Nowe zlecenie" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/clients/page.tsx`** — Klienci:
  ```diff
  + import { ClientsPageHeaderSetter } from "./_components/ClientsPageHeaderSetter";
  ```
  Create `apps/web/app/(admin)/admin/clients/_components/ClientsPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  interface Props { total?: number; }
  export function ClientsPageHeaderSetter({ total }: Props) {
    usePageHeader({
      title: "Klienci",
      subtitle: total !== undefined ? `${total} w bazie` : undefined,
    });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/clients/[id]/page.tsx`** — Klient detail (dynamic title):
  ```diff
  + import { ClientDetailPageHeaderSetter } from "./_components/ClientDetailPageHeaderSetter";
  // In JSX, once client data is fetched:
  +   <ClientDetailPageHeaderSetter name={client.fullName} />
  ```
  Create `apps/web/app/(admin)/admin/clients/[id]/_components/ClientDetailPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  interface Props { name: string; }
  export function ClientDetailPageHeaderSetter({ name }: Props) {
    usePageHeader({ title: name, subtitle: "profil klienta" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/messages/page.tsx`** — Wiadomości:
  ```diff
  + import { MessagesPageHeaderSetter } from "./_components/MessagesPageHeaderSetter";
  ```
  Create `apps/web/app/(admin)/admin/messages/_components/MessagesPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function MessagesPageHeaderSetter() {
    usePageHeader({ title: "Wiadomości" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/triggers/page.tsx`** — Triggery:
  ```diff
  + import { TriggersPageHeaderSetter } from "./_components/TriggersPageHeaderSetter";
  ```
  Create `apps/web/app/(admin)/admin/triggers/_components/TriggersPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function TriggersPageHeaderSetter() {
    usePageHeader({ title: "Triggery", subtitle: "automatyzacje komunikacji" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/triggers/[id]/page.tsx`** — Trigger detail:
  ```diff
  + import { TriggerDetailPageHeaderSetter } from "./_components/TriggerDetailPageHeaderSetter";
  // In JSX, once trigger fetched:
  +   <TriggerDetailPageHeaderSetter name={trigger.name} />
  ```
  Create `apps/web/app/(admin)/admin/triggers/[id]/_components/TriggerDetailPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  interface Props { name: string; }
  export function TriggerDetailPageHeaderSetter({ name }: Props) {
    usePageHeader({ title: name, subtitle: "edycja triggera" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/templates/page.tsx`** — Szablony:
  ```diff
  + import { TemplatesPageHeaderSetter } from "./_components/TemplatesPageHeaderSetter";
  ```
  Create `apps/web/app/(admin)/admin/templates/_components/TemplatesPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function TemplatesPageHeaderSetter() {
    usePageHeader({ title: "Szablony wiadomości" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/templates/new/page.tsx`** and **`templates/[id]/page.tsx`**:
  ```tsx
  // new/page.tsx setter:
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function NewTemplatePageHeaderSetter() {
    usePageHeader({ title: "Nowy szablon" });
    return null;
  }

  // [id]/page.tsx setter:
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  interface Props { name: string; }
  export function TemplateDetailPageHeaderSetter({ name }: Props) {
    usePageHeader({ title: name, subtitle: "edycja szablonu" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/sklep/page.tsx`** — Sklep:
  ```diff
  + import { SklepPageHeaderSetter } from "./_components/SklepPageHeaderSetter";
  ```
  Create `apps/web/app/(admin)/admin/sklep/_components/SklepPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function SklepPageHeaderSetter() {
    usePageHeader({ title: "Sklep", subtitle: "zarządzanie produktami" });
    return null;
  }
  ```

  **`apps/web/app/(admin)/admin/aktualnosci/page.tsx`** — Aktualności:
  ```diff
  + import { AktualnosciPageHeaderSetter } from "./_components/AktualnosciPageHeaderSetter";
  ```
  Create `apps/web/app/(admin)/admin/aktualnosci/_components/AktualnosciPageHeaderSetter.tsx`:
  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  export function AktualnosciPageHeaderSetter() {
    usePageHeader({ title: "Aktualności", subtitle: "wpisy na stronę" });
    return null;
  }
  ```

- [ ] **Step 3: GREEN — run full vitest suite**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run
  ```

  Expected: existing 203+ tests pass, no new failures. Snapshot diffs expected only from layout structural change — accept snapshot updates for layout tests if any exist.

- [ ] **Step 4: Commit**

  ```
  feat(admin): integrate AdminTopbar into AdminLayout + wire usePageHeader on all pages [milestone:9][task:9-17]

  - AdminLayout wraps children in PageHeaderProvider; renders AdminTopbar above children
  - 14 PageHeaderSetter components created (one per admin page/route segment)
  - Dashboard setter derives localized date from toLocaleDateString pl-PL Europe/Warsaw
  - Orders setter accepts activeCount/readyCount for dynamic subtitle
  - login/quicklogin bypass preserved

  Refs: docs/dispatch-log/9-17-<UTC>.md
  ```

---

## Wave 3 — Dashboard parity

---

### Task 9-18: `<StatTile>` integration in `KpiTilesRow.tsx` restyle

**Review:** combined single-stage

**Depends on:** Wave 1 complete (`StatTile` primitive from `@drshoes/ui`)

**Files:**
- Modify: `apps/web/app/(admin)/admin/_components/KpiTilesRow.tsx` — replace inline `StatTile` function with import from `@drshoes/ui`; use `accent` prop instead of inline `borderTop` style; use left-bar design from the primitive
- Modify: `apps/web/app/(admin)/admin/_components/__tests__/KpiTilesRow.test.tsx` — update test to exercise new design tokens; add accent colour assertion

**Acceptance:**
- `KpiTilesRow` imports `StatTile` from `@drshoes/ui` (no inline `StatTile` function remaining).
- W realizacji tile uses `accent="var(--acid)"`.
- Gotowe do odbioru tile uses `accent="var(--pink)"`.
- Nowe rezerwacje tile uses `accent="var(--blue)"`.
- Przychód tile uses `accent="var(--acid)"`.
- `data-testid` attributes preserved for all four tiles.
- All existing KpiTilesRow tests pass (update snapshots as needed).

- [ ] **Step 1: RED — update test to assert StatTile primitive is used**

  Replace `apps/web/app/(admin)/admin/_components/__tests__/KpiTilesRow.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { KpiTilesRow } from "../KpiTilesRow";
  import type { DashboardKpiDto } from "@/lib/dashboard/types";

  const kpis: DashboardKpiDto = {
    inProgressCount: 14,
    readyForPickupCount: 6,
    todayIntakeCount: 9,
    monthRevenueCents: 1824000,
    monthRevenueFormatted: "18 240 zł",
  };

  describe("KpiTilesRow", () => {
    it("renders all four tile labels", () => {
      render(<KpiTilesRow kpis={kpis} />);
      expect(screen.getByText("W realizacji")).toBeInTheDocument();
      expect(screen.getByText("Gotowe do odbioru")).toBeInTheDocument();
      expect(screen.getByText("Nowe rezerwacje (7d)")).toBeInTheDocument();
      expect(screen.getByText(/Przychód/)).toBeInTheDocument();
    });

    it("renders numeric values", () => {
      render(<KpiTilesRow kpis={kpis} />);
      expect(screen.getByText("14")).toBeInTheDocument();
      expect(screen.getByText("6")).toBeInTheDocument();
      expect(screen.getByText("9")).toBeInTheDocument();
      expect(screen.getByText("18 240 zł")).toBeInTheDocument();
    });

    it("has data-testid attributes for each tile", () => {
      render(<KpiTilesRow kpis={kpis} />);
      expect(screen.getByTestId("kpi-tile-in-progress")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-tile-ready")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-tile-intake")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-tile-revenue")).toBeInTheDocument();
    });

    it("acid tile has data-accent=acid", () => {
      render(<KpiTilesRow kpis={kpis} />);
      // StatTile from @drshoes/ui sets data-accent on the tile root
      expect(screen.getByTestId("kpi-tile-in-progress")).toHaveAttribute("data-accent", "acid");
      expect(screen.getByTestId("kpi-tile-revenue")).toHaveAttribute("data-accent", "acid");
    });

    it("pink tile has data-accent=pink", () => {
      render(<KpiTilesRow kpis={kpis} />);
      expect(screen.getByTestId("kpi-tile-ready")).toHaveAttribute("data-accent", "pink");
    });

    it("blue tile has data-accent=blue", () => {
      render(<KpiTilesRow kpis={kpis} />);
      expect(screen.getByTestId("kpi-tile-intake")).toHaveAttribute("data-accent", "blue");
    });
  });
  ```

  > **Note to subagent:** The `data-accent` assertion relies on `StatTile` from `@drshoes/ui` setting `data-accent={accent}` on its root `<div>`. Verify this in the Wave 1 implementation of `StatTile.tsx`; if that attribute is not emitted, adjust the assertion to check the left-bar style colour value instead (via `getComputedStyle` or the style prop on the element).

  Expected: `data-accent` assertions fail because current inline `StatTile` does not set this attribute.

- [ ] **Step 2: Run to confirm RED**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run _components/__tests__/KpiTilesRow
  ```

  Expected: 2 new failures on `data-accent` assertions.

- [ ] **Step 3: Implement — rewrite `KpiTilesRow.tsx`**

  Full rewrite of `apps/web/app/(admin)/admin/_components/KpiTilesRow.tsx`:

  ```tsx
  /**
   * Four KPI stat tiles — top row of the Dashboard.
   * Uses <StatTile> primitive from @drshoes/ui with left-bar accent.
   * Pure server component (no client state).
   * ~45 LOC.
   */
  import { StatTile } from "@drshoes/ui";
  import type { DashboardKpiDto } from "@/lib/dashboard/types";

  interface Props {
    kpis: DashboardKpiDto;
  }

  export function KpiTilesRow({ kpis }: Props) {
    const monthLabel = new Date().toLocaleString("pl-PL", {
      month: "long",
      timeZone: "Europe/Warsaw",
    });

    return (
      <div className="grid grid-cols-4 gap-[18px]">
        <StatTile
          data-testid="kpi-tile-in-progress"
          label="W realizacji"
          value={String(kpis.inProgressCount)}
          sub="zlecenia aktywne"
          accent="acid"
        />
        <StatTile
          data-testid="kpi-tile-ready"
          label="Gotowe do odbioru"
          value={String(kpis.readyForPickupCount)}
          sub="czekają na klienta"
          accent="pink"
        />
        <StatTile
          data-testid="kpi-tile-intake"
          label="Nowe rezerwacje (7d)"
          value={String(kpis.todayIntakeCount)}
          sub="ostatnie 7 dni"
          accent="blue"
        />
        <StatTile
          data-testid="kpi-tile-revenue"
          label={`Przychód · ${monthLabel}`}
          value={kpis.monthRevenueFormatted}
          sub="ten miesiąc"
          accent="acid"
        />
      </div>
    );
  }
  ```

  > **LOC note:** 45 LOC — within budget.
  >
  > **Note to subagent:** The `StatTile` component from `@drshoes/ui` must accept `data-testid` as a passthrough prop. Verify this in the Wave 1 implementation. If `StatTile` uses `...rest` spread onto the root element, `data-testid` will pass through automatically. If not, add an explicit `testId?: string` prop to `StatTile` and wire it to `data-testid` on the root element — this is a Wave 1 correction, not a Wave 3 scope creep.

- [ ] **Step 4: GREEN — run tests**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run _components/__tests__/KpiTilesRow
  ```

  Expected: 6/6 pass.

- [ ] **Step 5: Commit**

  ```
  feat(admin): restyle KpiTilesRow with StatTile primitive from @drshoes/ui [milestone:9][task:9-18]

  - Replace inline StatTile with @drshoes/ui StatTile; accent prop drives left-bar colour
  - Accent mapping: W realizacji=acid, Gotowe=pink, Nowe=blue, Przychód=acid
  - data-testid preserved on all four tiles via ...rest spread

  Refs: docs/dispatch-log/9-18-<UTC>.md
  ```

---

### Task 9-19: `<OrdersWeekChart>` restyle to stacked bar with chip toggles

**Review:** combined single-stage

**Depends on:** Wave 1 complete (`Chip` primitive from `@drshoes/ui`; `globals.css` utility classes)

**Files:**
- Modify: `apps/web/app/(admin)/admin/_components/OrdersWeekChart.tsx` — add chip toggle row (tydzień/miesiąc/kwartał, visual only); legend unchanged; SVG bars unchanged (already stacked per design review of existing code)
- Modify: `apps/web/app/(admin)/admin/_components/__tests__/OrdersWeekChart.test.tsx` — add chip toggle rendering assertions

**Acceptance:**
- Chip row renders "tydzień" / "miesiąc" / "kwartał"; first chip ("tydzień") has `active` visual state by default.
- Existing SVG bar logic unchanged: `repairs` = ink fill bottom, `custom` = acid fill stroke-ink top.
- Legend: black square + "naprawy" + acid square + "custom" in `t-mono`.
- Chip click is a no-op in M9 (behaviour deferred to M10); no state change occurs.
- All existing `OrdersWeekChart` tests still pass; new chip tests also pass.

- [ ] **Step 1: RED — update test to assert chip row**

  Replace `apps/web/app/(admin)/admin/_components/__tests__/OrdersWeekChart.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { OrdersWeekChart } from "../OrdersWeekChart";
  import type { OrdersPerWeekRowDto } from "@/lib/dashboard/types";

  const rows: OrdersPerWeekRowDto[] = [
    { weekIso: "2026-W10", repairs: 12, custom: 8 },
    { weekIso: "2026-W11", repairs: 14, custom: 6 },
    { weekIso: "2026-W12", repairs: 9,  custom: 11 },
    { weekIso: "2026-W13", repairs: 16, custom: 10 },
    { weekIso: "2026-W14", repairs: 11, custom: 14 },
    { weekIso: "2026-W15", repairs: 18, custom: 9 },
    { weekIso: "2026-W16", repairs: 22, custom: 12 },
    { weekIso: "2026-W17", repairs: 19, custom: 16 },
  ];

  describe("OrdersWeekChart", () => {
    it("renders chart heading", () => {
      render(<OrdersWeekChart rows={rows} />);
      expect(screen.getByText("Zlecenia / tydzień")).toBeInTheDocument();
    });

    it("renders legend labels", () => {
      render(<OrdersWeekChart rows={rows} />);
      expect(screen.getByText("naprawy")).toBeInTheDocument();
      expect(screen.getByText("custom")).toBeInTheDocument();
    });

    it("renders an SVG element", () => {
      const { container } = render(<OrdersWeekChart rows={rows} />);
      expect(container.querySelector("svg")).not.toBeNull();
    });

    it("renders a bar for each row", () => {
      const { container } = render(<OrdersWeekChart rows={rows} />);
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBe(rows.length * 2);
    });

    it("handles empty rows gracefully", () => {
      render(<OrdersWeekChart rows={[]} />);
      expect(screen.getByText("Zlecenia / tydzień")).toBeInTheDocument();
    });

    it("renders three chip toggles", () => {
      render(<OrdersWeekChart rows={rows} />);
      expect(screen.getByText("tydzień")).toBeInTheDocument();
      expect(screen.getByText("miesiąc")).toBeInTheDocument();
      expect(screen.getByText("kwartał")).toBeInTheDocument();
    });

    it("first chip has active class by default", () => {
      render(<OrdersWeekChart rows={rows} />);
      // Chip component renders with className containing "active" when active=true
      const chips = screen.getAllByRole("button");
      const tygodzenChip = chips.find((b) => b.textContent?.includes("tydzień"));
      expect(tygodzenChip?.className).toMatch(/active/);
    });
  });
  ```

  Expected: last two assertions fail (chip row not yet rendered).

- [ ] **Step 2: Run to confirm RED**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run _components/__tests__/OrdersWeekChart
  ```

  Expected: 2 failures.

- [ ] **Step 3: Implement — update `OrdersWeekChart.tsx`**

  Full rewrite of `apps/web/app/(admin)/admin/_components/OrdersWeekChart.tsx`:

  ```tsx
  /**
   * Stacked bar chart — orders per week for last 8 ISO weeks.
   * Chip row (tydzień/miesiąc/kwartał) is visual-only for M9; behaviour deferred to M10.
   * Pure server component — chip toggle state not interactive.
   * ~70 LOC.
   */
  import { Chip } from "@drshoes/ui";
  import type { OrdersPerWeekRowDto } from "@/lib/dashboard/types";

  interface Props {
    rows: OrdersPerWeekRowDto[];
  }

  const VIEW_H = 220;
  const BAR_BOTTOM = 190;
  const SCALE = 7;

  const CHIPS = [
    { label: "tydzień", active: true },
    { label: "miesiąc", active: false },
    { label: "kwartał", active: false },
  ];

  export function OrdersWeekChart({ rows }: Props) {
    return (
      <div className="admin-card p-[22px]">
        <div className="flex justify-between items-start mb-[18px]">
          <div>
            <div className="t-display text-[22px]">Zlecenia / tydzień</div>
            <div className="t-mono text-[11px] text-admin-mute">ostatnie 8 tygodni</div>
          </div>
          {/* Chip toggles — visual only, M10 wires time-range filter */}
          <div className="flex gap-1.5">
            {CHIPS.map((c) => (
              <Chip key={c.label} active={c.active}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <svg viewBox={`0 0 720 ${VIEW_H}`} style={{ width: "100%", height: VIEW_H }}>
          <g stroke="rgba(0,0,0,0.08)">
            <line x1="0" y1="40" x2="720" y2="40" />
            <line x1="0" y1="90" x2="720" y2="90" />
            <line x1="0" y1="140" x2="720" y2="140" />
            <line x1="0" y1="190" x2="720" y2="190" />
          </g>
          {rows.map((row, i) => {
            const x = 30 + i * 86;
            const repairTop = BAR_BOTTOM - row.repairs * SCALE;
            const customTop = repairTop - row.custom * SCALE;
            const label = row.weekIso.replace(/^\d{4}-/, "");
            return (
              <g key={row.weekIso}>
                <rect x={x} y={repairTop} width="40" height={BAR_BOTTOM - repairTop} fill="var(--ink)" />
                <rect x={x} y={customTop} width="40" height={repairTop - customTop} fill="var(--acid)" stroke="var(--ink)" />
                <text x={x + 20} y="210" textAnchor="middle" fontSize="10"
                  fontFamily="JetBrains Mono" fill="rgba(0,0,0,0.5)">{label}</text>
              </g>
            );
          })}
        </svg>

        <div className="flex gap-4 mt-2">
          <span className="t-mono text-[11px] inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-[var(--ink)]" /> naprawy
          </span>
          <span className="t-mono text-[11px] inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-[var(--acid)] border border-[var(--ink)]" /> custom
          </span>
        </div>
      </div>
    );
  }
  ```

  > **LOC note:** 70 LOC — within budget.

- [ ] **Step 4: GREEN — run tests**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run _components/__tests__/OrdersWeekChart
  ```

  Expected: 7/7 pass.

- [ ] **Step 5: Commit**

  ```
  feat(admin): add chip toggles to OrdersWeekChart (visual, M10 wires filter) [milestone:9][task:9-19]

  - Chip row: tydzień(active)/miesiąc/kwartał from @drshoes/ui Chip primitive
  - Bar SVG logic unchanged (repairs=ink, custom=acid stacked)
  - Chip click is no-op for M9; M10 backlog item tracks time-range filter

  Refs: docs/dispatch-log/9-19-<UTC>.md
  ```

---

### Task 9-20: `<MixDonut>` restyle with legend rows

**Review:** combined single-stage

**Depends on:** Wave 1 complete (design tokens `--acid`, `--pink`, `--blue` in globals)

**Files:**
- Modify: `apps/web/app/(admin)/admin/_components/MixDonut.tsx` — upgrade legend from bare flex row to styled `Legend` sub-component with 14px colour square + border-ink + label + percent; "aktywne" caption in SVG centre; title style matches design
- Modify: `apps/web/app/(admin)/admin/_components/__tests__/MixDonut.test.tsx` — add legend row style assertions

**Acceptance:**
- `MixDonut` renders heading "Mix zleceń" in `t-display text-[22px]`.
- Centre text: `totalActive` count in Anton 34px + "aktywne" caption in JetBrains Mono 9px.
- Legend: 3 rows each with a coloured square (14×14, border 1px var(--ink)) + label + percent. Labels: Naprawy / Custom buty / Custom kurtki.
- Data segments use real `mix` prop (existing fetch logic unchanged).
- All existing `MixDonut` tests pass; new legend-style test added.

- [ ] **Step 1: RED — update test to assert legend style**

  Replace `apps/web/app/(admin)/admin/_components/__tests__/MixDonut.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { MixDonut } from "../MixDonut";
  import type { MixByTypeRowDto } from "@/lib/dashboard/types";

  const mix: MixByTypeRowDto[] = [
    { kind: "NAPRAWA",      count: 19, percent: 45 },
    { kind: "CUSTOM_BUTY",  count: 14, percent: 33 },
    { kind: "CUSTOM_KURTKA", count: 9, percent: 22 },
  ];

  describe("MixDonut", () => {
    it("renders heading", () => {
      render(<MixDonut mix={mix} totalActive={42} />);
      expect(screen.getByText("Mix zleceń")).toBeInTheDocument();
    });

    it("renders legend labels in Polish", () => {
      render(<MixDonut mix={mix} totalActive={42} />);
      expect(screen.getByText("Naprawy")).toBeInTheDocument();
      expect(screen.getByText("Custom buty")).toBeInTheDocument();
      expect(screen.getByText("Custom kurtki")).toBeInTheDocument();
    });

    it("renders total active count in SVG center", () => {
      render(<MixDonut mix={mix} totalActive={42} />);
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("renders 'aktywne' caption", () => {
      render(<MixDonut mix={mix} totalActive={42} />);
      expect(screen.getByText("aktywne")).toBeInTheDocument();
    });

    it("renders an SVG element", () => {
      const { container } = render(<MixDonut mix={mix} totalActive={42} />);
      expect(container.querySelector("svg")).not.toBeNull();
    });

    it("renders percent labels in legend", () => {
      render(<MixDonut mix={mix} totalActive={42} />);
      expect(screen.getByText("45%")).toBeInTheDocument();
      expect(screen.getByText("33%")).toBeInTheDocument();
      expect(screen.getByText("22%")).toBeInTheDocument();
    });

    it("renders zero state without crashing", () => {
      render(<MixDonut mix={[]} totalActive={0} />);
      expect(screen.getByText("Mix zleceń")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });
  ```

  Expected: `aktywne` assertion fails (existing SVG text renders but is not necessarily queryable by `screen.getByText` if SVG text nodes are not traversed — verify at dispatch time; if SVG `<text>` is not found by `getByText`, switch to `container.querySelector('text')` check instead).

- [ ] **Step 2: Run to confirm RED**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run _components/__tests__/MixDonut
  ```

  Expected: 1-2 failures.

- [ ] **Step 3: Implement — rewrite `MixDonut.tsx`**

  Full rewrite of `apps/web/app/(admin)/admin/_components/MixDonut.tsx`:

  ```tsx
  /**
   * Donut chart — current order type mix.
   * 3 segments: Naprawy acid / Custom buty pink / Custom kurtki blue.
   * Legend rows with 14px coloured square + label + percent.
   * Pure server component.
   * ~75 LOC.
   */
  import type { MixByTypeRowDto } from "@/lib/dashboard/types";

  const KIND_LABELS: Record<string, string> = {
    NAPRAWA: "Naprawy",
    CUSTOM_BUTY: "Custom buty",
    CUSTOM_KURTKA: "Custom kurtki",
  };

  const KIND_COLORS: Record<string, string> = {
    NAPRAWA: "var(--acid)",
    CUSTOM_BUTY: "var(--pink)",
    CUSTOM_KURTKA: "var(--blue)",
  };

  const CIRC = 490;
  const R = 78;
  const CX = 100;
  const CY = 100;
  const STROKE_W = 34;

  interface LegendRowProps {
    color: string;
    label: string;
    percent: number;
  }

  function LegendRow({ color, label, percent }: LegendRowProps) {
    return (
      <div className="flex items-center gap-[10px]">
        <span
          className="inline-block shrink-0"
          style={{ width: 14, height: 14, background: color, border: "1px solid var(--ink)" }}
        />
        <span className="flex-1 text-[13px]">{label}</span>
        <span className="t-mono font-bold text-[12px]">{percent}%</span>
      </div>
    );
  }

  interface Props {
    mix: MixByTypeRowDto[];
    totalActive: number;
  }

  export function MixDonut({ mix, totalActive }: Props) {
    const { arcs } = mix.reduce<{
      arcs: Array<{ row: MixByTypeRowDto; dashLen: number; rotation: number }>;
      deg: number;
    }>(
      (acc, row) => {
        const dashLen = (row.percent / 100) * CIRC;
        return {
          arcs: [...acc.arcs, { row, dashLen, rotation: acc.deg }],
          deg: acc.deg + (row.percent / 100) * 360,
        };
      },
      { arcs: [], deg: -90 },
    );

    return (
      <div className="admin-card p-[22px]">
        <div className="t-display text-[22px] mb-[14px]">Mix zleceń</div>
        <svg viewBox="0 0 200 200" style={{ width: "100%", height: 180 }}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--paper-2)" strokeWidth={STROKE_W} />
          {arcs.map(({ row, dashLen, rotation }) => (
            <circle key={row.kind} cx={CX} cy={CY} r={R} fill="none"
              stroke={KIND_COLORS[row.kind] ?? "var(--ink)"} strokeWidth={STROKE_W}
              strokeDasharray={`${dashLen} ${CIRC}`}
              transform={`rotate(${rotation} ${CX} ${CY})`} />
          ))}
          <text x={CX} y={98} textAnchor="middle" fontFamily="Anton" fontSize="34" fill="var(--ink)">
            {totalActive}
          </text>
          <text x={CX} y={118} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="rgba(0,0,0,0.55)">
            aktywne
          </text>
        </svg>
        <div className="flex flex-col gap-[6px] mt-[6px]">
          {mix.map((row) => (
            <LegendRow
              key={row.kind}
              color={KIND_COLORS[row.kind] ?? "var(--ink)"}
              label={KIND_LABELS[row.kind] ?? row.kind}
              percent={row.percent}
            />
          ))}
        </div>
      </div>
    );
  }
  ```

  > **LOC note:** 75 LOC — within budget.

- [ ] **Step 4: GREEN — run tests**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run _components/__tests__/MixDonut
  ```

  Expected: 7/7 pass.

- [ ] **Step 5: Commit**

  ```
  feat(admin): restyle MixDonut with design-parity legend rows and aktywne caption [milestone:9][task:9-20]

  - LegendRow sub-component: 14px coloured square (border-ink) + label + bold percent
  - aktywne SVG caption preserved; kind colour mapping unchanged
  - Donut arc geometry unchanged; real mix data prop kept

  Refs: docs/dispatch-log/9-20-<UTC>.md
  ```

---

### Task 9-21: Restyle `<ReadyForPickupPanel>` + `<RecentMessagesPanel>` (combined)

**Review:** combined single-stage

**Depends on:** Wave 1 complete (`Tape`, `Pill`, `PhImg`, `AdminCard` from `@drshoes/ui`)

**Files:**
- Modify: `apps/web/app/(admin)/admin/_components/ReadyForPickupPanel.tsx` — use `<Tape>` for "{N} czeka" header badge; `<PhImg>` 44×44 thumbnail per order row; `<Pill status={...}>` per row; wrap in `<AdminCard padding={22}>`
- Modify: `apps/web/app/(admin)/admin/_components/RecentMessagesPanel.tsx` — add circular initial avatar; channel chip (t-mono ink bg paper border-ink); pink unread dot; wrap in `<AdminCard padding={22}>`
- Modify: `apps/web/app/(admin)/admin/_components/__tests__/ReadyForPickupPanel.test.tsx` — assert Tape renders count, Pill renders per row
- Modify: `apps/web/app/(admin)/admin/_components/__tests__/RecentMessagesPanel.test.tsx` — assert channel chip renders; unread dot style

**Acceptance:**
- `ReadyForPickupPanel`: header = `t-display text-[22px]` "Gotowe do odbioru" + `<Tape angle={-2}>{count} czeka</Tape>`; each row has `<PhImg>` + t-mono code + bold client name + desc + `<Pill status="GOTOWE_DO_ODBIORU" />`.
- `RecentMessagesPanel`: each row has 32px circular avatar with first initial (mono font bold) + name/time + channel chip (t-mono 10px, border border-ink, bg-paper text-ink) + preview line + pink unread dot when `t.unreadCount > 0`.
- Both wrapped in `<AdminCard padding={22}>`.
- All existing tests updated to pass with new markup.

- [ ] **Step 1: RED — update ReadyForPickupPanel tests**

  Replace `apps/web/app/(admin)/admin/_components/__tests__/ReadyForPickupPanel.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";

  vi.mock("@/lib/orders/api-server", () => ({
    listOrdersServer: vi.fn(),
  }));

  import { listOrdersServer } from "@/lib/orders/api-server";
  import { ReadyForPickupPanel } from "../ReadyForPickupPanel";
  import type { OrderListRow } from "@/lib/orders/types";

  const mockListOrders = listOrdersServer as ReturnType<typeof vi.fn>;

  const ROWS: OrderListRow[] = [
    {
      id: "ord-1", code: "DR-0042", clientId: "cli-1",
      status: "GOTOWE_DO_ODBIORU", totalPriceCents: 15000, currency: "PLN",
      description: "Naprawa podeszwy", plannedPickupAt: null, version: 1,
      updatedAt: "2026-05-10T10:00:00Z", createdAt: "2026-05-01T08:00:00Z",
      receivedAt: "2026-05-01T08:00:00Z", pickedUpAt: null,
      quotedPriceCents: 0, advancePaidCents: 0, clientName: "Test Klient",
    },
  ];

  describe("ReadyForPickupPanel", () => {
    it("renders heading", async () => {
      mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
      render(await ReadyForPickupPanel());
      expect(screen.getByText("Gotowe do odbioru")).toBeInTheDocument();
    });

    it("renders order code and description", async () => {
      mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
      render(await ReadyForPickupPanel());
      expect(screen.getByText("DR-0042")).toBeInTheDocument();
      expect(screen.getByText("Naprawa podeszwy")).toBeInTheDocument();
    });

    it("renders client name in bold", async () => {
      mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
      render(await ReadyForPickupPanel());
      expect(screen.getByText("Test Klient")).toBeInTheDocument();
    });

    it("renders Tape count badge", async () => {
      mockListOrders.mockResolvedValueOnce({ content: ROWS, totalElements: 1, totalPages: 1, number: 0, size: 4 });
      render(await ReadyForPickupPanel());
      // Tape renders "{count} czeka"
      expect(screen.getByText(/czeka/)).toBeInTheDocument();
    });

    it("renders empty state when no orders", async () => {
      mockListOrders.mockResolvedValueOnce({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 4 });
      render(await ReadyForPickupPanel());
      expect(screen.getByText("Nic gotowego")).toBeInTheDocument();
    });

    it("renders error state on fetch failure", async () => {
      mockListOrders.mockRejectedValueOnce(new Error("network error"));
      render(await ReadyForPickupPanel());
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: RED — update RecentMessagesPanel tests**

  Replace `apps/web/app/(admin)/admin/_components/__tests__/RecentMessagesPanel.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";

  vi.mock("@/lib/messaging/api-server", () => ({
    listThreadsServer: vi.fn(),
  }));

  import { listThreadsServer } from "@/lib/messaging/api-server";
  import { RecentMessagesPanel } from "../RecentMessagesPanel";
  import type { MessageThreadDto } from "@/lib/messaging/types";

  const mockListThreads = listThreadsServer as ReturnType<typeof vi.fn>;

  const THREADS: MessageThreadDto[] = [
    {
      id: "thr-1", clientId: "cli-1", rawSender: null,
      channel: "WHATSAPP", subject: null,
      lastMessageAt: "2026-05-10T09:46:00Z", unreadCount: 1,
      createdAt: "2026-05-01T00:00:00Z", updatedAt: "2026-05-10T09:46:00Z",
      lastMessagePreview: "Hej, kiedy mogę odebrać moje 1460?",
      unmatched: false, clientName: "Magdalena K.",
      clientEmail: null, clientPhone: null, discardedAt: null,
    },
  ];

  describe("RecentMessagesPanel", () => {
    it("renders heading", async () => {
      mockListThreads.mockResolvedValueOnce(THREADS);
      render(await RecentMessagesPanel());
      expect(screen.getByText("Ostatnie wiadomości")).toBeInTheDocument();
    });

    it("renders client name and message preview", async () => {
      mockListThreads.mockResolvedValueOnce(THREADS);
      render(await RecentMessagesPanel());
      expect(screen.getByText("Magdalena K.")).toBeInTheDocument();
      expect(screen.getByText("Hej, kiedy mogę odebrać moje 1460?")).toBeInTheDocument();
    });

    it("renders initial avatar from client name", async () => {
      mockListThreads.mockResolvedValueOnce(THREADS);
      render(await RecentMessagesPanel());
      // First initial = "M"
      expect(screen.getByText("M")).toBeInTheDocument();
    });

    it("renders channel chip", async () => {
      mockListThreads.mockResolvedValueOnce(THREADS);
      render(await RecentMessagesPanel());
      expect(screen.getByText("WHATSAPP")).toBeInTheDocument();
    });

    it("renders unread badge for unread threads", async () => {
      mockListThreads.mockResolvedValueOnce(THREADS);
      const { container } = render(await RecentMessagesPanel());
      expect(container.querySelector("[data-testid='unread-dot']")).not.toBeNull();
    });

    it("renders empty state when no threads", async () => {
      mockListThreads.mockResolvedValueOnce([]);
      render(await RecentMessagesPanel());
      expect(screen.getByText("Brak nowych wiadomości")).toBeInTheDocument();
    });

    it("renders error state on fetch failure", async () => {
      mockListThreads.mockRejectedValueOnce(new Error("network error"));
      render(await RecentMessagesPanel());
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
  ```

  Expected: `initial avatar` and `channel chip` assertions fail.

- [ ] **Step 3: Run to confirm RED**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run _components/__tests__/ReadyForPickupPanel
  pnpm --filter web test -- --run _components/__tests__/RecentMessagesPanel
  ```

- [ ] **Step 4: Implement — rewrite `ReadyForPickupPanel.tsx`**

  Full rewrite of `apps/web/app/(admin)/admin/_components/ReadyForPickupPanel.tsx`:

  ```tsx
  /**
   * Dashboard lower-left: orders with status GOTOWE_DO_ODBIORU.
   * Tape count badge header, PhImg thumbnail, Pill per row, AdminCard wrapper.
   * Server component with inline try/catch error isolation.
   * ~70 LOC.
   */
  import Link from "next/link";
  import { Tape, PhImg, Pill, AdminCard } from "@drshoes/ui";
  import { listOrdersServer } from "@/lib/orders/api-server";
  import { EmptyState } from "@/components/state/EmptyState";
  import { ErrorBanner } from "@/components/state/ErrorBanner";

  export async function ReadyForPickupPanel() {
    let orders: import("@/lib/orders/types").OrderListRow[] | undefined;
    let fetchError = false;

    try {
      const page = await listOrdersServer({ status: "GOTOWE_DO_ODBIORU" }, 0, 4);
      orders = page.content;
    } catch {
      fetchError = true;
    }

    return (
      <AdminCard padding={22}>
        <div className="flex justify-between items-center mb-[14px]">
          <div className="t-display text-[22px]">Gotowe do odbioru</div>
          {!fetchError && orders && orders.length > 0 && (
            <Tape angle={-2}>{orders.length} czeka</Tape>
          )}
        </div>

        {fetchError && <ErrorBanner message="Nie udało się załadować danych." />}

        {!fetchError && orders?.length === 0 && (
          <EmptyState message="Nic gotowego" sub="Brak zamówień gotowych do odbioru." />
        )}

        {!fetchError && orders && orders.length > 0 && (
          <div className="flex flex-col gap-[10px]">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center gap-3 p-[10px] border border-[var(--line)]">
                <PhImg label="" style={{ width: 44, height: 44, border: "1.5px solid var(--ink)" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="t-mono text-[11px] text-admin-mute">{o.code}</span>
                    <span className="font-semibold text-[13px]">{o.clientName ?? "—"}</span>
                  </div>
                  <div className="t-mono text-[11px] text-admin-mute mt-0.5 truncate">
                    {o.description ?? "—"}
                  </div>
                </div>
                <Pill status={o.status as import("@/lib/orders/types").OrderStatus} />
                <Link href={`/admin/orders?orderId=${o.id}`} className="btn-clean text-[11px] px-2 py-1">
                  otwórz
                </Link>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    );
  }
  ```

  > **LOC note:** 70 LOC — within budget.

- [ ] **Step 5: Implement — rewrite `RecentMessagesPanel.tsx`**

  Full rewrite of `apps/web/app/(admin)/admin/_components/RecentMessagesPanel.tsx`:

  ```tsx
  /**
   * Dashboard lower-middle: top-4 most recent message threads.
   * Circular initial avatar, channel chip (t-mono ink/paper), pink unread dot.
   * Server component with inline try/catch error isolation.
   * ~75 LOC.
   */
  import Link from "next/link";
  import { AdminCard } from "@drshoes/ui";
  import { listThreadsServer } from "@/lib/messaging/api-server";
  import { EmptyState } from "@/components/state/EmptyState";
  import { ErrorBanner } from "@/components/state/ErrorBanner";
  import type { MessageThreadDto } from "@/lib/messaging/types";

  export async function RecentMessagesPanel() {
    let threads: MessageThreadDto[] | undefined;
    let fetchError = false;

    try {
      const all = await listThreadsServer("ALL");
      threads = all.slice(0, 4);
    } catch {
      fetchError = true;
    }

    return (
      <AdminCard padding={22}>
        <div className="t-display text-[22px] mb-[14px]">Ostatnie wiadomości</div>

        {fetchError && <ErrorBanner message="Nie udało się załadować danych." />}
        {!fetchError && threads?.length === 0 && <EmptyState message="Brak nowych wiadomości" />}

        {!fetchError && threads && threads.length > 0 && (
          <div className="flex flex-col gap-3">
            {threads.map((t) => {
              const name = t.clientName ?? t.rawSender ?? "?";
              const initial = name[0] ?? "?";
              return (
                <Link key={t.id} href={`/admin/messages?thread=${t.id}`}
                  className="flex gap-[10px] items-start hover:bg-[var(--paper-2)] transition-colors rounded-sm">
                  {/* Circular avatar */}
                  <div style={{ width: 32, height: 32, borderRadius: "50%",
                    background: "var(--paper-2)", border: "1.5px solid var(--ink)",
                    fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11 }}
                    className="shrink-0 flex items-center justify-center">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold">{name}</span>
                      <span className="t-mono text-[10px] text-admin-mute shrink-0 ml-2">
                        {t.lastMessageAt
                          ? new Date(t.lastMessageAt).toLocaleTimeString("pl-PL", {
                              hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
                            })
                          : ""}
                      </span>
                    </div>
                    <div className="text-[12px] text-admin-mute truncate">{t.lastMessagePreview ?? ""}</div>
                    {/* Channel chip */}
                    <span className="t-mono text-[10px] text-ink bg-paper border border-ink px-1.5 py-0.5 inline-block mt-1">
                      {t.channel}
                    </span>
                  </div>
                  {t.unreadCount > 0 && (
                    <span data-testid="unread-dot"
                      className="shrink-0 w-2 h-2 rounded-full bg-[var(--pink)] mt-3"
                      aria-label="nieprzeczytane" />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </AdminCard>
    );
  }
  ```

  > **LOC note:** 75 LOC — within budget.

- [ ] **Step 6: GREEN — run tests**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run _components/__tests__/ReadyForPickupPanel
  pnpm --filter web test -- --run _components/__tests__/RecentMessagesPanel
  ```

  Expected: 6/6 + 7/7 = 13/13 pass.

- [ ] **Step 7: Commit**

  ```
  feat(admin): restyle ReadyForPickupPanel + RecentMessagesPanel to design parity [milestone:9][task:9-21]

  - ReadyForPickupPanel: Tape count header, PhImg thumbnail, bold client name, Pill status
  - RecentMessagesPanel: circular initial avatar, channel chip (t-mono border-ink), pink unread dot
  - Both wrapped in AdminCard padding={22}

  Refs: docs/dispatch-log/9-21-<UTC>.md
  ```

---

### Task 9-22: Create `<FreshReservationsPanel>` NEW + finalise Dashboard page layout

**Review:** combined single-stage

**Depends on:** 9-21; Wave 1 complete (`AdminCard`, `PhImg` from `@drshoes/ui`)

**Backend gap check:** There is no `/api/admin/reservations` endpoint in the current codebase (confirmed: `find apps/web/app/api/admin` returns no files; no Java `ReservationController` exists — only `TriggerEvent.java` contains the word "reservation" in a different context). This task is therefore **partially blocked** on a backend slice.

> **9-22 [BLOCKED — backend gap]:** `FreshReservationsPanel` requires a `/api/admin/reservations?limit=3&sort=createdAt,desc` endpoint and a `ProductReservationDto`. This does not exist. The orchestrator must schedule a thin backend slice (TWO-STAGE) before this panel can display real data. **For M9**, implement the component with a static placeholder data fallback: if the API call fails or returns 404, render the static placeholder array from the design reference (3 hardcoded rows). Flag with a `// TODO(M10): replace with real API call once backend slice ships` comment. The component's prop interface and empty/error states are production-ready so it can be wired with one-line change when the endpoint exists.

**Files:**
- Create: `apps/web/app/(admin)/admin/_components/FreshReservationsPanel.tsx` — new panel with 3-card layout; static placeholder fallback; `AdminCard` wrapper
- Create: `apps/web/app/(admin)/admin/_components/__tests__/FreshReservationsPanel.test.tsx` — snapshot + empty state + placeholder test
- Modify: `apps/web/app/(admin)/admin/page.tsx` — update dashboard layout to 3-column lower row + add `FreshReservationsPanel`; add `DashboardPageHeaderSetter` (from 9-17)

**Acceptance:**
- `FreshReservationsPanel` renders `t-display 22` heading "Świeże rezerwacje".
- Each of 3 reservation cards has: `<PhImg>` 40×40 + client name (bold 13px) + product name (t-mono 11px truncate) + timestamp (t-mono 10px) + `btn-clean` "otwórz" button.
- Dashed 1px `border-dashed border-[var(--line)]` per card (matching design).
- Empty state renders "Brak rezerwacji" message.
- Dashboard page.tsx uses `grid-cols-[2fr_1fr]` for chart row and `grid-cols-[1.2fr_1fr_1fr]` for lower row.

- [ ] **Step 1: RED — write FreshReservationsPanel.test.tsx**

  Create `apps/web/app/(admin)/admin/_components/__tests__/FreshReservationsPanel.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { FreshReservationsPanel } from "../FreshReservationsPanel";

  describe("FreshReservationsPanel", () => {
    it("renders heading", () => {
      render(<FreshReservationsPanel />);
      expect(screen.getByText("Świeże rezerwacje")).toBeInTheDocument();
    });

    it("renders placeholder reservation client names", () => {
      render(<FreshReservationsPanel />);
      // Static placeholder rows from design reference
      expect(screen.getByText("Karol J.")).toBeInTheDocument();
      expect(screen.getByText("Iga S.")).toBeInTheDocument();
      expect(screen.getByText("Adam W.")).toBeInTheDocument();
    });

    it("renders 'otwórz' buttons for each row", () => {
      render(<FreshReservationsPanel />);
      const buttons = screen.getAllByRole("button", { name: /otwórz/i });
      expect(buttons).toHaveLength(3);
    });

    it("renders product names", () => {
      render(<FreshReservationsPanel />);
      expect(screen.getByText("AF1 Mid 'Bandana'")).toBeInTheDocument();
    });
  });
  ```

  Expected compile failure: `FreshReservationsPanel` does not exist yet.

- [ ] **Step 2: Run to confirm RED**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run _components/__tests__/FreshReservationsPanel
  ```

- [ ] **Step 3: Implement `FreshReservationsPanel.tsx`**

  Create `apps/web/app/(admin)/admin/_components/FreshReservationsPanel.tsx`:

  ```tsx
  /**
   * FreshReservationsPanel — latest 3 product reservations.
   *
   * TODO(M10-backend): Replace PLACEHOLDER_ROWS with a real fetch once the
   * backend slice ships /api/admin/reservations?limit=3&sort=createdAt,desc.
   * Expected DTO shape:
   *   { id: string; clientName: string; productName: string; createdAt: string }
   * When real data is available, replace PLACEHOLDER_ROWS with:
   *   const res = await fetch('/api/admin/reservations?limit=3&sort=createdAt,desc');
   *   const rows: ReservationRow[] = await res.json();
   *
   * Pure client component for now (static data). Becomes SC once API is wired.
   * ~60 LOC.
   */
  import { AdminCard, PhImg } from "@drshoes/ui";
  import { createLogger } from "@/lib/log";

  const log = createLogger("admin.fresh-reservations");

  interface ReservationRow {
    id: string;
    clientName: string;
    productName: string;
    when: string;
  }

  /** Static placeholder rows matching admin.jsx design reference. Remove when M10 backend lands. */
  const PLACEHOLDER_ROWS: ReservationRow[] = [
    { id: "res-1", clientName: "Karol J.",  productName: "AF1 Mid 'Bandana'",   when: "dziś · 10:24" },
    { id: "res-2", clientName: "Iga S.",    productName: "Vans Authentic 'Drip'", when: "wczoraj · 19:01" },
    { id: "res-3", clientName: "Adam W.",   productName: "Jordan 1 'Tag'",       when: "wczoraj · 14:50" },
  ];

  interface Props {
    rows?: ReservationRow[];
  }

  export function FreshReservationsPanel({ rows = PLACEHOLDER_ROWS }: Props) {
    log.debug("op=FreshReservationsPanel.render", { count: rows.length });

    return (
      <AdminCard padding={22}>
        <div className="t-display text-[22px] mb-[14px]">Świeże rezerwacje</div>

        {rows.length === 0 && (
          <p className="t-mono text-[12px] text-admin-mute">Brak rezerwacji</p>
        )}

        {rows.length > 0 && (
          <div className="flex flex-col gap-3">
            {rows.map((r) => (
              <div key={r.id}
                className="flex gap-[10px] p-[10px]"
                style={{ border: "1px dashed var(--line)" }}>
                <PhImg label="" style={{ width: 40, height: 40, border: "1.5px solid var(--ink)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px]">{r.clientName}</div>
                  <div className="t-mono text-[11px] text-admin-mute truncate">{r.productName}</div>
                  <div className="t-mono text-[10px] text-admin-mute mt-0.5">{r.when}</div>
                </div>
                <button className="btn-clean self-center" style={{ padding: "4px 8px", fontSize: 11 }}>
                  otwórz
                </button>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    );
  }
  ```

  > **LOC note:** 60 LOC — within budget.

- [ ] **Step 4: Implement — update `AdminPage` in `page.tsx`**

  Full rewrite of `apps/web/app/(admin)/admin/page.tsx`:

  ```tsx
  /**
   * /admin — Dashboard page.
   * Five components: KpiTilesRow + OrdersWeekChart + MixDonut (upper rows)
   * + ReadyForPickupPanel + RecentMessagesPanel + FreshReservationsPanel (lower row).
   * Server component — Suspense boundaries provide loading skeletons.
   * ~65 LOC.
   */
  import { Suspense } from "react";
  import { getDashboardKpisServer, getDashboardChartsServer } from "@/lib/dashboard/api-server";
  import { KpiTilesRow } from "./_components/KpiTilesRow";
  import { OrdersWeekChart } from "./_components/OrdersWeekChart";
  import { MixDonut } from "./_components/MixDonut";
  import { ReadyForPickupPanel } from "./_components/ReadyForPickupPanel";
  import { RecentMessagesPanel } from "./_components/RecentMessagesPanel";
  import { FreshReservationsPanel } from "./_components/FreshReservationsPanel";
  import { PageHeaderSetter } from "./_components/DashboardPageHeaderSetter";
  import { Skeleton } from "@/components/state/Skeleton";
  import { ErrorBanner } from "@/components/state/ErrorBanner";

  async function KpiSection() {
    let kpis;
    try { kpis = await getDashboardKpisServer(); }
    catch { return <ErrorBanner message="Nie udało się załadować KPI." />; }
    return <KpiTilesRow kpis={kpis} />;
  }

  async function ChartsSection() {
    let charts;
    try { charts = await getDashboardChartsServer(); }
    catch { return <ErrorBanner message="Nie udało się załadować wykresów." />; }
    const total = charts.mixByType.reduce((s, r) => s + r.count, 0);
    return (
      <div className="grid grid-cols-[2fr_1fr] gap-5">
        <OrdersWeekChart rows={charts.ordersPerWeek} />
        <MixDonut mix={charts.mixByType} totalActive={total} />
      </div>
    );
  }

  export default async function AdminPage() {
    return (
      <div className="space-y-5">
        <PageHeaderSetter />

        <Suspense fallback={<Skeleton height="h-24" />}>
          <KpiSection />
        </Suspense>

        <Suspense fallback={<Skeleton height="h-52" />}>
          <ChartsSection />
        </Suspense>

        <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-5">
          <Suspense fallback={<Skeleton height="h-12" rows={3} />}>
            <ReadyForPickupPanel />
          </Suspense>
          <Suspense fallback={<Skeleton height="h-10" rows={4} />}>
            <RecentMessagesPanel />
          </Suspense>
          {/* FreshReservationsPanel uses static placeholder until M10 backend slice ships */}
          <FreshReservationsPanel />
        </div>
      </div>
    );
  }
  ```

  > **LOC note:** 65 LOC — within budget.

- [ ] **Step 5: GREEN — run full vitest suite**

  ```bash
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter web test -- --run
  ```

  Expected: all previous tests pass + 4 new `FreshReservationsPanel` tests pass.

- [ ] **Step 6: Commit**

  ```
  feat(admin): add FreshReservationsPanel + finalise dashboard 3-col layout [milestone:9][task:9-22]

  - FreshReservationsPanel: static placeholder rows (M10 backend gap flagged in TODO comment)
  - PhImg 40×40 + dashed border card + otwórz btn-clean per row
  - Dashboard page.tsx: grid-cols-[1.2fr_1fr_1fr] lower row; PageHeaderSetter wired
  - BLOCKED note in code: backend /api/admin/reservations slice required for real data

  Refs: docs/dispatch-log/9-22-<UTC>.md
  ```
# Waves 4 + 5 — Orders/Drawer + Calendar/Kanban (9-23 .. 9-29)

---

## Wave 4 — Orders list + drawer

### Task 9-23: Orders list page reskin

**Review:** combined single-stage

**Context:**
- `apps/web/app/(admin)/admin/orders/page.tsx` — Server Component that renders the list page.
- `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx` — `<table>` rendering rows; currently uses ad-hoc class strings, no `.tbl` utility class, status column renders an ad-hoc `<span>` with `STATUS_PILL_CLASS`.
- `apps/web/app/(admin)/admin/orders/_components/OrdersFilters.tsx` — renders a standard `<div>` with `<fieldset>` / `<select>` / `<input>` controls.
- `apps/web/app/(admin)/admin/orders/_components/SavedFilterPresets.tsx` — renders hard-coded preset chips with `rounded-full` styling; three presets: "Pilne na ten tydzień", "Gotowe do odbioru", "Zaległe".
- Design reference: `handoff/design/admin.jsx` lines 242–333 (OrdersList function).
- Primitive dependencies (shipped by Wave 1): `<Pill status>`, `<Chip>`, `<PhImg>` from `packages/ui/src/components/`.
- `usePageHeader` hook (shipped by Wave 2): `apps/web/app/(admin)/admin/_components/PageHeaderContext.tsx`.

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/page.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrdersFilters.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/SavedFilterPresets.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/__tests__/SavedFilterPresets.test.tsx`

**Acceptance:**
1. `<table>` in `OrdersTable` has className containing `tbl`; `<thead>` has `bg-paper-2 border-b-[2px] border-ink` (matching `.tbl th` utility styles from globals.css).
2. Status cell renders `<Pill status={row.status} />` — no more ad-hoc `STATUS_PILL_CLASS` span.
3. Photo column renders `<PhImg label="" style={{ width: 36, height: 36, border: '1.5px solid var(--ink)' }} />`.
4. `SavedFilterPresets` renders `<Chip color="pink">` for "pilne", `<Chip active>` for "gotowe", `<Chip>` for "zaległe", dashed `<Chip>` for "+ zapisz widok".
5. `OrdersFilters` renders chips row instead of fieldset/select controls; counter "X z Y zleceń" on right aligned end.
6. `page.tsx` calls `usePageHeader({ title: 'Zamówienia', subtitle: '... aktywnych · ... gotowych do odbioru', right: <Button variant="primary">+ Nowe zlecenie</Button> })` and drops the old inline `<h1>` + `<Link>` header block.
7. `pnpm vitest run` — all existing SavedFilterPresets tests pass (chip label text unchanged, behaviour unchanged).
8. Existing sort / bulk-select / pagination functionality untouched.

- [ ] **Step 1: RED — update `SavedFilterPresets.test.tsx` to assert `<Chip>` rendering**

  Add a test that verifies the first preset chip has `data-color="pink"` (or asserts the `<Chip>` renders with the pink variant class). The test will fail because `SavedFilterPresets` currently uses plain `<button>` with `rounded-full` classes, not `<Chip>`.

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/__tests__/SavedFilterPresets.test.tsx
  // ADD at end of first describe block:

  it("first preset chip renders with pink color variant (data-color or class)", () => {
    render(<SavedFilterPresets />);
    const pilne = screen.getByText(/pilne na ten tydzień/i).closest("button");
    // After reskin, SavedFilterPresets wraps presets in <Chip> which adds data-color
    expect(pilne?.getAttribute("data-color") ?? pilne?.className).toMatch(/pink/);
  });
  ```

- [ ] **Step 2: Reskin `SavedFilterPresets.tsx`**

  Replace ad-hoc `<button>` chips with `<Chip>` from `packages/ui/src/components/Chip.tsx` (shipped in 9-6). Keep all existing logic (preset definitions, `isActive`, `applyPreset`, `clearAllFilters`) intact — only the JSX template changes.

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/SavedFilterPresets.tsx
  // (showing only the import additions and JSX changes — logic block unchanged)

  import { Chip } from "@repo/ui";
  // ... (existing imports kept)

  // In the return JSX, replace the chips section:
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
      <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>
        presety:
      </span>

      {anyFilterActive && (
        <Chip onClick={clearAllFilters} aria-label="Wyczyść wszystkie filtry">
          Wszystkie
        </Chip>
      )}

      {presets.map((preset, i) => {
        const active = i === activeIdx;
        const isFirst = i === 0;
        return (
          <Chip
            key={preset.label}
            active={active}
            color={isFirst ? "pink" : "default"}
            onClick={() => {
              if (active) { router.replace("/admin/orders"); }
              else { applyPreset(preset); }
            }}
            aria-pressed={active}
          >
            {preset.label}
          </Chip>
        );
      })}

      <Chip
        disabled
        title="Wkrótce: możliwość zapisywania własnych widoków"
        aria-label="Zapisz widok (wkrótce)"
        style={{ borderStyle: "dashed", background: "transparent" }}
      >
        + zapisz widok
      </Chip>
    </div>
  );
  ```

- [ ] **Step 3: Reskin `OrdersFilters.tsx`**

  Replace the `<div className="flex flex-wrap gap-4 ...">` form-based layout with a chip-style filter bar. The filter handlers (`onStatus`, `onKind`, `onCraftsman`, `onQ`) keep their logic but the trigger surface changes from `<select>` / `<input>` / `<fieldset>` to `<Chip>` buttons. A free-text search chip opens an inline input on click (same debounce logic). Counter "X z Y" on right.

  Note: `OrdersFilters` does not have access to `total` count — pass it via a new optional prop `total?: number; visible?: number` from `OrdersPageClient`.

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrdersFilters.tsx
  "use client";

  import { useRouter, useSearchParams } from "next/navigation";
  import { useRef, useState } from "react";
  import type { Route } from "next";
  import { createLogger } from "@/lib/log";
  import { KIND_LABELS_PL, STATUS_LABELS_PL } from "@/lib/orders/status";
  import type { OrderStatus, OrderItemKind } from "@/lib/orders/types";
  import type { UserStubDto } from "@/lib/users/types";
  import { Chip } from "@repo/ui";
  import { I } from "@repo/ui";

  const log = createLogger("orders-filters");

  const ALL_KINDS: OrderItemKind[] = ["NAPRAWA", "CUSTOM_BUTY", "CUSTOM_KURTKA"];

  interface Props {
    initial: {
      status?: OrderStatus[];
      type?: string[];
      craftsmanId?: string;
      q?: string;
    };
    users: UserStubDto[];
    visible?: number;
    total?: number;
  }

  export function OrdersFilters({ initial, users, visible, total }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);

    function push(updates: Record<string, string | string[] | undefined>) {
      const p = new URLSearchParams(searchParams.toString());
      p.delete("page");
      for (const [k, v] of Object.entries(updates)) {
        p.delete(k);
        if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
        else if (v) p.set(k, v);
      }
      log.info("op=filterChange", { ...updates });
      router.replace(`/admin/orders?${p.toString()}` as Route);
    }

    function onStatus(s: OrderStatus) {
      const current = initial.status ?? [];
      const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
      push({ status: next.length ? next : undefined });
    }

    function onKind(kind: OrderItemKind) {
      const current = initial.type ?? [];
      const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind];
      push({ type: next.length ? next : undefined });
    }

    function onQ(e: React.ChangeEvent<HTMLInputElement>) {
      const val = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        push({ q: val || undefined });
        if (!val) setSearchOpen(false);
      }, 250);
    }

    const statusActive = (initial.status ?? []).length > 0;
    const typeActive = (initial.type ?? []).length > 0;
    const craftsmanActive = !!initial.craftsmanId;
    const searchActive = !!initial.q;

    return (
      <div
        className="flex flex-wrap gap-2.5 items-center px-6 py-3.5"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        {/* Status filter chip */}
        <Chip active={statusActive} icon={<I.filter />}>
          status: {statusActive ? (initial.status ?? []).map((s) => STATUS_LABELS_PL[s]).join(", ") : "wszystkie"}
        </Chip>

        {/* Kind chips */}
        {ALL_KINDS.map((k) => (
          <Chip
            key={k}
            active={(initial.type ?? []).includes(k)}
            onClick={() => onKind(k)}
          >
            {KIND_LABELS_PL[k]}
          </Chip>
        ))}

        {/* Craftsman chip */}
        <Chip active={craftsmanActive}>
          rzemieślnik: {craftsmanActive
            ? users.find((u) => u.id === initial.craftsmanId)?.fullName ?? "wybrany"
            : "każdy"}
        </Chip>

        {/* Date chip */}
        <Chip icon={<I.calendar />}>przyjęcie: wszystkie</Chip>

        {/* Client chip */}
        <Chip icon={<I.user />}>klient</Chip>

        {/* Search chip + inline input */}
        {searchOpen ? (
          <input
            autoFocus
            type="search"
            defaultValue={initial.q ?? ""}
            onChange={onQ}
            onBlur={() => { if (!initial.q) setSearchOpen(false); }}
            placeholder="Szukaj…"
            className="border border-ink px-2 py-1 t-mono text-[12px] w-40 focus:outline-none focus:ring-1 focus:ring-ink"
          />
        ) : (
          <Chip active={searchActive} onClick={() => setSearchOpen(true)}>
            {searchActive ? `szukaj: ${initial.q}` : "szukaj"}
          </Chip>
        )}

        {/* Spacer + counter */}
        <div style={{ flex: 1 }} />
        {visible != null && total != null && (
          <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.5)" }}>
            {visible} z {total} zleceń
          </span>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 4: Reskin `OrdersTable.tsx`**

  Replace the outer `<table className="w-full border-collapse">` with `<table className="tbl">`. Replace the `<span className={STATUS_PILL_CLASS[...]}>` in the status cell with `<Pill status={row.status} />`. Add a photo column rendering `<PhImg label="" style={{ width: 36, height: 36, border: '1.5px solid var(--ink)' }} />`. Keep all existing columns; the photo column goes between "Rzemieślnik" and the actions column.

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx
  // Key changes only — retain all existing logic (pricePLN, fmtDate, fmtDateTime,
  // goToPage, onRowActivate, pagination, bulk-select handlers)

  import { Pill, PhImg } from "@repo/ui";

  // In JSX:
  // Change:
  //   <table className="w-full border-collapse">
  // To:
  //   <table className="tbl">

  // Remove the outer <div className="overflow-x-auto border border-admin-line rounded">
  // wrap — .tbl provides its own border-collapse. Wrap the table in a plain
  // <div className="overflow-x-auto"> inside the outer <div className="admin-card" ...>
  // that OrdersPageClient provides (or wrap here with admin-card for scoping).

  // Status td change:
  // Remove: <span className={`inline-block px-3 py-1 rounded-md ... ${STATUS_PILL_CLASS[row.status]}`}>{STATUS_LABELS_PL[row.status]}</span>
  // Add:    <Pill status={row.status} />

  // Photo td — add after the craftsman column:
  // <td className={tdCls}>
  //   <PhImg label="" style={{ width: 36, height: 36, border: "1.5px solid var(--ink)" }} />
  // </td>
  // Also add <th className={thCls} style={{ width: 50 }}>Foto</th> in <thead>
  ```

- [ ] **Step 5: Update `page.tsx` to use `usePageHeader`**

  Remove the `<div className="flex items-center justify-between mb-7">` header block (the `<h1>` and the `<Link>` "Nowe zlecenie" button). Replace with a `usePageHeader` call at the top of the component body.

  Because `page.tsx` is a Server Component and `usePageHeader` is a client hook, extract a thin `"use client"` wrapper component `OrdersPageHeader.tsx` that calls `usePageHeader` and renders nothing (it only sets context). Import and render it at the top of the page RSC output.

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrdersPageHeader.tsx
  "use client";

  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { Button } from "@repo/ui";
  import Link from "next/link";
  import type { Route } from "next";

  interface Props { active: number; ready: number; }

  export function OrdersPageHeader({ active, ready }: Props) {
    usePageHeader({
      title: "Zamówienia",
      subtitle: `${active} aktywnych · ${ready} gotowych do odbioru`,
      right: (
        <Link href={"/admin/orders/new" as Route}>
          <Button variant="primary">+ Nowe zlecenie</Button>
        </Link>
      ),
    });
    return null;
  }
  ```

  In `page.tsx`, compute `active` and `ready` from `pageData` and render `<OrdersPageHeader active={...} ready={...} />` as first child.

- [ ] **Commit**

  ```
  feat(orders): reskin list page — .tbl, Pill, Chip filters, usePageHeader [milestone:9][task:9-23]
  Refs: docs/dispatch-log/9-23-<UTC>.md
  ```

---

### Task 9-24: `<OrderDrawerStatusTimeline>` NEW

**Review:** combined single-stage

**Context:**
- Design reference: `handoff/design/admin.jsx` lines 357–375 (status timeline block inside `OrderDrawer` function).
- The 5 steps map to: przyjęte (`PRZYJETE`) → w realizacji (`W_REALIZACJI`) → czeka (`CZEKA_NA_KLIENTA`) → gotowe (`GOTOWE_DO_ODBIORU`) → wydane (`WYDANE`). `WSTEPNIE_PRZYJETE` and `ANULOWANE` are excluded from the visual timeline per spec §4.3.
- For the "active" step, the design uses `borderRadius: 0` (square), for past and future steps it uses `borderRadius: "50%"` (circle). Font: `var(--font-mono)`, step number `i + 1` rendered inside.
- Integration point: `OrderDrawer.tsx` — render `<OrderDrawerStatusTimeline currentStatus={order.status} />` as first child inside the scroll container `<div className="flex-1 overflow-y-auto">`, before `<OrderDrawerCoreFields>`.

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerStatusTimeline.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerStatusTimeline.test.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`

**Acceptance:**
1. Component renders exactly 5 step circles + 4 connecting lines.
2. For `currentStatus="PRZYJETE"` (step index 0): step 0 circle is `bg-ink text-paper`, steps 1–4 are `bg-white border-2 border-ink text-ink/40`. Connecting line 0→1 is `bg-line2` (future). No past lines.
3. For `currentStatus="W_REALIZACJI"` (step index 1): step 0 is past (ink ring, paper bg, ink text full opacity), step 1 is active (ink bg, paper text, square border-radius), steps 2–4 are future. Connecting line 0→1 is `bg-ink` (past→current), lines 1→2, 2→3, 3→4 are `bg-line2` (future).
4. For `currentStatus="WYDANE"` (step index 4): steps 0–3 are past, step 4 is active. All 4 connecting lines are `bg-ink`.
5. `WSTEPNIE_PRZYJETE` renders same as `PRZYJETE` in the timeline (treat as pre-step-0 — step 0 is active).
6. `ANULOWANE` renders all steps past (grey out entire timeline — all circles `opacity-40`).
7. Vitest: 5 test cases (one per main status); each verifies step state counts via `data-step-state` attributes.
8. `pnpm vitest run` — green.

- [ ] **Step 1: RED — write `OrderDrawerStatusTimeline.test.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerStatusTimeline.test.tsx
  import React from "react";
  import { describe, it, expect } from "vitest";
  import { render } from "@testing-library/react";
  import { OrderDrawerStatusTimeline } from "../OrderDrawerStatusTimeline";

  function getStates(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll("[data-step-state]"))
      .map((el) => el.getAttribute("data-step-state") ?? "");
  }

  describe("OrderDrawerStatusTimeline", () => {
    it("PRZYJETE: step 0 active, steps 1-4 future", () => {
      const { container } = render(<OrderDrawerStatusTimeline currentStatus="PRZYJETE" />);
      const states = getStates(container);
      expect(states).toEqual(["active", "future", "future", "future", "future"]);
    });

    it("W_REALIZACJI: step 0 past, step 1 active, steps 2-4 future", () => {
      const { container } = render(<OrderDrawerStatusTimeline currentStatus="W_REALIZACJI" />);
      const states = getStates(container);
      expect(states).toEqual(["past", "active", "future", "future", "future"]);
    });

    it("CZEKA_NA_KLIENTA: steps 0-1 past, step 2 active, steps 3-4 future", () => {
      const { container } = render(<OrderDrawerStatusTimeline currentStatus="CZEKA_NA_KLIENTA" />);
      const states = getStates(container);
      expect(states).toEqual(["past", "past", "active", "future", "future"]);
    });

    it("GOTOWE_DO_ODBIORU: steps 0-2 past, step 3 active, step 4 future", () => {
      const { container } = render(<OrderDrawerStatusTimeline currentStatus="GOTOWE_DO_ODBIORU" />);
      const states = getStates(container);
      expect(states).toEqual(["past", "past", "past", "active", "future"]);
    });

    it("WYDANE: steps 0-3 past, step 4 active", () => {
      const { container } = render(<OrderDrawerStatusTimeline currentStatus="WYDANE" />);
      const states = getStates(container);
      expect(states).toEqual(["past", "past", "past", "past", "active"]);
    });

    it("WSTEPNIE_PRZYJETE: step 0 active (pre-step = przyjęte bucket)", () => {
      const { container } = render(<OrderDrawerStatusTimeline currentStatus="WSTEPNIE_PRZYJETE" />);
      const states = getStates(container);
      expect(states[0]).toBe("active");
    });

    it("renders exactly 5 step circles", () => {
      const { container } = render(<OrderDrawerStatusTimeline currentStatus="PRZYJETE" />);
      expect(container.querySelectorAll("[data-step-state]").length).toBe(5);
    });
  });
  ```

- [ ] **Step 2: GREEN — create `OrderDrawerStatusTimeline.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrderDrawerStatusTimeline.tsx
  "use client";

  import { createLogger } from "@/lib/log";
  import type { OrderStatus } from "@/lib/orders/types";

  const log = createLogger("order-drawer-status-timeline");

  interface Props {
    currentStatus: OrderStatus;
  }

  const STEPS: { status: OrderStatus; label: string }[] = [
    { status: "PRZYJETE",          label: "przyjęte" },
    { status: "W_REALIZACJI",      label: "w realizacji" },
    { status: "CZEKA_NA_KLIENTA",  label: "czeka" },
    { status: "GOTOWE_DO_ODBIORU", label: "gotowe" },
    { status: "WYDANE",            label: "wydane" },
  ];

  type StepState = "past" | "active" | "future";

  function resolveActiveIndex(current: OrderStatus): number {
    // WSTEPNIE_PRZYJETE maps to index 0 (pre-przyjęte); ANULOWANE = -1 (all past/greyed)
    if (current === "ANULOWANE") return -2;
    const idx = STEPS.findIndex((s) => s.status === current);
    return idx === -1 ? 0 : idx; // WSTEPNIE_PRZYJETE falls through to 0
  }

  export function OrderDrawerStatusTimeline({ currentStatus }: Props) {
    log.debug("op=OrderDrawerStatusTimeline.render", { currentStatus });
    const activeIdx = resolveActiveIndex(currentStatus);
    const cancelled = activeIdx === -2;

    function stepState(i: number): StepState {
      if (cancelled) return "future"; // re-use future styling; caller wraps in opacity-40
      if (i < activeIdx) return "past";
      if (i === activeIdx) return "active";
      return "future";
    }

    return (
      <div
        className={`flex justify-between items-center px-5 py-4 border-b border-admin-line${cancelled ? " opacity-40" : ""}`}
        aria-label="Postęp zlecenia"
      >
        {STEPS.map((step, i) => {
          const state = stepState(i);
          const circleBg =
            state === "active" ? "var(--ink)" :
            state === "past"   ? "var(--paper)" :
                                 "#fff";
          const circleBorder = "2px solid var(--ink)";
          const circleColor =
            state === "active" ? "var(--paper)" :
            state === "past"   ? "var(--ink)" :
                                 "rgba(0,0,0,0.4)";
          const circleBorderRadius = state === "active" ? 0 : "50%";
          const labelWeight = state !== "future" ? 700 : 400;
          const labelColor = state !== "future" ? "var(--ink)" : "rgba(0,0,0,0.5)";

          return (
            <div key={step.status} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? "none" : undefined }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div
                  data-step-state={state}
                  style={{
                    width: 26, height: 26,
                    background: circleBg,
                    border: circleBorder,
                    borderRadius: circleBorderRadius,
                    color: circleColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)",
                  }}
                >
                  {i + 1}
                </div>
                <span
                  className="t-mono"
                  style={{
                    fontSize: 9, fontWeight: labelWeight, color: labelColor,
                    letterSpacing: ".05em", textTransform: "uppercase",
                  }}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: state === "past" ? "var(--ink)" : "rgba(0,0,0,0.08)",
                    margin: "0 4px",
                    alignSelf: "flex-start",
                    marginTop: 13, // vertically centre on circle
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  ```

  > LOC check: ~70 lines. Within 80 LOC budget.

- [ ] **Step 3: Integrate into `OrderDrawer.tsx`**

  Import `OrderDrawerStatusTimeline` and add it as first child inside `<div className="flex-1 overflow-y-auto">`:

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx
  // Add import:
  import { OrderDrawerStatusTimeline } from "./OrderDrawerStatusTimeline";

  // In the scroll container div, add before <OrderDrawerCoreFields ...>:
  <OrderDrawerStatusTimeline currentStatus={order.status} />
  ```

- [ ] **Step 4: REFACTOR — validate LOC and naming**

  Confirm `OrderDrawerStatusTimeline.tsx` is ≤ 80 LOC. If the connecting-line logic bloats it, extract `function StepConnector({ isPast }: { isPast: boolean })` into the same file (no module split needed at this size).

- [ ] **Commit**

  ```
  feat(orders): add OrderDrawerStatusTimeline 5-step progress tracker [milestone:9][task:9-24]
  Refs: docs/dispatch-log/9-24-<UTC>.md
  ```

---

### Task 9-25: `<OrderDrawerNotes>` NEW sticky-notes panel

**Review:** combined single-stage

**Context:**
- Design reference: `handoff/design/admin.jsx` lines 427–440 (notes block inside drawer).
- Data source: the existing `getOrderTimeline(orderId)` API at `GET /admin/orders/{orderId}/timeline` returns `TimelineEvent[]` (defined in `apps/web/lib/timeline/types.ts`). Each event may carry a `note?: string | null` field. Notes entered during `STATUS_CHANGED` transitions are already stored in `audit_log.note` (V015) and surfaced in the timeline response. Client-side filtering: `events.filter(ev => ev.note)`.
- No backend change required — the timeline endpoint already returns notes inline.
- Sticky-pad visual: `bg-[#fef4a8] border-[1.5px] border-ink` with alternating rotation `rotate-[-0.3deg]` / `rotate-[0.4deg]` based on `index % 2`.
- Author display: `ev.actorFullName ?? "operator"`.
- Timestamp display: short `dd.MM HH:mm` in `pl-PL` locale using `Intl.DateTimeFormat`.
- Integration point: `OrderDrawer.tsx` — render `<OrderDrawerNotes orderId={order.id} refreshKey={refreshKey} />` after the `OrderDrawerPhotos` section.

**Files:**
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNotes.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerNotes.test.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`

**Acceptance:**
1. Fetches timeline via `getOrderTimeline(orderId)` and filters to `events.filter(ev => ev.note)`.
2. Renders header `t-stencil 14` "Notatki wewnętrzne".
3. Each note: yellow `bg-[#fef4a8] border-[1.5px] border-ink p-3` card, `transform: rotate(${i%2===0 ? -0.3 : 0.4}deg)`, t-mono 10px author + timestamp at top, 13px body text.
4. Empty state: `t-mono opacity-55` "Brak notatek wewnętrznych".
5. Re-fetches when `refreshKey` changes.
6. Vitest: renders 2 mocked notes with correct alternating `transform` style; renders empty state when no notes.
7. `pnpm vitest run` — green.

- [ ] **Step 1: RED — write `OrderDrawerNotes.test.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerNotes.test.tsx
  import React from "react";
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { render, screen, waitFor } from "@testing-library/react";
  import { OrderDrawerNotes } from "../OrderDrawerNotes";

  vi.mock("@/lib/timeline/api", () => ({
    getOrderTimeline: vi.fn(),
  }));

  import { getOrderTimeline } from "@/lib/timeline/api";
  const mockGetTimeline = vi.mocked(getOrderTimeline);

  const NOTE_EVENTS = [
    {
      id: "e1", kind: "STATUS_CHANGED", occurredAt: "2026-05-02T14:32:00Z",
      actorFullName: "Tomek", labels: {}, note: "Klientka prosiła o oryginalny szew żółty",
    },
    {
      id: "e2", kind: "STATUS_CHANGED", occurredAt: "2026-05-03T09:10:00Z",
      actorFullName: "Daniel", labels: {}, note: "Powiedziałem że odbiór możliwy 8.05",
    },
  ] as const;

  describe("OrderDrawerNotes", () => {
    beforeEach(() => { mockGetTimeline.mockReset(); });

    it("renders sticky notes from timeline events with notes", async () => {
      mockGetTimeline.mockResolvedValue([...NOTE_EVENTS]);
      render(<OrderDrawerNotes orderId="order-1" refreshKey={0} />);
      await waitFor(() => expect(screen.getByText(/oryginalny szew/i)).toBeInTheDocument());
      expect(screen.getByText(/Powiedziałem/i)).toBeInTheDocument();
    });

    it("first note has rotate(-0.3deg), second note has rotate(0.4deg)", async () => {
      mockGetTimeline.mockResolvedValue([...NOTE_EVENTS]);
      const { container } = render(<OrderDrawerNotes orderId="order-1" refreshKey={0} />);
      await waitFor(() => expect(screen.getByText(/oryginalny szew/i)).toBeInTheDocument());
      const cards = container.querySelectorAll("[data-note-card]");
      expect(cards[0].getAttribute("style")).toMatch(/-0\.3/);
      expect(cards[1].getAttribute("style")).toMatch(/0\.4/);
    });

    it("renders empty state when no notes exist", async () => {
      mockGetTimeline.mockResolvedValue([]);
      render(<OrderDrawerNotes orderId="order-1" refreshKey={0} />);
      await waitFor(() =>
        expect(screen.getByText(/brak notatek/i)).toBeInTheDocument(),
      );
    });

    it("filters out timeline events without a note", async () => {
      mockGetTimeline.mockResolvedValue([
        { id: "e0", kind: "ORDER_CREATED", occurredAt: "2026-05-01T10:00:00Z",
          actorFullName: null, labels: {}, note: null },
        ...NOTE_EVENTS,
      ]);
      const { container } = render(<OrderDrawerNotes orderId="order-1" refreshKey={0} />);
      await waitFor(() => expect(container.querySelectorAll("[data-note-card]").length).toBe(2));
    });
  });
  ```

- [ ] **Step 2: GREEN — create `OrderDrawerNotes.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrderDrawerNotes.tsx
  "use client";

  import { useEffect, useState, useCallback } from "react";
  import { createLogger } from "@/lib/log";
  import { getOrderTimeline } from "@/lib/timeline/api";
  import type { TimelineEvent } from "@/lib/timeline/types";

  const log = createLogger("order-drawer-notes");

  const fmt = new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });

  interface Props {
    orderId: string;
    refreshKey: number;
  }

  export function OrderDrawerNotes({ orderId, refreshKey }: Props) {
    log.debug("op=OrderDrawerNotes.render", { orderId, refreshKey });
    const [notes, setNotes] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
      setLoading(true);
      try {
        const events = await getOrderTimeline(orderId);
        const withNote = events.filter((ev) => ev.note);
        log.info("op=loadNotes outcome=ok", { orderId, count: withNote.length });
        setNotes(withNote);
      } catch (err) {
        log.warn("op=loadNotes outcome=error", { orderId, err });
      } finally {
        setLoading(false);
      }
    }, [orderId]);

    useEffect(() => { void load(); }, [load, refreshKey]);

    return (
      <div className="px-5 py-4 border-t border-admin-line">
        <div className="t-stencil" style={{ fontSize: 14, letterSpacing: ".1em", marginBottom: 10 }}>
          Notatki wewnętrzne
        </div>

        {loading && (
          <p className="t-mono text-xs opacity-55">Ładowanie…</p>
        )}

        {!loading && notes.length === 0 && (
          <p className="t-mono text-xs opacity-55">Brak notatek wewnętrznych</p>
        )}

        {!loading && notes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map((ev, i) => (
              <div
                key={ev.id ?? `note-${i}`}
                data-note-card
                style={{
                  background: "#fef4a8",
                  padding: 12,
                  border: "1.5px solid var(--ink)",
                  transform: `rotate(${i % 2 === 0 ? -0.3 : 0.4}deg)`,
                }}
              >
                <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>
                  {ev.actorFullName ?? "operator"} · {fmt.format(new Date(ev.occurredAt))}
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{ev.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  ```

  > LOC check: ~60 lines. Within budget.

- [ ] **Step 3: Integrate into `OrderDrawer.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx
  // Add import:
  import { OrderDrawerNotes } from "./OrderDrawerNotes";

  // In the scroll container, after the photos section:
  <OrderDrawerNotes orderId={order.id} refreshKey={refreshKey} />
  ```

- [ ] **Commit**

  ```
  feat(orders): add OrderDrawerNotes sticky-note panel from audit timeline [milestone:9][task:9-25]
  Refs: docs/dispatch-log/9-25-<UTC>.md
  ```

---

### Task 9-26: OrderDrawer photo grid + items + tags reskin

**Review:** combined single-stage

**Context:**
- Design reference: `handoff/design/admin.jsx` lines 377–425 (items + photo gallery blocks inside OrderDrawer).
- `PhotoGrid.tsx` currently uses `grid-cols-[repeat(auto-fill,minmax(180px,1fr))]` — change to `grid-cols-6 gap-1.5`. Each photo wrapped in a relative container with a status label overlay positioned `absolute bottom-1.5 left-1.5`. Label colour: before=`var(--blue)`, trakcie=`var(--orange)`, after=`var(--green)`. A dashed "+" upload tile as the last cell.
- `OrderDrawerItems.tsx` currently uses `<div className="px-6 py-4 border-t border-admin-line space-y-3">` — each item should be wrapped in `<AdminCard padding={14}>` with a `t-stencil 14` header "Item · {index+1}/{total}" and a `btn-clean` "+ dodaj item" button top-right. The existing `ItemEditRow` / `OrderItemRow` subcomponents are preserved inside.
- Tags row: new `<OrderDrawerTagsRow tags={order.tags} />` component (tiny, < 30 LOC) to render before the items. Tags as `<Chip color={tag === 'pilne' ? 'pink' : 'default'}>` plus a disabled dashed `<Chip title="wkrótce">+ dodaj</Chip>`.
- `OrderDrawerCoreFields.tsx` is **not** changed in this task — core fields layout is preserved as-is.

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/_components/PhotoGrid.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerItems.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerTagsRow.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`

**Acceptance:**
1. `PhotoGrid` renders `grid grid-cols-6 gap-1.5`. Each photo is in a `relative` container; `<PhotoCard>` renders as before but without its own outer grid. After all photo cards, a dashed upload tile: `<div style={{ aspectRatio: 1, border: "1.5px dashed var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.4)", fontSize: 22 }}>+</div>`.
2. Each `PhotoCard` renders its label overlay `<span style={{ position: "absolute", left: 3, bottom: 3, ... }}>` with colour from label: `before`→blue, `trakcie`→orange, `after`→green. (The label badge already exists in `PhotoCard.tsx` — verify it and adjust if it's currently positioned differently.)
3. `OrderDrawerItems` wraps the entire section in `<AdminCard padding={14}>` instead of a plain div. Header row `flex justify-between items-center mb-2.5`: `<div className="t-stencil" style={{ fontSize: 14, letterSpacing: ".1em" }}>Item · {items.length === 0 ? "0/0" : "1/" + items.length}</div>` + `<button className="btn-clean" style={{ fontSize: 11, padding: "4px 10px" }} onClick={openAdd}>{I.plus} dodaj item</button>`.
4. `OrderDrawerTagsRow` renders: `t-mono 11 opacity-55 uppercase "tagi:"` label + tag chips + dashed disabled "+ dodaj" chip.
5. In `OrderDrawer.tsx`, `<OrderDrawerTagsRow tags={order.tags} />` is rendered between `<OrderDrawerStatusTimeline>` and `<OrderDrawerItems>`.
6. Existing photo upload, relabel, delete functionality unaffected.
7. Vitest snapshot for `OrderDrawerTagsRow` with `tags={["pilne", "stały klient"]}` — pink chip for "pilne", default chip for "stały klient", disabled dashed "+ dodaj".
8. `pnpm vitest run` — green.

- [ ] **Step 1: RED — write test for `OrderDrawerTagsRow`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerTagsRow.test.tsx
  import React from "react";
  import { describe, it, expect } from "vitest";
  import { render, screen } from "@testing-library/react";
  import { OrderDrawerTagsRow } from "../OrderDrawerTagsRow";

  describe("OrderDrawerTagsRow", () => {
    it("renders a pink chip for 'pilne' tag", () => {
      render(<OrderDrawerTagsRow tags={["pilne"]} />);
      const chip = screen.getByText("pilne").closest("[data-color]");
      expect(chip?.getAttribute("data-color")).toBe("pink");
    });

    it("renders default chip for non-pilne tag", () => {
      render(<OrderDrawerTagsRow tags={["stały klient"]} />);
      const chip = screen.getByText("stały klient").closest("[data-color]");
      expect(chip?.getAttribute("data-color") ?? "default").toBe("default");
    });

    it("renders disabled dashed '+ dodaj' chip", () => {
      render(<OrderDrawerTagsRow tags={[]} />);
      const add = screen.getByText(/\+ dodaj/i).closest("button");
      expect(add).toBeDisabled();
    });

    it("renders empty state without crashing when tags is null", () => {
      render(<OrderDrawerTagsRow tags={null} />);
      expect(screen.getByText(/\+ dodaj/i)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Create `OrderDrawerTagsRow.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrderDrawerTagsRow.tsx
  "use client";

  import { createLogger } from "@/lib/log";
  import { Chip } from "@repo/ui";

  const log = createLogger("order-drawer-tags");

  interface Props { tags: string[] | null | undefined; }

  export function OrderDrawerTagsRow({ tags }: Props) {
    log.debug("op=OrderDrawerTagsRow.render", { count: tags?.length ?? 0 });
    return (
      <div className="flex flex-wrap gap-2 items-center px-5 py-3 border-b border-admin-line">
        <span className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: ".1em", textTransform: "uppercase" }}>
          tagi:
        </span>
        {(tags ?? []).map((tag) => (
          <Chip key={tag} color={tag === "pilne" ? "pink" : "default"}>
            {tag}
          </Chip>
        ))}
        <Chip
          disabled
          title="Dodawanie tagów wkrótce"
          style={{ borderStyle: "dashed", background: "transparent" }}
        >
          + dodaj
        </Chip>
      </div>
    );
  }
  ```

- [ ] **Step 3: Update `PhotoGrid.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/PhotoGrid.tsx
  // Replace the grid className and add upload tile:

  export function PhotoGrid({ photos, onCardClick, onRelabel, onDelete }: Props) {
    return (
      <div className="grid grid-cols-6 gap-1.5">
        {photos.map((p) => (
          <div key={p.id} className="relative">
            <PhotoCard
              photo={p}
              onClick={() => onCardClick(p)}
              onRelabel={(label) => onRelabel(p, label)}
              onDelete={() => onDelete(p)}
            />
          </div>
        ))}
        {/* Dashed upload tile */}
        <div
          style={{
            aspectRatio: "1",
            border: "1.5px dashed var(--ink)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(0,0,0,0.4)", fontSize: 22, cursor: "pointer",
          }}
          aria-label="Dodaj zdjęcie"
        >
          +
        </div>
      </div>
    );
  }
  ```

  Also check `PhotoCard.tsx` — the label badge (`p.label`: `before`|`trakcie`|`after`) should render with `position: absolute; bottom: 3; left: 3`. If currently not absolute, adjust.

- [ ] **Step 4: Update `OrderDrawerItems.tsx`**

  Wrap outer div with `<AdminCard padding={14}>`. Add header row.

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrderDrawerItems.tsx
  // Import AdminCard, I from @repo/ui
  import { AdminCard } from "@repo/ui";
  import { I } from "@repo/ui";

  // Change the outer return from:
  //   <div className="px-6 py-4 border-t border-admin-line space-y-3">
  //     <p ...>Pozycje</p>
  // To:
  //   <div className="px-5 py-4 border-t border-admin-line">
  //     <AdminCard padding={14}>
  //       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
  //         <div className="t-stencil" style={{ fontSize: 14, letterSpacing: ".1em" }}>
  //           Item · {order.items.length === 0 ? "0/0" : `1/${order.items.length}`}
  //         </div>
  //         <button className="btn-clean" style={{ fontSize: 11, padding: "4px 10px" }}
  //           onClick={() => { setAddOpen(true); setAddState(BLANK); setConflict(false); }}>
  //           {I.plus} dodaj item
  //         </button>
  //       </div>
  //       {/* existing items list ... */}
  //     </AdminCard>
  //   </div>

  // Remove the standalone "+ Dodaj pozycję" button at bottom (it's now the header button).
  ```

- [ ] **Step 5: Update `OrderDrawer.tsx`**

  Add imports and render `<OrderDrawerTagsRow>` between the status timeline and items:

  ```tsx
  import { OrderDrawerTagsRow } from "./OrderDrawerTagsRow";
  // In scroll container, after <OrderDrawerStatusTimeline ...>:
  <OrderDrawerTagsRow tags={order.tags} />
  ```

- [ ] **Commit**

  ```
  feat(orders): reskin photo grid 6-col + items AdminCard + tags row [milestone:9][task:9-26]
  Refs: docs/dispatch-log/9-26-<UTC>.md
  ```

---

### Task 9-27: OrderDrawer footer actions + header reskin

**Review:** combined single-stage

**Context:**
- Design reference: `handoff/design/admin.jsx` lines 336–474 (entire `OrderDrawer` function — header lines 346–354, footer lines 464–472, aside `style` lines 338–343).
- Current `OrderDrawerHeader.tsx` uses Radix `<Dialog.Title>` with a plain font-mono code + status span + close `×` text button.
- Target header: `flex items-center gap-3 px-5 py-4 border-b-[2px] border-ink bg-white`. Left: `btn-clean p-1.5` close with `<I.close />` icon. Middle flex-1: `t-display` fontSize 26 DR-ID + `t-mono` 11px sub (client name · received date). Right: `<Pill status>` + `btn-clean` more with `<I.more />`.
- Current footer: no footer section in `OrderDrawer.tsx` (status changer is inline). Target: `flex flex-wrap gap-2 p-3.5 border-t-[2px] border-ink bg-white` with five `btn-clean` buttons.
- Current `Dialog.Content` className uses Tailwind animate-in/out classes. Target: replace with the `drawerIn` CSS animation from `globals.css` (`@keyframes drawerIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`). The aside `style` is `position: absolute right-0 top-0 bottom-0 width 540px border-left 3px solid ink shadow-[-12px_0_30px_rgba(0,0,0,0.18)]`.
- `order.clientName` is available on `OrderDto` (added in M6 era). Confirm field exists before referencing.
- The "zmień status" footer button should call the existing `OrderDrawerStatusChanger` flow — wire it by extracting a `openStatusChanger` callback or by keeping `OrderDrawerStatusChanger` rendered (but hidden by default) and triggering it. Simplest: keep `OrderDrawerStatusChanger` in the scroll body (as is), and make the footer "zmień status" button scroll to it + focus it. Alternatively, just render the button as a `<label htmlFor="status-changer-trigger">` — leave exact wiring as implementation decision for the subagent (comment the intent clearly).
- "oznacz jako wydane" footer button calls `openConfirm("WYDANE")` on `OrderDrawerStatusChanger`. Since `StatusChanger` owns that state, wire via a ref or a shared state prop. Simplest: keep existing `StatusChanger` visible in the body for the status segmented control; the footer buttons are additional convenience shortcuts that also call `openConfirm`.

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawerHeader.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx`

**Acceptance:**
1. Drawer `<aside>` is `position: absolute; right: 0; top: 0; bottom: 0; width: 540px; background: var(--paper); border-left: 3px solid var(--ink); box-shadow: -12px 0 30px rgba(0,0,0,0.18); animation: drawerIn 0.25s ease`.
2. `OrderDrawerHeader` renders: `<I.close />` close btn-clean | flex-1 block with `t-display 26` code + `t-mono 11 opacity-55` client sub | `<Pill status>` | `<I.more />` more btn-clean.
3. Footer `div` (outside scroll container, after it): `flex flex-wrap gap-2 p-3.5 border-t-[2px] border-ink bg-white`. Contains buttons: "zmień status" (`btn-clean primary`) / "oznacz jako wydane" (`btn-clean acid`) / `{I.send} wiadomość` (`btn-clean`) / "paragon" (`btn-clean`) / `flex-1` spacer / "anuluj" (`btn-clean` with `color: var(--red); borderColor: var(--red)`).
4. Existing `Dialog.Root` / `Dialog.Portal` / `Dialog.Overlay` wiring preserved; `Dialog.Content` loses the Tailwind animate-in/out classes and gains inline style for the aside positioning + animation.
5. Vitest snapshot in `OrderDrawer.test.tsx` (if it exists) updated to match new structure. If no test exists, create a minimal smoke test verifying the drawer renders with the new header structure.
6. `pnpm vitest run` — green.

- [ ] **Step 1: RED — write/update `OrderDrawer.test.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawer.test.tsx
  import React from "react";
  import { describe, it, expect, vi } from "vitest";
  import { render, screen } from "@testing-library/react";
  import { OrderDrawer } from "../OrderDrawer";
  import type { OrderDto } from "@/lib/orders/types";

  // Mock all heavy child components
  vi.mock("../OrderDrawerStatusTimeline", () => ({
    OrderDrawerStatusTimeline: () => <div data-testid="status-timeline" />,
  }));
  vi.mock("../OrderDrawerTagsRow", () => ({
    OrderDrawerTagsRow: () => <div data-testid="tags-row" />,
  }));
  vi.mock("../OrderDrawerCoreFields", () => ({
    OrderDrawerCoreFields: () => <div data-testid="core-fields" />,
  }));
  vi.mock("../OrderDrawerStatusChanger", () => ({
    OrderDrawerStatusChanger: () => <div data-testid="status-changer" />,
  }));
  vi.mock("../OrderDrawerItems", () => ({
    OrderDrawerItems: () => <div data-testid="items" />,
  }));
  vi.mock("../OrderDrawerTimeline", () => ({
    OrderDrawerTimeline: () => <div data-testid="timeline" />,
  }));
  vi.mock("../OrderDrawerNotes", () => ({
    OrderDrawerNotes: () => <div data-testid="notes" />,
  }));
  vi.mock("../OrderDrawerPhotos", () => ({
    OrderDrawerPhotos: () => <div data-testid="photos" />,
  }));
  vi.mock("../OrderDrawerMessages", () => ({
    OrderDrawerMessages: () => <div data-testid="messages" />,
  }));
  vi.mock("../MessageComposerModal", () => ({
    MessageComposerModal: () => null,
  }));
  vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
  }));

  const MOCK_ORDER: OrderDto = {
    id: "order-1", code: "DR-1042", clientId: "c1", clientName: "Magdalena Kowalska",
    status: "W_REALIZACJI", source: "ADMIN", receivedAt: "2026-05-02T12:00:00Z",
    plannedPickupAt: null, pickedUpAt: null, assignedCraftsmanId: null,
    currentStorageLocationId: null, tags: ["pilne"], totalPriceCents: 34000,
    currency: "PLN", description: "DM 1460 Vibram", cancelledReason: null,
    version: 1, createdAt: "2026-05-02T10:00:00Z", updatedAt: "2026-05-02T12:00:00Z",
    items: [], quotedPriceCents: 34000, advancePaidCents: 0,
  };

  describe("OrderDrawer", () => {
    it("renders DR-code in t-display header", () => {
      render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
      expect(screen.getByText("DR-1042")).toBeInTheDocument();
    });

    it("renders client name sub in header", () => {
      render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
      expect(screen.getByText(/Magdalena Kowalska/i)).toBeInTheDocument();
    });

    it("renders footer with zmień status button", () => {
      render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
      expect(screen.getByRole("button", { name: /zmień status/i })).toBeInTheDocument();
    });

    it("renders footer anuluj button with red styling", () => {
      render(<OrderDrawer initialOrder={MOCK_ORDER} users={[]} />);
      const btn = screen.getByRole("button", { name: /anuluj/i });
      expect(btn).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Reskin `OrderDrawerHeader.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrderDrawerHeader.tsx
  "use client";

  import * as Dialog from "@radix-ui/react-dialog";
  import { Pill } from "@repo/ui";
  import { I } from "@repo/ui";
  import { createLogger } from "@/lib/log";
  import type { OrderStatus } from "@/lib/orders/types";

  const log = createLogger("order-drawer-header");

  interface Props {
    code: string;
    status: OrderStatus;
    clientName?: string | null;
    receivedAt?: string | null;
  }

  const TZ = "Europe/Warsaw";
  function fmtShortDate(iso: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("pl-PL", {
      day: "2-digit", month: "2-digit", year: "2-digit", timeZone: TZ,
    });
  }

  export function OrderDrawerHeader({ code, status, clientName, receivedAt }: Props) {
    log.debug("op=OrderDrawerHeader.render", { code, status });
    const sub = [clientName, receivedAt ? `przyjęte ${fmtShortDate(receivedAt)}` : null]
      .filter(Boolean).join(" · ");

    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 20px", borderBottom: "2px solid var(--ink)",
        background: "#fff",
      }}>
        <Dialog.Close asChild>
          <button className="btn-clean" style={{ padding: 6 }} aria-label="Zamknij">
            <I.close />
          </button>
        </Dialog.Close>

        <div style={{ flex: 1 }}>
          <Dialog.Title className="t-display" style={{ fontSize: 26, lineHeight: 1 }}>
            {code}
          </Dialog.Title>
          {sub && (
            <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", marginTop: 2 }}>
              {sub}
            </div>
          )}
        </div>

        <Pill status={status} />

        <button className="btn-clean" aria-label="Więcej opcji">
          <I.more />
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 3: Update `OrderDrawer.tsx` — aside style + footer**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/OrderDrawer.tsx
  // Key changes:

  // 1. Update OrderDrawerHeader call to pass clientName + receivedAt:
  <OrderDrawerHeader
    code={order.code}
    status={order.status}
    clientName={order.clientName}
    receivedAt={order.receivedAt}
  />

  // 2. Replace Dialog.Content className with style-based aside positioning:
  <Dialog.Content
    aria-describedby={undefined}
    style={{
      position: "fixed",
      insetInlineEnd: 0,
      top: 0,
      bottom: 0,
      width: 540,
      background: "var(--paper)",
      borderLeft: "3px solid var(--ink)",
      boxShadow: "-12px 0 30px rgba(0,0,0,0.18)",
      display: "flex",
      flexDirection: "column",
      animation: "drawerIn 0.25s ease",
      zIndex: 50,
    }}
  >
    {/* Inject keyframe (globals.css already has @keyframes drawerIn — no inline style needed
        as long as globals.css is loaded. If globals.css is not yet updated by 9-1, add inline.) */}

  // 3. Add footer section after the scroll container div, before </Dialog.Content>:
  <div style={{
    padding: 14, borderTop: "2px solid var(--ink)",
    background: "#fff", display: "flex", gap: 8, flexWrap: "wrap",
  }}>
    <button className="btn-clean primary" onClick={() => { /* scroll to status changer */ }}>
      zmień status
    </button>
    <button className="btn-clean acid" onClick={() => { /* trigger WYDANE confirm */ }}>
      oznacz jako wydane
    </button>
    <button className="btn-clean" onClick={() => setComposeOpen(true)}>
      <I.send /> wiadomość
    </button>
    <button className="btn-clean">paragon</button>
    <div style={{ flex: 1 }} />
    <button
      className="btn-clean"
      style={{ color: "var(--red)", borderColor: "var(--red)" }}
      aria-label="Anuluj zlecenie"
    >
      anuluj
    </button>
  </div>
  ```

- [ ] **Step 4: REFACTOR — verify `OrderDrawerHeader.tsx` ≤ 80 LOC**

  If `fmtShortDate` pushes the file over budget, extract a `formatShortDate` utility to `@/lib/dates.ts` (if it doesn't exist) and import it.

- [ ] **Commit**

  ```
  feat(orders): reskin OrderDrawer header + aside style + footer actions [milestone:9][task:9-27]
  Refs: docs/dispatch-log/9-27-<UTC>.md
  ```

---

## Wave 5 — Calendar + Kanban

### Task 9-28: Calendar reskin + `<UnscheduledOrdersPanel>` NEW

**Review:** combined single-stage

**Context:**
- Design reference: `handoff/design/admin.jsx` lines 481–617 (CalendarView function).
- Current `calendar/page.tsx` already has a 2-column grid (`grid-cols-[1fr_280px]`) with `<BezTerminuPanel>` on the right — the structure matches the design target. What needs reskin:
  1. Month/Tydzień/Dzień toggle: the existing `inline-flex border-[1.5px] border-ink bg-white` segmented button already matches design; add `bg-acid text-ink` for active (already done in the current code — verify).
  2. `CalendarMonthGrid` header row: already uses `t-stencil font-stencil tracking-widest text-ink` and `bg-paper-2` — verify these match. The day grid `grid-cols-7 grid-rows-[repeat(6,...)]` is correct.
  3. `CalendarCell`: today cell already uses `bg-acid/20` with a `t-stencil` "dziś" badge. The event chips already use `borderLeft: 2px solid var(--ink)` and status-coloured bg — verify the colour values match `orderStatusColor` from the new tokens. If `colorOfStatus` in `calendar/utils.ts` uses old hex values, update to match `orderStatusColor` map from `packages/ui/src/tokens.ts`.
  4. `BezTerminuPanel` already renders most of the design: `t-display 18 "Bez terminu"`, count chip, drag hint, drag cards. The reskin target: replace the `<span className="chip ...">` with `<Chip>`, ensure the admin-card wrapper matches `<AdminCard padding={16}>`, and ensure drag cards show `<I.drag />` icon from the new icon set.
- `usePageHeader` integration: `calendar/page.tsx` is a Server Component — same pattern as `orders/page.tsx`: create a thin `"use client"` `CalendarPageHeader.tsx` component.

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/calendar/page.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarCell.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/calendar/CalendarMonthGrid.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/calendar/BezTerminuPanel.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/calendar/utils.ts`
- Create: `apps/web/app/(admin)/admin/orders/calendar/_components/CalendarPageHeader.tsx`
- Create: `apps/web/app/(admin)/admin/orders/calendar/__tests__/CalendarCell.test.tsx` (or update existing)

**Acceptance:**
1. Month grid cell: today cell has `bg-acid/20` bg + `<Tape angle={2}>dziś</Tape>` overlay (using `<Tape>` from Wave 1 primitives); day number is `t-mono fontWeight: 700` for today.
2. Event chips in cells: use `orderStatusColor` values from tokens. `WYDANE` chip text is `rgba(0,0,0,0.6)` (ink); all others use `var(--paper)`.
3. `BezTerminuPanel`: count chip uses `<Chip>`, drag cards use `<I.drag />` icon from `@repo/ui`, panel wrapped in `<AdminCard padding={16}>`.
4. `page.tsx` calls `usePageHeader({ title: 'Kalendarz', subtitle: 'planowane odbiory' })` via `<CalendarPageHeader />`.
5. Month/Tydzień/Dzień toggle active tab: `bg-acid text-ink` (acid background). Inactive tabs: `bg-transparent text-ink hover:bg-ink/5`. Border between tabs: `border-right: 1px solid var(--line)`.
6. Drag-drop interaction in `BezTerminuPanel` is **deferred** — each drag card's `onDragStart` stub: `() => console.warn('drag-drop wkrótce')`. Comment in code: `// TODO M10: wire drag-drop to calendar day`.
7. Vitest: `CalendarCell` test verifies today cell has `bg-acid/20` class and event chips render with correct status colour attributes.
8. `pnpm vitest run` — green.

- [ ] **Step 1: RED — update `CalendarCell.test.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/calendar/__tests__/CalendarCell.test.tsx
  // (Create or augment existing tests — the existing page.test.tsx mocks child components,
  // so CalendarCell needs its own isolated test file)
  import React from "react";
  import { describe, it, expect, vi } from "vitest";
  import { render, screen } from "@testing-library/react";
  import { CalendarCell } from "../../_components/calendar/CalendarCell";

  vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
  }));

  const ORDERS = [
    { id: "o1", code: "DR-001", clientName: "Jan K.", status: "PRZYJETE", plannedPickupAt: "2026-05-07T10:00:00Z", itemSummary: "test" },
    { id: "o2", code: "DR-002", clientName: "Zofia M.", status: "WYDANE", plannedPickupAt: "2026-05-07T10:00:00Z", itemSummary: "test" },
  ];

  describe("CalendarCell", () => {
    it("today cell has bg-acid/20 class", () => {
      const { container } = render(
        <CalendarCell day={7} isToday={true} orders={[]} />,
      );
      const cell = container.firstChild as HTMLElement;
      expect(cell.className).toMatch(/acid/);
    });

    it("renders status-coloured event chip for PRZYJETE order", () => {
      const { container } = render(
        <CalendarCell day={7} isToday={false} orders={[ORDERS[0]]} />,
      );
      const chip = container.querySelector("button");
      // blue background (PRZYJETE maps to var(--blue) = #2b5cff or similar)
      expect(chip?.getAttribute("style") ?? "").toMatch(/blue|2b5cff/i);
    });

    it("WYDANE chip text color is rgba(0,0,0,0.6)", () => {
      const { container } = render(
        <CalendarCell day={7} isToday={false} orders={[ORDERS[1]]} />,
      );
      const chip = container.querySelector("button");
      expect(chip?.getAttribute("style") ?? "").toMatch(/rgba\(0,0,0,0\.6\)/);
    });

    it("shows '+N więcej' for more than 3 orders", () => {
      const many = Array.from({ length: 5 }, (_, i) => ({
        ...ORDERS[0], id: `o${i}`, code: `DR-00${i}`,
      }));
      render(<CalendarCell day={7} isToday={false} orders={many} />);
      expect(screen.getByText(/\+ 2 więcej/)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Update `calendar/utils.ts` with new token colours**

  ```ts
  // apps/web/app/(admin)/admin/orders/_components/calendar/utils.ts
  import type { OrderStatus } from "@/lib/orders/types";

  /** Maps order status to its display colour per the design token set (M9 tokens). */
  export function colorOfStatus(status: OrderStatus | string): string {
    switch (status) {
      case "PRZYJETE":          return "var(--blue)";
      case "W_REALIZACJI":      return "var(--orange)";
      case "CZEKA_NA_KLIENTA":  return "#a17a00";
      case "GOTOWE_DO_ODBIORU": return "var(--green)";
      case "WYDANE":            return "rgba(0,0,0,0.35)";
      case "WSTEPNIE_PRZYJETE": return "var(--admin-mute)";
      case "ANULOWANE":         return "var(--red)";
      default:                  return "var(--admin-mute)";
    }
  }
  ```

- [ ] **Step 3: Update `CalendarCell.tsx` — today uses `<Tape>` + acid bg**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/calendar/CalendarCell.tsx
  // Add import:
  import { Tape } from "@repo/ui";

  // In cell div: change today badge from the existing <span className="font-stencil ..."> to:
  {isToday && <Tape angle={2} style={{ fontSize: 9, padding: "1px 8px" }}>dziś</Tape>}

  // Event chips: ensure color mapping uses colorOfStatus (already does) and
  // WYDANE text color is "rgba(0,0,0,0.6)" (already set in existing code — verify).
  ```

- [ ] **Step 4: Update `BezTerminuPanel.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/calendar/BezTerminuPanel.tsx
  // Key changes:
  // 1. Wrap outer div in <AdminCard padding={16}> (import from @repo/ui)
  // 2. Replace <span className="chip ..."> count chip with <Chip> from @repo/ui
  // 3. Replace drag icon ⠿ with <I.drag /> from @repo/ui
  // 4. Add onDragStart stub to each drag card:
  //    draggable onDragStart={() => console.warn("drag-drop wkrótce")}
  //    // TODO M10: wire drag-drop to calendar day planning endpoint
  ```

- [ ] **Step 5: Create `CalendarPageHeader.tsx` + integrate in `page.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/calendar/_components/CalendarPageHeader.tsx
  "use client";

  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

  export function CalendarPageHeader() {
    usePageHeader({ title: "Kalendarz", subtitle: "planowane odbiory" });
    return null;
  }
  ```

  In `calendar/page.tsx` RSC, add `<CalendarPageHeader />` as first child of the returned `<div>`.

- [ ] **Commit**

  ```
  feat(calendar): reskin month grid + BezTerminuPanel + Tape today + usePageHeader [milestone:9][task:9-28]
  Refs: docs/dispatch-log/9-28-<UTC>.md
  ```

---

### Task 9-29: Kanban reskin + post-drag status-change popup integration

**Review:** combined single-stage

**Context:**
- Design reference: `handoff/design/admin.jsx` lines 624–725 (KanbanView function).
- Current components:
  - `KanbanColumn.tsx`: header div already uses status colour band + stencil label + count chip in `bg-white/85` pill — matches design. Cards use `admin-card p-2.5`. Body uses `bg-black/[.03] border-2 border-t-0 border-ink`.
  - `KanbanCard.tsx`: already renders DR-ID mono, urgent pink badge, 40×40 photo placeholder, client + desc truncated, dashed-top divider + due date + craftsman "T" avatar. Needs `<PhImg>` for the 40×40 placeholder (replace the plain div), `<I.calendar />` before due date, and craftsman initial from real data (currently hardcoded "T").
  - `KanbanBoard.tsx`: already integrates `StatusChangeTriggerDialog` as a modal. Target: change to a **fixed-position popup** instead of a centred modal — positioned `bottom: 28, right: 28, width: 320` with the design's offset shadow `5px 5px 0 var(--pink), 5px 5px 0 1.5px var(--ink)`.
  - `KanbanBoardWrapper.tsx`: error toast already positioned bottom-right.
- `StatusChangeTriggerDialog` is a Radix `<Dialog.Root>` centred modal. To make it a fixed popup instead, the subagent should NOT use the Radix Portal/Overlay — instead render the popup div directly inside `KanbanBoard.tsx` as a non-modal element, conditional on `pendingMove !== null`. The existing `onConfirm` / `onCancel` / `triggerPreview` logic is reused verbatim.
- "+ dodaj" button at bottom of each column: `btn-clean` with `borderStyle: "dashed" boxShadow: "none" justifyContent: "center"` — already present in the design. Click stubs: `() => console.warn('new-order wkrótce')`. Comment: `// TODO M10: open new-order modal pre-filled with this column's status`.
- `usePageHeader` integration for kanban: same server component + thin client wrapper pattern.
- Craftsman avatar: `KanbanCardDto` currently has no craftsman initial field. Use first letter of `card.clientName` as fallback (it's what the design shows as "T" placeholder). When real craftsman data is added, the avatar will update naturally.

**Files:**
- Modify: `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanCard.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanColumn.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/_components/kanban/KanbanBoard.tsx`
- Create: `apps/web/app/(admin)/admin/orders/kanban/_components/KanbanPageHeader.tsx`
- Modify: `apps/web/app/(admin)/admin/orders/kanban/page.tsx`
- Create: `apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanBoard.test.tsx`

**Acceptance:**
1. `KanbanCard` renders `<PhImg label="" style={{ width: 40, height: 40, border: "1.5px solid var(--ink)", flexShrink: 0 }} />` in place of the plain `bg-paper-2` div placeholder.
2. `KanbanCard` due date row renders `<I.calendar />` icon before the date span.
3. `KanbanColumn` footer: `<button className="btn-clean" style={{ padding: "6px 8px", justifyContent: "center", fontSize: 11, opacity: 0.7, borderStyle: "dashed", boxShadow: "none" }} onClick={() => console.warn("new-order wkrótce")}>` renders at bottom of each column body.
4. Post-drag popup: when `pendingMove !== null`, a non-modal `<div>` appears `position: fixed; bottom: 28; right: 28; width: 320; background: #fff; border: 2px solid var(--ink); box-shadow: 5px 5px 0 var(--pink), 5px 5px 0 1.5px var(--ink); padding: 16`. Contains: `<div className="t-stencil" style={{ fontSize: 12, color: "var(--pink)" }}>Status zmieniony</div>` + `<div style={{ fontWeight: 700, fontSize: 14 }}>{pendingMove.cardCode} → {STATUS_LABELS_PL[pendingMove.toStatus]}</div>` + trigger preview text + 3 buttons (`btn-clean primary` "wyślij" with `<I.send />` / `btn-clean` "podgląd" / flex-1 spacer / `btn-clean p-1.5` close with `<I.close />`).
5. `<StatusChangeTriggerDialog>` (the Radix modal) is **removed** from `KanbanBoard.tsx` in favour of the new inline popup. The existing `onConfirm` / `onCancel` callbacks from `useKanbanDnd` are wired to the popup's buttons.
6. `KanbanBoard.test.tsx`: renders 5 columns, simulates a drag-end, verifies popup appears; click "wyślij" calls `onConfirm(true)`.
7. `page.tsx` calls `usePageHeader({ title: 'Kanban', subtitle: 'przeciągnij kartę by zmienić status', right: <Button variant="primary">+ Nowe zlecenie</Button> })`.
8. `pnpm vitest run` — green.

- [ ] **Step 1: RED — write `KanbanBoard.test.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/kanban/__tests__/KanbanBoard.test.tsx
  import React from "react";
  import { describe, it, expect, vi } from "vitest";
  import { render, screen } from "@testing-library/react";
  import userEvent from "@testing-library/user-event";
  import { KanbanBoard } from "../KanbanBoard";
  import type { KanbanColumnDto } from "@/lib/kanban/types";

  // dnd-kit needs a real DOM — mock DndContext to just render children
  vi.mock("@dnd-kit/core", () => ({
    DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DragOverlay: () => null,
    PointerSensor: class {},
    useSensor: vi.fn(() => ({})),
    useSensors: vi.fn(() => []),
  }));
  vi.mock("@dnd-kit/sortable", () => ({
    SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    verticalListSortingStrategy: {},
    useSortable: () => ({
      attributes: {}, listeners: {}, setNodeRef: vi.fn(),
      transform: null, transition: null, isDragging: false,
    }),
  }));
  vi.mock("@dnd-kit/utilities", () => ({
    CSS: { Transform: { toString: () => "" } },
  }));
  vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/admin/orders/kanban",
  }));

  const COLUMNS: KanbanColumnDto[] = [
    { status: "PRZYJETE",          total: 2, hasMore: false, cards: [
      { id: "c1", code: "DR-001", clientName: "Jan K.", itemSummary: "test", urgent: false, plannedPickupAt: null, receivedAt: null },
    ]},
    { status: "W_REALIZACJI",      total: 0, hasMore: false, cards: [] },
    { status: "CZEKA_NA_KLIENTA",  total: 0, hasMore: false, cards: [] },
    { status: "GOTOWE_DO_ODBIORU", total: 0, hasMore: false, cards: [] },
    { status: "WYDANE",            total: 0, hasMore: false, cards: [] },
  ];

  const PENDING_MOVE = {
    cardId: "c1",
    cardCode: "DR-001",
    clientName: "Jan K.",
    fromStatus: "PRZYJETE" as const,
    toStatus: "W_REALIZACJI" as const,
    triggerPreview: { kind: "none" as const },
  };

  describe("KanbanBoard", () => {
    it("renders 5 column headers", () => {
      render(<KanbanBoard columns={COLUMNS} />);
      // Each column has a status header — verify at least 5 rendered
      expect(screen.getAllByRole("button", { name: /dodaj/i }).length).toBe(5);
    });

    it("shows post-drag popup when pendingMove is provided", () => {
      render(
        <KanbanBoard
          columns={COLUMNS}
          pendingMove={PENDING_MOVE}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.getByText(/Status zmieniony/i)).toBeInTheDocument();
      expect(screen.getByText(/DR-001/)).toBeInTheDocument();
    });

    it("popup does not render when pendingMove is null", () => {
      render(<KanbanBoard columns={COLUMNS} pendingMove={null} />);
      expect(screen.queryByText(/Status zmieniony/i)).not.toBeInTheDocument();
    });

    it("clicking wyślij in popup calls onConfirm(true)", async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(
        <KanbanBoard
          columns={COLUMNS}
          pendingMove={PENDING_MOVE}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /wyślij/i }));
      expect(onConfirm).toHaveBeenCalledWith(true);
    });
  });
  ```

- [ ] **Step 2: Update `KanbanCard.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/kanban/KanbanCard.tsx
  // Key changes:
  // 1. Import PhImg, I from @repo/ui
  import { PhImg, I } from "@repo/ui";

  // 2. Replace the plain placeholder div:
  //   <div className="w-10 h-10 border border-ink/30 flex-shrink-0 bg-paper-2" aria-hidden />
  // With:
  //   <PhImg label="" style={{ width: 40, height: 40, border: "1.5px solid var(--ink)", flexShrink: 0 }} />

  // 3. In the due date row, prefix with <I.calendar />:
  //   <span className="font-mono text-[10px] text-ink/55">
  //     <I.calendar /> {shortDate(card.plannedPickupAt)}
  //   </span>

  // 4. Craftsman initial from clientName first letter (fallback until real craftsman data):
  //   const initial = card.clientName?.[0]?.toUpperCase() ?? "?";
  //   <span style={{ width: 20, height: 20, borderRadius: "50%", ... }}>{initial}</span>
  ```

- [ ] **Step 3: Update `KanbanColumn.tsx` — add "+ dodaj" footer**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/kanban/KanbanColumn.tsx
  // After the SortableContext block and empty-state paragraph, add:
  <button
    className="btn-clean"
    style={{
      padding: "6px 8px", justifyContent: "center", fontSize: 11,
      opacity: 0.7, borderStyle: "dashed", boxShadow: "none", width: "100%",
    }}
    onClick={() => {
      // TODO M10: open new-order modal pre-filled with this column's status
      console.warn("new-order wkrótce", column.status);
    }}
    aria-label={`Dodaj zlecenie do ${column.status}`}
  >
    <I.plus /> dodaj
  </button>
  // Import I from @repo/ui at top
  ```

- [ ] **Step 4: Update `KanbanBoard.tsx` — replace Radix modal with inline popup**

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/kanban/KanbanBoard.tsx
  // Remove: import of StatusChangeTriggerDialog
  // Remove: the <StatusChangeTriggerDialog ...> JSX block
  // Import: I, STATUS_LABELS_PL (or from @/lib/orders/status), TriggerPreview type

  import { I } from "@repo/ui";
  import { STATUS_LABELS_PL } from "@/lib/orders/status";

  // Change Props — onConfirm signature from useKanbanDnd is (sendTriggers: boolean) => Promise<void>:
  interface Props {
    columns: KanbanColumnDto[];
    onDragEnd?: (cardId: string, fromStatus: string, toStatus: string) => void;
    pendingMove?: PendingMove | null;
    onConfirm?: (sendTriggers: boolean) => Promise<void>;
    onCancel?: () => void;
  }

  // In return JSX, AFTER the DndContext closing tag, add the inline popup:
  {pendingMove && onConfirm && onCancel && (
    <div
      role="dialog"
      aria-label="Zmiana statusu"
      style={{
        position: "fixed", bottom: 28, right: 28, width: 320,
        background: "#fff", border: "2px solid var(--ink)",
        boxShadow: "5px 5px 0 var(--pink), 5px 5px 0 1.5px var(--ink)",
        padding: 16, zIndex: 60,
      }}
    >
      <div className="t-stencil" style={{ fontSize: 12, letterSpacing: ".1em", color: "var(--pink)" }}>
        Status zmieniony
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>
        {pendingMove.cardCode} → {STATUS_LABELS_PL[pendingMove.toStatus]}
      </div>
      <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)", marginTop: 6 }}>
        {pendingMove.triggerPreview.kind === "match"
          ? `Trigger „${pendingMove.triggerPreview.templateName}" gotowy do wysyłki.`
          : pendingMove.triggerPreview.kind === "disabled"
          ? `Trigger „${pendingMove.triggerPreview.triggerName}" wyłączony.`
          : "Brak triggera dla tej zmiany statusu."}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          className="btn-clean primary"
          style={{ fontSize: 12 }}
          onClick={() => { void onConfirm(true); }}
        >
          <I.send /> wyślij
        </button>
        <button className="btn-clean" style={{ fontSize: 12 }}>podgląd</button>
        <div style={{ flex: 1 }} />
        <button
          className="btn-clean"
          style={{ fontSize: 12, padding: 6 }}
          onClick={onCancel}
          aria-label="Zamknij"
        >
          <I.close />
        </button>
      </div>
    </div>
  )}
  ```

  > LOC check: this file was ~107 LOC. Removing the Radix import + 12 lines of StatusChangeTriggerDialog JSX and adding ~30 lines of popup = net ~+18 LOC, landing ~125 LOC. Split out `KanbanDragPopup.tsx` component (< 50 LOC) to stay within the 80 LOC guideline:

  ```tsx
  // apps/web/app/(admin)/admin/orders/_components/kanban/KanbanDragPopup.tsx
  // Extract the popup div above into its own component with props:
  // interface Props {
  //   pendingMove: PendingMove;
  //   onConfirm: (sendTriggers: boolean) => Promise<void>;
  //   onCancel: () => void;
  // }
  // ~45 LOC
  ```

- [ ] **Step 5: Create `KanbanPageHeader.tsx` + integrate in `kanban/page.tsx`**

  ```tsx
  // apps/web/app/(admin)/admin/orders/kanban/_components/KanbanPageHeader.tsx
  "use client";

  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { Button } from "@repo/ui";
  import Link from "next/link";
  import type { Route } from "next";

  export function KanbanPageHeader() {
    usePageHeader({
      title: "Kanban",
      subtitle: "przeciągnij kartę by zmienić status",
      right: (
        <Link href={"/admin/orders/new" as Route}>
          <Button variant="primary">+ Nowe zlecenie</Button>
        </Link>
      ),
    });
    return null;
  }
  ```

  In `kanban/page.tsx`, add `<KanbanPageHeader />` as first child of the returned `<div>`. Import `KanbanPageHeader` from `./_components/KanbanPageHeader`.

- [ ] **Step 6: REFACTOR — validate all Kanban TS modules ≤ 80 LOC**

  Check `KanbanBoard.tsx` (after split), `KanbanCard.tsx`, `KanbanColumn.tsx`, `KanbanDragPopup.tsx`. Flag any that exceed 80 LOC and split further if needed.

- [ ] **Commit**

  ```
  feat(kanban): reskin board cards + columns + inline post-drag popup + usePageHeader [milestone:9][task:9-29]
  Refs: docs/dispatch-log/9-29-<UTC>.md
  ```
# Wave 6 — Messages + Triggers + Templates + Sklep (9-30 .. 9-34)

---

## Task 9-30 — Messages 3-col layout + `<ClientMiniProfile>` NEW

**Review:** combined single-stage

**Context:**
- `messages/page.tsx` is already a thin server shell (`<Suspense><MessagesShell /></Suspense>`); the real work lives in `MessagesShell.tsx`.
- `MessagesShell` currently uses `flex flex-col h-screen` + inner `flex` for two or three columns. The right rail is `<ThreadClientPanel>` (280px wide, renders a basic contact block with stubbed totals).
- Wave 1 (`grid-cols-admin-msg-3`) token is available in the Tailwind preset.
- `usePageHeader` context is added in task 9-16 and consumed by `AdminLayout` (9-17). By wave 6 it is already live.
- `getClient()` at `/api/admin/clients/{id}` exists; `listOrders()` at `GET /admin/orders?clientId=&status=` also exists (OrderController accepts `clientId` query param).

**Files:**
- Modify: `apps/web/app/(admin)/admin/messages/_components/MessagesShell.tsx`
- Modify: `apps/web/app/(admin)/admin/messages/_components/ThreadList.tsx`
- Modify: `apps/web/app/(admin)/admin/messages/_components/ThreadListRow.tsx`
- Create: `apps/web/app/(admin)/admin/messages/_components/ClientMiniProfile.tsx`
- Create: `apps/web/app/(admin)/admin/messages/__tests__/ClientMiniProfile.test.tsx`

**Acceptance:**
- Page renders a 3-col grid (320 / 1fr / 280) with no horizontal overflow.
- Left column: search box with `border-ink`, filter chips row (nieprzeczytane / wymaga odp. / wszystkie) + channel chips (WhatsApp/Email/SMS/IG); each thread row has 36px avatar with initial, name+time row, channel mono-ink chip + order-id row, preview line, pink 8px unread dot.
- Centre: unchanged thread header + bubble list + composer (no behaviour change).
- Right column: `<ClientMiniProfile>` renders 64px acid avatar, t-display-22 name, "klient od MM.YYYY" sub, sticker row, 5 key-value rows, divider, active orders mini-list. Loading skeleton visible when fetching; empty panel when no thread is selected.
- Existing messaging tests remain green; new tests cover ClientMiniProfile (all sections, loading state, no-thread empty state).

---

- [ ] **Step 1: RED — write `ClientMiniProfile.test.tsx`**

  Create `apps/web/app/(admin)/admin/messages/__tests__/ClientMiniProfile.test.tsx`:

  ```tsx
  import { render, screen, waitFor } from "@testing-library/react";
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { ClientMiniProfile } from "../_components/ClientMiniProfile";

  // Mock both API calls used by ClientMiniProfile
  vi.mock("@/lib/clients/api", () => ({
    getClient: vi.fn().mockResolvedValue({
      id: "c1",
      firstName: "Magdalena",
      lastName: "Kowalska",
      phone: "+48 602 113 224",
      email: "m.kowalska@example.com",
      preferredChannel: "WHATSAPP",
      createdAt: "2024-03-15T10:00:00Z",
      updatedAt: "2024-03-15T10:00:00Z",
      notes: null,
      rodoConsentAt: null,
    }),
  }));

  vi.mock("@/lib/orders/api", () => ({
    listOrders: vi.fn().mockResolvedValue({
      content: [
        {
          id: "o1",
          code: "DR-1042",
          clientId: "c1",
          clientName: "Magdalena Kowalska",
          status: "W_REALIZACJI",
          totalPriceCents: 0,
          currency: "PLN",
          description: "DM 1460 — Vibram",
          plannedPickupAt: null,
          version: 1,
          updatedAt: "2024-05-01T10:00:00Z",
          createdAt: "2024-04-20T10:00:00Z",
          receivedAt: "2024-04-20T10:00:00Z",
          pickedUpAt: null,
          quotedPriceCents: 0,
          advancePaidCents: 0,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
      last: true,
    }),
  }));

  vi.mock("@/lib/log", () => ({
    createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }));

  describe("ClientMiniProfile", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders empty panel when clientId is null", () => {
      render(<ClientMiniProfile clientId={null} />);
      expect(screen.getByText(/wybierz wątek/i)).toBeInTheDocument();
    });

    it("shows loading skeleton while fetching", () => {
      render(<ClientMiniProfile clientId="c1" />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("renders client identity after load", async () => {
      render(<ClientMiniProfile clientId="c1" />);
      await waitFor(() => expect(screen.getByText("Magdalena Kowalska")).toBeInTheDocument());
      expect(screen.getByText(/klient od 03\.2024/i)).toBeInTheDocument();
    });

    it("renders initials in acid avatar", async () => {
      render(<ClientMiniProfile clientId="c1" />);
      await waitFor(() => expect(screen.getByText("MK")).toBeInTheDocument());
    });

    it("renders contact key-value rows", async () => {
      render(<ClientMiniProfile clientId="c1" />);
      await waitFor(() => {
        expect(screen.getByText("+48 602 113 224")).toBeInTheDocument();
        expect(screen.getByText("m.kowalska@example.com")).toBeInTheDocument();
        expect(screen.getByText("WHATSAPP")).toBeInTheDocument();
      });
    });

    it("renders active orders section with DR code", async () => {
      render(<ClientMiniProfile clientId="c1" />);
      await waitFor(() => {
        expect(screen.getByText("DR-1042")).toBeInTheDocument();
        expect(screen.getByText("DM 1460 — Vibram")).toBeInTheDocument();
      });
    });
  });
  ```

  Expected compile failure: `ClientMiniProfile` does not exist yet. `listOrders` import in the component will also fail.

- [ ] **Step 2: Create `ClientMiniProfile.tsx`**

  Create `apps/web/app/(admin)/admin/messages/_components/ClientMiniProfile.tsx`:

  ```tsx
  "use client";

  import { useState, useEffect } from "react";
  import { createLogger } from "@/lib/log";
  import { getClient } from "@/lib/clients/api";
  import { listOrders } from "@/lib/orders/api";
  import type { ClientDto } from "@/lib/clients/types";
  import type { OrderListRow } from "@/lib/orders/types";
  import { Pill } from "@repo/ui";
  import { Sticker } from "@repo/ui";
  import { PhImg } from "@repo/ui";

  const log = createLogger("messaging.clientminiprofile");

  interface Props {
    clientId: string | null;
  }

  function initials(c: ClientDto): string {
    const f = c.firstName?.[0] ?? "";
    const l = c.lastName?.[0] ?? "";
    return (f + l).toUpperCase() || "?";
  }

  function joinedDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", { month: "2-digit", year: "numeric", timeZone: "Europe/Warsaw" });
  }

  // ≤ 80 LOC — split into sub-components below if needed
  export function ClientMiniProfile({ clientId }: Props) {
    const [client, setClient] = useState<ClientDto | null>(null);
    const [orders, setOrders] = useState<OrderListRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!clientId) { setClient(null); setOrders([]); return; }
      let cancelled = false;
      setLoading(true);
      Promise.all([
        getClient(clientId),
        listOrders({ clientId, status: ["PRZYJETE", "W_REALIZACJI", "CZEKA_NA_KLIENTA", "GOTOWE_DO_ODBIORU"] }, 0, 5),
      ])
        .then(([c, page]) => {
          if (cancelled) return;
          log.info("op=ClientMiniProfile.load outcome=ok", { clientId, orders: page.totalElements });
          setClient(c);
          setOrders(page.content);
        })
        .catch(err => log.error("op=ClientMiniProfile.load outcome=error", { clientId, err: String(err) }))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [clientId]);

    if (!clientId) {
      return (
        <aside className="border-l border-admin-line bg-white flex items-center justify-center" style={{ width: 280 }}>
          <span className="t-mono text-[11px] opacity-40">wybierz wątek</span>
        </aside>
      );
    }

    if (loading && !client) {
      return (
        <aside role="status" className="border-l border-admin-line bg-white p-4 space-y-3 animate-pulse" style={{ width: 280 }}>
          <div className="mx-auto rounded-full bg-paper-2 border border-ink" style={{ width: 64, height: 64 }} />
          <div className="h-4 bg-paper-2 rounded mx-6" />
          <div className="h-3 bg-paper-2 rounded mx-10" />
        </aside>
      );
    }

    if (!client) return null;
    const ini = initials(client);
    const fullName = [client.firstName, client.lastName].filter(Boolean).join(" ");
    const joined = joinedDate(client.createdAt);
    const isRegular = orders.length >= 3;

    return (
      <aside className="border-l border-admin-line bg-white flex flex-col overflow-auto shrink-0" style={{ width: 280 }}>
        <ClientMiniProfileIdentity ini={ini} fullName={fullName} joined={joined} isRegular={isRegular} />
        <ClientMiniProfileContact client={client} />
        <ClientMiniProfileOrders orders={orders} />
      </aside>
    );
  }
  ```

  The component is ~75 LOC. Split the identity/contact/orders sections into co-located sub-functions in the same file:

  Append to the same file (still under 80 LOC total per section; the whole file may be ~160 LOC — split into `ClientMiniProfileIdentity.tsx`, `ClientMiniProfileContact.tsx`, `ClientMiniProfileOrders.tsx` in the same `_components/` directory if linting fails the 80-LOC budget):

  ```tsx
  // --- sub-components in same file OR extracted to sibling files ---

  function ClientMiniProfileIdentity({
    ini, fullName, joined, isRegular,
  }: { ini: string; fullName: string; joined: string; isRegular: boolean }) {
    return (
      <div className="px-4 py-5 border-b border-admin-line flex flex-col items-center text-center">
        <div
          className="flex items-center justify-center rounded-full border-2 border-ink t-display"
          style={{ width: 64, height: 64, background: "var(--acid)", fontSize: 26 }}
        >
          {ini}
        </div>
        <div className="t-display mt-2.5" style={{ fontSize: 22, lineHeight: 1 }}>{fullName}</div>
        <div className="t-mono mt-1 opacity-60" style={{ fontSize: 11 }}>klient od {joined}</div>
        {isRegular && (
          <div className="flex gap-1.5 mt-2">
            <Sticker angle={-2} style={{ fontSize: 10, padding: "4px 10px" }}>stały klient</Sticker>
          </div>
        )}
      </div>
    );
  }

  function ClientMiniProfileContact({ client }: { client: ClientDto }) {
    return (
      <div className="px-4 py-4 border-b border-admin-line space-y-2.5">
        {client.phone && <MiniRow k="Telefon" v={client.phone} />}
        {client.email && <MiniRow k="Email" v={client.email} />}
        {client.preferredChannel && <MiniRow k="Preferowany kanał" v={client.preferredChannel} />}
      </div>
    );
  }

  function ClientMiniProfileOrders({ orders }: { orders: OrderListRow[] }) {
    return (
      <div className="px-4 py-4">
        <div className="t-stencil mb-2" style={{ fontSize: 11, letterSpacing: ".08em" }}>Aktywne zlecenia</div>
        {orders.length === 0 && (
          <div className="t-mono opacity-55" style={{ fontSize: 11 }}>Brak aktywnych zleceń</div>
        )}
        <div className="flex flex-col gap-2">
          {orders.map(o => (
            <div key={o.id} className="flex gap-2 items-center border-[1.5px] border-ink p-2">
              <PhImg label="" style={{ width: 36, height: 36, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="t-mono font-bold" style={{ fontSize: 11 }}>{o.code}</div>
                <div className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>{o.description ?? "—"}</div>
              </div>
              <Pill status={o.status} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  function MiniRow({ k, v }: { k: string; v: string }) {
    return (
      <div className="flex justify-between" style={{ fontSize: 12 }}>
        <span className="t-mono opacity-55">{k}</span>
        <span className="font-semibold">{v}</span>
      </div>
    );
  }
  ```

  **LOC budget note:** if the combined file exceeds 160 LOC, extract `ClientMiniProfileIdentity`, `ClientMiniProfileContact`, `ClientMiniProfileOrders` each to their own `_components/` files and re-export from `ClientMiniProfile.tsx`.

- [ ] **Step 3: Update `MessagesShell.tsx` — wire 3-col grid + usePageHeader + channel chips**

  Replace the outer layout in `MessagesShell.tsx`:

  ```tsx
  // At the top of the file, add:
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { ClientMiniProfile } from "./ClientMiniProfile";

  // Remove: import { ThreadClientPanel } from "./ThreadClientPanel";
  // (ThreadClientPanel is superseded by ClientMiniProfile for M9 design parity)

  // Inside MessagesShell component body, add before return:
  const unreadCount = /* derive from thread list — pass via prop or context */ 0; // placeholder
  usePageHeader({
    title: "Wiadomości",
    subtitle: `${unreadCount} nieprzeczytane · zunifikowana skrzynka`,
  });

  // Replace existing return JSX:
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 grid grid-cols-admin-msg-3 overflow-hidden border-t-2 border-ink">
        {/* LEFT: thread list */}
        <ThreadList
          selectedId={sel.selectedId}
          filter={sel.filter}
          channel={sel.channel}
          q={sel.q}
          onSelect={sel.setSelectedId}
          onFilterChange={sel.setFilter}
          onChannelChange={sel.setChannel}
          onQChange={sel.setQ}
        />

        {/* CENTRE: active thread */}
        <main className="flex flex-col min-w-0 overflow-hidden" style={{ background: "var(--paper-2)" }}>
          {!sel.selectedId && <EmptyState variant="no-selection" />}
          {sel.selectedId && (
            <SelectedThread
              threadId={sel.selectedId}
              onLoaded={setLoadedThread}
              onResolved={() => sel.setSelectedId(null)}
            />
          )}
        </main>

        {/* RIGHT: client mini-profile */}
        <ClientMiniProfile clientId={loadedThread?.clientId ?? null} />
      </div>
      <NewMessageDialog
        open={newMsgOpen}
        onOpenChange={setNewMsgOpen}
        onSent={(threadId) => sel.setSelectedId(threadId)}
      />
    </div>
  );
  ```

  Also update `useThreadSelection.ts` (or the existing hook) to expose `setChannel` for the channel filter chip row, if not already present. If `channel` state is already in `useThreadSelection`, add `onChannelChange` prop to `ThreadList`.

- [ ] **Step 4: Update `ThreadList.tsx` — design parity**

  Replace the sidebar with the design-parity version. Key changes vs current:
  - Width stays 320px but border becomes `border-r-2 border-ink`.
  - Search box: `border-[1.5px] border-ink` (not rounded-md), ink search icon.
  - Filter chips row 1: "nieprzeczytane ({n})" / "wymaga odp." / "wszystkie" — using `<Chip>` from `@repo/ui`.
  - Filter chips row 2 (channel): WhatsApp / Email / SMS / IG — using `<Chip>`.
  - "Wymaga odp." maps to a new filter state `NEEDS_REPLY` passed to `listThreads`. If the backend does not yet support this filter param, the chip renders but passes `filter=ALL` as a fallback (add a TODO comment).

  ```tsx
  // apps/web/app/(admin)/admin/messages/_components/ThreadList.tsx (key structure)
  "use client";

  import { useState, useEffect, useRef } from "react";
  import { createLogger } from "@/lib/log";
  import { listThreads } from "@/lib/messaging/api";
  import type { MessageThreadDto, ThreadFilter, Channel } from "@/lib/messaging/types";
  import { ThreadListRow } from "./ThreadListRow";
  import { ThreadListSkeleton } from "./ThreadListSkeleton";
  import { Chip } from "@repo/ui";
  import { I } from "@repo/ui";

  const log = createLogger("messaging.threadlist");
  const POLL_MS = 30_000;
  const CHANNELS: Channel[] = ["WHATSAPP", "EMAIL", "SMS"];

  interface Props {
    selectedId: string | null;
    filter: ThreadFilter;
    channel: Channel | null;
    q: string;
    onSelect: (id: string) => void;
    onFilterChange: (f: ThreadFilter) => void;
    onChannelChange: (ch: Channel | null) => void;
    onQChange: (q: string) => void;
  }

  export function ThreadList({ selectedId, filter, channel, q, onSelect, onFilterChange, onChannelChange, onQChange }: Props) {
    const [threads, setThreads] = useState<MessageThreadDto[]>([]);
    const [loading, setLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
      let cancelled = false;
      async function load() {
        try {
          const data = await listThreads(filter, channel ?? undefined, q);
          if (!cancelled) setThreads(data);
        } catch (err) {
          log.error("op=listThreads outcome=error", { err: String(err) });
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      setLoading(true);
      load();
      timerRef.current = setInterval(load, POLL_MS);
      return () => { cancelled = true; if (timerRef.current) clearInterval(timerRef.current); };
    }, [filter, channel, q]);

    const unreadCount = threads.filter(t => t.unreadCount > 0).length;

    return (
      <aside className="shrink-0 border-r-2 border-ink flex flex-col bg-white overflow-hidden" style={{ width: 320 }}>
        <div className="px-3 pt-3 pb-2 border-b border-admin-line flex flex-col gap-2">
          {/* search */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-[1.5px] border-ink">
            <span className="text-admin-mute shrink-0">{I.search}</span>
            <input
              type="text"
              value={q}
              onChange={e => onQChange(e.target.value)}
              aria-label="Szukaj wątków"
              placeholder="Szukaj…"
              style={{ border: 0, outline: 0, flex: 1, fontFamily: "var(--font-body)", fontSize: 12 }}
            />
          </div>
          {/* filter chips — row 1 */}
          <div className="flex gap-1.5 flex-wrap">
            <Chip active={filter === "UNREAD"} onClick={() => onFilterChange("UNREAD")}>
              nieprzeczytane ({unreadCount})
            </Chip>
            {/* wymaga odp. — TODO: map to NEEDS_REPLY when backend supports it */}
            <Chip active={false} onClick={() => onFilterChange("ALL")}>
              wymaga odp.
            </Chip>
            <Chip active={filter === "ALL"} onClick={() => onFilterChange("ALL")}>
              wszystkie
            </Chip>
          </div>
          {/* channel chips — row 2 */}
          <div className="flex gap-1.5">
            {CHANNELS.map(ch => (
              <Chip key={ch} active={channel === ch} onClick={() => onChannelChange(channel === ch ? null : ch)}>
                {ch === "WHATSAPP" ? "WhatsApp" : ch}
              </Chip>
            ))}
            <Chip active={false} onClick={() => {}}>IG</Chip>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && threads.length === 0 && <ThreadListSkeleton />}
          {!loading && threads.length === 0 && (
            <div className="flex items-center justify-center py-16 t-mono text-[12px] text-admin-mute">
              Brak wiadomości
            </div>
          )}
          {threads.map(t => (
            <ThreadListRow key={t.id} thread={t} selected={t.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      </aside>
    );
  }
  ```

- [ ] **Step 5: Update `ThreadListRow.tsx` — design parity + GREEN**

  Replace with graffiti-style row matching design. Key changes:
  - Avatar: `paper-2 bg + border-[1.5px] border-ink`, font-mono 700 12px, 36×36, circle.
  - Name+time: name `fontSize 13 fontWeight 600`, time `t-mono fontSize 10 opacity-50` right-aligned.
  - Channel chip: `t-mono fontSize 9 bg-ink text-paper px-[5px] py-[1px] letter-spacing .05em` + order-id `t-mono fontSize 9 opacity-50`.
  - Preview: `fontSize 12 fontWeight 600 if unread else 400`.
  - Pink unread dot: `width 8 height 8 bg-pink rounded-full alignSelf center`.
  - Active row: `background rgba(216,255,58,0.20) borderLeft 3px solid ink` else `borderLeft 3px solid transparent`.

  ```tsx
  import type { MessageThreadDto } from "@/lib/messaging/types";

  interface Props {
    thread: MessageThreadDto;
    selected: boolean;
    onSelect: (id: string) => void;
  }

  export function ThreadListRow({ thread: t, selected, onSelect }: Props) {
    const isUnread = t.unreadCount > 0;
    const ini = t.clientName
      ? t.clientName.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()
      : "?";
    const displayTime = t.lastMessageAt
      ? new Date(t.lastMessageAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" })
      : "—";

    return (
      <div
        role="button"
        tabIndex={0}
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(t.id)}
        onKeyDown={e => e.key === "Enter" && onSelect(t.id)}
        style={{
          borderLeft: selected ? "3px solid var(--ink)" : "3px solid transparent",
          background: selected ? "rgba(216,255,58,0.20)" : "transparent",
        }}
        className="flex gap-2.5 px-3 py-3 border-b border-admin-line cursor-pointer hover:bg-paper/60"
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0 border-[1.5px] border-ink t-mono font-bold"
          style={{ width: 36, height: 36, background: "var(--paper-2)", fontSize: 12 }}
        >
          {ini}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 min-w-0">
            <span className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>
              {t.unmatched ? t.rawSender : t.clientName}
            </span>
            <span className="t-mono shrink-0 opacity-50" style={{ fontSize: 10 }}>{displayTime}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="t-mono"
              style={{ fontSize: 9, padding: "1px 5px", background: "var(--ink)", color: "var(--paper)", letterSpacing: ".05em" }}
            >
              {t.channel}
            </span>
            {t.clientName && (
              <span className="t-mono opacity-50" style={{ fontSize: 9 }}>
                {/* orderId placeholder — MessageThreadDto doesn't carry orderId yet; show empty gracefully */}
              </span>
            )}
          </div>
          <div
            className="mt-1 truncate"
            style={{ fontSize: 12, fontWeight: isUnread ? 600 : 400, color: isUnread ? "var(--ink)" : "rgba(0,0,0,0.7)" }}
          >
            {t.lastMessagePreview}
          </div>
        </div>
        {isUnread && (
          <span className="self-center shrink-0 rounded-full" style={{ width: 8, height: 8, background: "var(--pink)" }} />
        )}
      </div>
    );
  }
  ```

  Run `pnpm --filter web test -- --run messages` to confirm all tests pass. Fix any snapshot drift.

  Commit:
  ```
  feat(messages): 3-col layout + ClientMiniProfile + design-parity thread list [milestone:9][task:9-30]

  Refs: docs/dispatch-log/9-30-<UTC>.md
  ```

---

## Task 9-31 — Triggers `<TriggerEditPanel>` NEW + sticky edit-in-place

**Review:** combined single-stage

**Context:**
- `triggers/page.tsx` is currently a server component that fetches triggers and renders a plain `<table>`. The `TriggerToggle` client component handles the enabled toggle via PATCH.
- `triggers/[id]/page.tsx` is a read-only detail page (no edit form).
- `TriggerDto` has: `id, name, enabled, event, eventParams, channels (JSON string), templateId, templateName, delayMinutes, requiresManualConfirmation, createdAt, updatedAt`.
- `toggleTrigger()` exists in `lib/messaging/api.ts`; `updateTrigger()` does NOT exist — we wire a minimal PATCH via `api.patch` in `useTriggerEditForm`.
- Placeholder chips insert text at cursor position using `textarea.setSelectionRange` after `document.execCommand` (deprecated) — use the modern `insertText` Input Event approach which works in jsdom for testing: set value via React state + manually track cursor position via `selectionStart`.

**Files:**
- Modify: `apps/web/app/(admin)/admin/triggers/page.tsx` — convert to client wrapper component
- Create: `apps/web/app/(admin)/admin/triggers/_components/TriggerCard.tsx`
- Create: `apps/web/app/(admin)/admin/triggers/_components/TriggerEditPanel.tsx`
- Create: `apps/web/app/(admin)/admin/triggers/_components/useTriggerEditForm.ts`
- Create: `apps/web/app/(admin)/admin/triggers/_components/TriggerListShell.tsx`
- Create: `apps/web/app/(admin)/admin/triggers/__tests__/TriggerCard.test.tsx`
- Create: `apps/web/app/(admin)/admin/triggers/__tests__/TriggerEditPanel.test.tsx`

**Acceptance:**
- Page renders `grid-cols-admin-trig` (1.4fr / 1fr) layout.
- Left: filter chips (aktywne/wyłączone/do potwierdzenia) + "biblioteka szablonów" link; TriggerCard list with design-parity styles.
- Right: `<TriggerEditPanel>` sticky-top-20; opens on click of card's "edytuj" button.
- Name input, event+delay selects, channel chips, content textarea, placeholder chip row (clicking chip inserts `{placeholder}` text at cursor), manual-confirm toggle in dashed paper-2 box, save + test buttons.
- `usePageHeader` set to title "Triggery" / subtitle "zautomatyzowane wiadomości" / right button "+ Nowy trigger".
- Tests: list renders, card click populates panel, placeholder chip inserts text.

---

- [ ] **Step 1: RED — write tests**

  Create `apps/web/app/(admin)/admin/triggers/__tests__/TriggerCard.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { TriggerCard } from "../_components/TriggerCard";

  vi.mock("@/lib/log", () => ({
    createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }));
  vi.mock("@/lib/messaging/api", () => ({
    toggleTrigger: vi.fn().mockResolvedValue({}),
  }));

  const TRIGGER = {
    id: "t1",
    name: "Gotowe — przyjdź odebrać",
    enabled: true,
    event: "STATUS_CHANGE",
    eventParams: "{}",
    channels: '["EMAIL","SMS"]',
    templateId: "tmpl1",
    templateName: "Potwierdzenie",
    delayMinutes: 0,
    requiresManualConfirmation: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  describe("TriggerCard", () => {
    it("renders trigger name", () => {
      render(<TriggerCard trigger={TRIGGER} onEdit={vi.fn()} />);
      expect(screen.getByText("Gotowe — przyjdź odebrać")).toBeInTheDocument();
    });

    it("renders manual chip when requiresManualConfirmation", () => {
      render(<TriggerCard trigger={TRIGGER} onEdit={vi.fn()} />);
      expect(screen.getByText(/wymaga potwierdzenia/i)).toBeInTheDocument();
    });

    it("calls onEdit when edytuj button is clicked", () => {
      const onEdit = vi.fn();
      render(<TriggerCard trigger={TRIGGER} onEdit={onEdit} />);
      fireEvent.click(screen.getByRole("button", { name: /edytuj/i }));
      expect(onEdit).toHaveBeenCalledWith(TRIGGER);
    });

    it("renders disabled opacity when trigger is inactive", () => {
      render(<TriggerCard trigger={{ ...TRIGGER, enabled: false }} onEdit={vi.fn()} />);
      const card = screen.getByText("Gotowe — przyjdź odebrać").closest("[data-testid='trigger-card']");
      expect(card).toHaveStyle({ opacity: "0.55" });
    });
  });
  ```

  Create `apps/web/app/(admin)/admin/triggers/__tests__/TriggerEditPanel.test.tsx`:

  ```tsx
  import { render, screen, fireEvent, waitFor } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { TriggerEditPanel } from "../_components/TriggerEditPanel";
  import { api } from "@/lib/api";

  vi.mock("@/lib/log", () => ({
    createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }));
  vi.mock("@/lib/api", () => ({
    api: { patch: vi.fn().mockResolvedValue({}) },
  }));

  const TRIGGER = {
    id: "t1",
    name: "Gotowe — przyjdź odebrać",
    enabled: true,
    event: "STATUS_CHANGE",
    eventParams: "{}",
    channels: '["EMAIL","SMS"]',
    templateId: "tmpl1",
    templateName: "Potwierdzenie",
    delayMinutes: 0,
    requiresManualConfirmation: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  describe("TriggerEditPanel", () => {
    it("renders trigger name in display heading", () => {
      render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByText("Gotowe — przyjdź odebrać")).toBeInTheDocument();
    });

    it("renders Tape 'edytujesz' header", () => {
      render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByText("edytujesz")).toBeInTheDocument();
    });

    it("renders all placeholder chips", () => {
      render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByText("{imię_klienta}")).toBeInTheDocument();
      expect(screen.getByText("{numer_zlecenia}")).toBeInTheDocument();
    });

    it("clicking placeholder chip appends text to textarea", () => {
      render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
      const ta = screen.getByRole("textbox", { name: /treść/i });
      fireEvent.change(ta, { target: { value: "Cześć " } });
      fireEvent.click(screen.getByText("{imię_klienta}"));
      expect((ta as HTMLTextAreaElement).value).toContain("{imię_klienta}");
    });

    it("clicking zapisz calls api.patch", async () => {
      render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /zapisz zmiany/i }));
      await waitFor(() => expect(api.patch).toHaveBeenCalled());
    });

    it("close button calls onClose", () => {
      const onClose = vi.fn();
      render(<TriggerEditPanel trigger={TRIGGER} onClose={onClose} onSaved={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /zamknij/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });
  ```

  Expected compile failures: `TriggerCard`, `TriggerEditPanel` do not exist yet.

- [ ] **Step 2: Create `useTriggerEditForm.ts`**

  Create `apps/web/app/(admin)/admin/triggers/_components/useTriggerEditForm.ts`:

  ```ts
  "use client";

  import { useState, useRef } from "react";
  import { createLogger } from "@/lib/log";
  import { api } from "@/lib/api";
  import type { TriggerDto } from "@/lib/messaging/types";

  const log = createLogger("triggers.editform");

  export type TriggerEditState = {
    name: string;
    event: string;
    delayMinutes: number;
    channels: string[];
    body: string;
    requiresManualConfirmation: boolean;
    saving: boolean;
    error: string | null;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    setName: (v: string) => void;
    setEvent: (v: string) => void;
    setDelayMinutes: (v: number) => void;
    toggleChannel: (ch: string) => void;
    setBody: (v: string) => void;
    setManualConfirm: (v: boolean) => void;
    insertPlaceholder: (p: string) => void;
    save: (triggerId: string, onSaved: () => void) => Promise<void>;
  };

  export function useTriggerEditForm(trigger: TriggerDto): TriggerEditState {
    const [name, setName] = useState(trigger.name);
    const [event, setEvent] = useState(trigger.event);
    const [delayMinutes, setDelayMinutes] = useState(trigger.delayMinutes);
    const [channels, setChannels] = useState<string[]>(() => {
      try { return JSON.parse(trigger.channels); } catch { return []; }
    });
    const [body, setBody] = useState("");
    const [requiresManualConfirmation, setManualConfirm] = useState(trigger.requiresManualConfirmation);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    function toggleChannel(ch: string) {
      setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
    }

    function insertPlaceholder(p: string) {
      const ta = textareaRef.current;
      if (!ta) { setBody(b => b + p); return; }
      const start = ta.selectionStart ?? body.length;
      const end = ta.selectionEnd ?? body.length;
      const next = body.slice(0, start) + p + body.slice(end);
      setBody(next);
      // Restore cursor after state update
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + p.length;
        ta.focus();
      });
    }

    async function save(triggerId: string, onSaved: () => void) {
      setSaving(true);
      setError(null);
      try {
        await api.patch(`/admin/triggers/${triggerId}`, {
          name, event, delayMinutes, channels, requiresManualConfirmation,
        });
        log.info("op=saveTrigger outcome=ok", { triggerId });
        onSaved();
      } catch (err) {
        log.error("op=saveTrigger outcome=error", { triggerId, err: String(err) });
        setError("Nie udało się zapisać. Spróbuj ponownie.");
      } finally {
        setSaving(false);
      }
    }

    return {
      name, event, delayMinutes, channels, body, requiresManualConfirmation,
      saving, error, textareaRef,
      setName, setEvent, setDelayMinutes, toggleChannel, setBody, setManualConfirm,
      insertPlaceholder, save,
    };
  }
  ```

- [ ] **Step 3: Create `TriggerCard.tsx`**

  Create `apps/web/app/(admin)/admin/triggers/_components/TriggerCard.tsx`:

  ```tsx
  "use client";

  import { createLogger } from "@/lib/log";
  import { Toggle, Chip } from "@repo/ui";
  import { I } from "@repo/ui";
  import { toggleTrigger } from "@/lib/messaging/api";
  import type { TriggerDto } from "@/lib/messaging/types";

  const log = createLogger("triggers.card");

  const EVENT_LABELS: Record<string, string> = {
    STATUS_CHANGE: "zmiana statusu",
    ORDER_RECEIVED: "zlecenie przyjęte",
    BEFORE_PICKUP_X_DAYS: "X dni przed odbiorem",
    AFTER_HANDOVER_Y_DAYS: "Y dni po wydaniu",
    RESERVATION_EXPIRING: "wygasająca rezerwacja",
  };

  interface Props {
    trigger: TriggerDto;
    onEdit: (t: TriggerDto) => void;
  }

  export function TriggerCard({ trigger: t, onEdit }: Props) {
    const channels = (() => { try { return (JSON.parse(t.channels) as string[]).join(" + "); } catch { return t.channels; } })();
    const delay = t.delayMinutes === 0 ? "natychmiast" : t.delayMinutes < 60 ? `+${t.delayMinutes}m` : `+${t.delayMinutes / 60}h`;
    const sentMock = 0; // stats fields not on TriggerDto yet — display 0

    async function handleToggle() {
      try {
        await toggleTrigger(t.id, !t.enabled);
        log.info("op=toggleTrigger", { id: t.id, enabled: !t.enabled });
      } catch (err) {
        log.error("op=toggleTrigger outcome=error", { id: t.id, err: String(err) });
      }
    }

    return (
      <div
        data-testid="trigger-card"
        className="admin-card flex gap-3.5 items-start"
        style={{
          padding: 16,
          opacity: t.enabled ? 1 : 0.55,
          borderLeftWidth: 5,
          borderLeftStyle: "solid",
          borderLeftColor: t.requiresManualConfirmation ? "var(--pink)" : "var(--blue)",
        }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 38, height: 38, background: "var(--ink)", color: "var(--acid)" }}
        >
          {I.zap}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="t-display" style={{ fontSize: 18 }}>{t.name}</div>
            {t.requiresManualConfirmation && (
              <Chip color="pink" style={{ fontSize: 10, padding: "2px 8px" }}>wymaga potwierdzenia</Chip>
            )}
          </div>
          <div className="t-mono mt-1" style={{ fontSize: 11, color: "rgba(0,0,0,0.6)" }}>
            <strong>kiedy:</strong> {EVENT_LABELS[t.event] ?? t.event} · <strong>kanał:</strong> {channels} · <strong>opóźnienie:</strong> {delay}
          </div>
          <div className="flex gap-4 mt-2">
            <span className="t-mono" style={{ fontSize: 11 }}><b>{sentMock}</b> wysłane</span>
            <span className="t-mono" style={{ fontSize: 11 }}><b>0</b> otwarte</span>
            <span className="t-mono" style={{ fontSize: 11 }}><b>0</b> odpowiedzi</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Toggle on={t.enabled} onChange={handleToggle} />
          <button
            className="btn-clean"
            style={{ fontSize: 11, padding: "3px 8px" }}
            onClick={() => onEdit(t)}
            aria-label="edytuj"
          >
            edytuj
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Create `TriggerEditPanel.tsx`**

  Create `apps/web/app/(admin)/admin/triggers/_components/TriggerEditPanel.tsx`:

  ```tsx
  "use client";

  import { useEffect } from "react";
  import { createLogger } from "@/lib/log";
  import { Tape, Toggle, Chip } from "@repo/ui";
  import { I } from "@repo/ui";
  import { useTriggerEditForm } from "./useTriggerEditForm";
  import type { TriggerDto } from "@/lib/messaging/types";

  const log = createLogger("triggers.editpanel");

  const PLACEHOLDERS = ["{imię_klienta}", "{numer_zlecenia}", "{typ_pracy}", "{data_odbioru}", "{link_do_zdjęć}"];
  const CHANNELS_ALL = ["Email", "SMS", "WhatsApp"];

  interface Props {
    trigger: TriggerDto;
    onClose: () => void;
    onSaved: () => void;
  }

  export function TriggerEditPanel({ trigger, onClose, onSaved }: Props) {
    const f = useTriggerEditForm(trigger);
    log.debug("op=TriggerEditPanel.render", { triggerId: trigger.id });

    // Reset form when trigger changes
    useEffect(() => {
      // form resets via useTriggerEditForm's useState initializers on key change
    }, [trigger.id]);

    return (
      <div className="admin-card sticky" style={{ padding: 22, top: 20, alignSelf: "flex-start" }}>
        {/* Header */}
        <div className="flex justify-between items-center mb-3.5">
          <Tape angle={-2}>edytujesz</Tape>
          <button className="btn-clean" style={{ padding: 4 }} onClick={onClose} aria-label="zamknij">
            {I.close}
          </button>
        </div>
        <div className="t-display" style={{ fontSize: 26, lineHeight: 1 }}>{trigger.name}</div>
        <div className="t-mono mt-1 mb-4" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)" }}>
          0 wysłanych · 0 odpowiedzi
        </div>

        <div className="flex flex-col gap-3.5">
          {/* name */}
          <div className="field">
            <label>Nazwa</label>
            <input value={f.name} onChange={e => f.setName(e.target.value)} />
          </div>
          {/* event + delay */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field">
              <label>Zdarzenie</label>
              <select value={f.event} onChange={e => f.setEvent(e.target.value)}>
                <option value="STATUS_CHANGE">zmiana statusu</option>
                <option value="ORDER_RECEIVED">zlecenie przyjęte</option>
                <option value="BEFORE_PICKUP_X_DAYS">X dni przed odbiorem</option>
                <option value="AFTER_HANDOVER_Y_DAYS">Y dni po wydaniu</option>
              </select>
            </div>
            <div className="field">
              <label>Opóźnienie</label>
              <select value={f.delayMinutes} onChange={e => f.setDelayMinutes(Number(e.target.value))}>
                <option value={0}>natychmiast</option>
                <option value={120}>+2h</option>
                <option value={1440}>+1 dzień</option>
                <option value={4320}>+3 dni</option>
                <option value={7200}>+5 dni</option>
              </select>
            </div>
          </div>
          {/* channels */}
          <div className="field">
            <label>Kanał</label>
            <div className="flex gap-2 flex-wrap">
              {CHANNELS_ALL.map(ch => (
                <Chip
                  key={ch}
                  active={f.channels.some(c => c.toLowerCase() === ch.toLowerCase())}
                  onClick={() => f.toggleChannel(ch.toUpperCase())}
                >
                  {ch}
                </Chip>
              ))}
            </div>
          </div>
          {/* body textarea */}
          <div className="field">
            <label htmlFor="trigger-body">Treść · placeholdery klikalne</label>
            <textarea
              id="trigger-body"
              aria-label="treść"
              ref={f.textareaRef}
              rows={6}
              value={f.body}
              onChange={e => f.setBody(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
          </div>
          {/* placeholder chips */}
          <div className="flex gap-1.5 flex-wrap">
            {PLACEHOLDERS.map(p => (
              <button
                key={p}
                className="chip"
                style={{ fontSize: 10, padding: "2px 8px" }}
                onClick={() => f.insertPlaceholder(p)}
                type="button"
              >
                {p}
              </button>
            ))}
          </div>
          {/* manual confirm toggle */}
          <div
            className="flex justify-between items-center"
            style={{ padding: "10px 12px", background: "var(--paper-2)", border: "1px dashed var(--ink)" }}
          >
            <div className="flex flex-col">
              <span className="t-mono font-bold" style={{ fontSize: 11 }}>Wymaga ręcznego potwierdzenia</span>
              <span className="t-mono opacity-55" style={{ fontSize: 10 }}>trafia do skrzynki „do wysłania"</span>
            </div>
            <Toggle on={f.requiresManualConfirmation} onChange={() => f.setManualConfirm(!f.requiresManualConfirmation)} />
          </div>
          {/* error */}
          {f.error && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{f.error}</div>
          )}
          {/* actions */}
          <div className="flex gap-2">
            <button
              className="btn-clean primary"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => f.save(trigger.id, onSaved)}
              disabled={f.saving}
              aria-label="zapisz zmiany"
            >
              {f.saving ? "zapisywanie…" : "zapisz zmiany"}
            </button>
            <button className="btn-clean" style={{ flex: 1, justifyContent: "center" }} type="button">
              {I.send} test do siebie
            </button>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 5: Create `TriggerListShell.tsx` + update `triggers/page.tsx` + run tests GREEN**

  Create `apps/web/app/(admin)/admin/triggers/_components/TriggerListShell.tsx`:

  ```tsx
  "use client";

  import { useState, useEffect } from "react";
  import Link from "next/link";
  import type { Route } from "next";
  import { createLogger } from "@/lib/log";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { Button, Chip } from "@repo/ui";
  import { getTriggers } from "@/lib/messaging/api";
  import type { TriggerDto } from "@/lib/messaging/types";
  import { TriggerCard } from "./TriggerCard";
  import { TriggerEditPanel } from "./TriggerEditPanel";

  const log = createLogger("triggers.listshell");
  type Filter = "active" | "disabled" | "manual";

  export function TriggerListShell() {
    const [triggers, setTriggers] = useState<TriggerDto[]>([]);
    const [filter, setFilter] = useState<Filter>("active");
    const [editing, setEditing] = useState<TriggerDto | null>(null);

    usePageHeader({
      title: "Triggery",
      subtitle: "zautomatyzowane wiadomości",
      right: <Button variant="primary">+ Nowy trigger</Button>,
    });

    useEffect(() => {
      getTriggers()
        .then(ts => { log.info("op=getTriggers outcome=ok", { count: ts.length }); setTriggers(ts); })
        .catch(err => log.error("op=getTriggers outcome=error", { err: String(err) }));
    }, []);

    const filtered = triggers.filter(t =>
      filter === "active" ? t.enabled && !t.requiresManualConfirmation :
      filter === "disabled" ? !t.enabled :
      t.requiresManualConfirmation
    );
    const activeCt = triggers.filter(t => t.enabled).length;
    const disabledCt = triggers.filter(t => !t.enabled).length;
    const manualCt = triggers.filter(t => t.requiresManualConfirmation).length;

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, padding: 24 }}>
        {/* LEFT */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 flex-wrap">
              <Chip active={filter === "active"} onClick={() => setFilter("active")}>aktywne ({activeCt})</Chip>
              <Chip active={filter === "disabled"} onClick={() => setFilter("disabled")}>wyłączone ({disabledCt})</Chip>
              <Chip active={filter === "manual"} onClick={() => setFilter("manual")}>do potwierdzenia ({manualCt})</Chip>
            </div>
            <Link href={"/admin/templates" as Route} className="btn-clean" style={{ fontSize: 12 }}>
              biblioteka szablonów →
            </Link>
          </div>
          {filtered.length === 0 && (
            <div className="t-mono text-[12px] text-admin-mute py-8 text-center">Brak triggerów w tym filtrze</div>
          )}
          {filtered.map(t => (
            <TriggerCard key={t.id} trigger={t} onEdit={setEditing} />
          ))}
        </div>
        {/* RIGHT */}
        <div>
          {editing ? (
            <TriggerEditPanel
              trigger={editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                getTriggers().then(setTriggers).catch(() => {});
              }}
            />
          ) : (
            <div className="admin-card flex items-center justify-center t-mono text-[12px] text-admin-mute" style={{ padding: 40, minHeight: 200 }}>
              wybierz trigger do edycji
            </div>
          )}
        </div>
      </div>
    );
  }
  ```

  Update `apps/web/app/(admin)/admin/triggers/page.tsx` — replace contents with:

  ```tsx
  import { TriggerListShell } from "./_components/TriggerListShell";

  export default function TriggersPage() {
    return <TriggerListShell />;
  }
  ```

  Run: `pnpm --filter web test -- --run triggers`

  Commit:
  ```
  feat(triggers): TriggerCard + TriggerEditPanel + placeholder chips + grid layout [milestone:9][task:9-31]

  Refs: docs/dispatch-log/9-31-<UTC>.md
  ```

---

## Task 9-32 — Templates editor parity

**Review:** combined single-stage

**Context:**
- `templates/page.tsx` is a server component rendering a plain table. The actual form lives in `templates/_components/TemplateForm.tsx` (full create/update/delete implementation).
- `templates/[id]/page.tsx` is a server component that fetches a template and renders `<TemplateForm initial={template} />`.
- The existing `TemplateForm` already handles save + delete logic; we adapt it to design-parity and add placeholder chips.
- Pattern mirrors Triggers but simpler: no event/delay selects; just name + channel + body + placeholder chips + save + preview + "test do siebie".

**Files:**
- Modify: `apps/web/app/(admin)/admin/templates/page.tsx` — convert to client shell with list + edit panel
- Create: `apps/web/app/(admin)/admin/templates/_components/TemplateCard.tsx`
- Create: `apps/web/app/(admin)/admin/templates/_components/TemplateEditPanel.tsx`
- Create: `apps/web/app/(admin)/admin/templates/_components/TemplateListShell.tsx`
- Modify: `apps/web/app/(admin)/admin/templates/_components/TemplateForm.tsx` — add placeholder chips section
- Create: `apps/web/app/(admin)/admin/templates/__tests__/TemplateCard.test.tsx`
- Create: `apps/web/app/(admin)/admin/templates/__tests__/TemplateEditPanel.test.tsx`

**Acceptance:**
- Page renders `grid-cols-admin-trig` layout (same 1.4fr / 1fr as triggers — templates share the column preset).
- Left: `<TemplateCard>` list items (name t-display-18, channel t-mono chip, active status) + edit button.
- Right: `<TemplateEditPanel>` sticky: `<Tape>edytujesz</Tape>` header, name input, channel select, body textarea (font-mono), placeholder chips row (clicking inserts), save + preview + "test do siebie" buttons.
- `usePageHeader({ title: 'Szablony wiadomości', subtitle: '{count} szablonów', right: <Button variant="primary">+ Nowy szablon</Button> })`.
- Tests: list renders cards, card click populates edit panel, placeholder chip inserts text, save calls `updateTemplate`.

---

- [ ] **Step 1: RED — write tests**

  Create `apps/web/app/(admin)/admin/templates/__tests__/TemplateCard.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { TemplateCard } from "../_components/TemplateCard";

  vi.mock("@/lib/log", () => ({
    createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }));

  const TEMPLATE = {
    id: "tp1",
    name: "Potwierdzenie przyjęcia",
    channel: "EMAIL" as const,
    subject: "Dr Shoes — przyjęliśmy zlecenie",
    body: "Cześć {imię_klienta}!",
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  describe("TemplateCard", () => {
    it("renders template name", () => {
      render(<TemplateCard template={TEMPLATE} onEdit={vi.fn()} />);
      expect(screen.getByText("Potwierdzenie przyjęcia")).toBeInTheDocument();
    });

    it("renders channel chip", () => {
      render(<TemplateCard template={TEMPLATE} onEdit={vi.fn()} />);
      expect(screen.getByText("EMAIL")).toBeInTheDocument();
    });

    it("calls onEdit when edytuj is clicked", () => {
      const onEdit = vi.fn();
      render(<TemplateCard template={TEMPLATE} onEdit={onEdit} />);
      fireEvent.click(screen.getByRole("button", { name: /edytuj/i }));
      expect(onEdit).toHaveBeenCalledWith(TEMPLATE);
    });

    it("renders inactive indicator when active=false", () => {
      render(<TemplateCard template={{ ...TEMPLATE, active: false }} onEdit={vi.fn()} />);
      expect(screen.getByText(/nieaktywny/i)).toBeInTheDocument();
    });
  });
  ```

  Create `apps/web/app/(admin)/admin/templates/__tests__/TemplateEditPanel.test.tsx`:

  ```tsx
  import { render, screen, fireEvent, waitFor } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { TemplateEditPanel } from "../_components/TemplateEditPanel";

  vi.mock("@/lib/log", () => ({
    createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }));
  vi.mock("@/lib/messaging/api", () => ({
    updateTemplate: vi.fn().mockResolvedValue({}),
  }));

  const TEMPLATE = {
    id: "tp1",
    name: "Potwierdzenie przyjęcia",
    channel: "SMS" as const,
    subject: null,
    body: "Cześć!",
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  describe("TemplateEditPanel", () => {
    it("renders template name in heading", () => {
      render(<TemplateEditPanel template={TEMPLATE} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByText("Potwierdzenie przyjęcia")).toBeInTheDocument();
    });

    it("renders edytujesz tape", () => {
      render(<TemplateEditPanel template={TEMPLATE} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByText("edytujesz")).toBeInTheDocument();
    });

    it("placeholder chip click inserts text in textarea", () => {
      render(<TemplateEditPanel template={TEMPLATE} onClose={vi.fn()} onSaved={vi.fn()} />);
      const ta = screen.getByRole("textbox", { name: /treść/i });
      fireEvent.change(ta, { target: { value: "Hej " } });
      fireEvent.click(screen.getByText("{imię_klienta}"));
      expect((ta as HTMLTextAreaElement).value).toContain("{imię_klienta}");
    });

    it("save button calls updateTemplate", async () => {
      const { updateTemplate } = await import("@/lib/messaging/api");
      render(<TemplateEditPanel template={TEMPLATE} onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /zapisz/i }));
      await waitFor(() => expect(updateTemplate).toHaveBeenCalled());
    });
  });
  ```

- [ ] **Step 2: Create `TemplateCard.tsx`**

  Create `apps/web/app/(admin)/admin/templates/_components/TemplateCard.tsx`:

  ```tsx
  "use client";

  import { createLogger } from "@/lib/log";
  import type { TemplateDto } from "@/lib/messaging/types";

  const log = createLogger("templates.card");

  interface Props {
    template: TemplateDto;
    onEdit: (t: TemplateDto) => void;
  }

  export function TemplateCard({ template: t, onEdit }: Props) {
    log.debug("op=TemplateCard.render", { id: t.id });
    return (
      <div
        className="admin-card flex gap-3 items-start"
        style={{ padding: 14, opacity: t.active ? 1 : 0.6 }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="t-display" style={{ fontSize: 16 }}>{t.name}</div>
            <span
              className="t-mono"
              style={{ fontSize: 9, padding: "1px 5px", background: "var(--ink)", color: "var(--paper)", letterSpacing: ".05em" }}
            >
              {t.channel}
            </span>
            {!t.active && (
              <span className="t-mono opacity-55" style={{ fontSize: 10 }}>nieaktywny</span>
            )}
          </div>
          {t.subject && (
            <div className="t-mono mt-0.5 opacity-60 truncate" style={{ fontSize: 11 }}>{t.subject}</div>
          )}
        </div>
        <button
          className="btn-clean shrink-0"
          style={{ fontSize: 11, padding: "3px 8px" }}
          onClick={() => onEdit(t)}
          aria-label="edytuj"
        >
          edytuj
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 3: Create `TemplateEditPanel.tsx`**

  Create `apps/web/app/(admin)/admin/templates/_components/TemplateEditPanel.tsx`:

  ```tsx
  "use client";

  import { useState, useRef } from "react";
  import { createLogger } from "@/lib/log";
  import { Tape } from "@repo/ui";
  import { I } from "@repo/ui";
  import { updateTemplate } from "@/lib/messaging/api";
  import type { TemplateDto, Channel } from "@/lib/messaging/types";

  const log = createLogger("templates.editpanel");
  const PLACEHOLDERS = ["{imię_klienta}", "{numer_zlecenia}", "{typ_pracy}", "{data_odbioru}", "{link_do_zdjęć}"];

  interface Props {
    template: TemplateDto;
    onClose: () => void;
    onSaved: () => void;
  }

  export function TemplateEditPanel({ template, onClose, onSaved }: Props) {
    const [name, setName] = useState(template.name);
    const [channel, setChannel] = useState<Channel>(template.channel);
    const [body, setBody] = useState(template.body);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const taRef = useRef<HTMLTextAreaElement | null>(null);
    log.debug("op=TemplateEditPanel.render", { id: template.id });

    function insertPlaceholder(p: string) {
      const ta = taRef.current;
      if (!ta) { setBody(b => b + p); return; }
      const start = ta.selectionStart ?? body.length;
      const end = ta.selectionEnd ?? body.length;
      const next = body.slice(0, start) + p + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + p.length; ta.focus(); });
    }

    async function handleSave() {
      setSaving(true); setError(null);
      try {
        await updateTemplate(template.id, { name, channel, body });
        log.info("op=saveTemplate outcome=ok", { id: template.id });
        onSaved();
      } catch (err) {
        log.error("op=saveTemplate outcome=error", { id: template.id, err: String(err) });
        setError("Nie udało się zapisać.");
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="admin-card sticky" style={{ padding: 22, top: 20, alignSelf: "flex-start" }}>
        <div className="flex justify-between items-center mb-3.5">
          <Tape angle={-2}>edytujesz</Tape>
          <button className="btn-clean" style={{ padding: 4 }} onClick={onClose} aria-label="zamknij">{I.close}</button>
        </div>
        <div className="t-display mb-4" style={{ fontSize: 22, lineHeight: 1 }}>{template.name}</div>

        <div className="flex flex-col gap-3">
          <div className="field"><label>Nazwa</label><input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field">
            <label>Kanał</label>
            <select value={channel} onChange={e => setChannel(e.target.value as Channel)}>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tmpl-body">Treść</label>
            <textarea
              id="tmpl-body"
              aria-label="treść"
              ref={taRef}
              rows={7}
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PLACEHOLDERS.map(p => (
              <button key={p} className="chip" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => insertPlaceholder(p)} type="button">{p}</button>
            ))}
          </div>
          {error && <div className="text-[12px] text-red-700">{error}</div>}
          <div className="flex gap-2">
            <button className="btn-clean primary" style={{ flex: 1, justifyContent: "center" }} onClick={handleSave} disabled={saving} aria-label="zapisz">
              {saving ? "zapisywanie…" : "zapisz"}
            </button>
            <button className="btn-clean" style={{ flex: 1, justifyContent: "center" }} type="button">podgląd</button>
            <button className="btn-clean" type="button">{I.send} test do siebie</button>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Create `TemplateListShell.tsx`**

  Create `apps/web/app/(admin)/admin/templates/_components/TemplateListShell.tsx`:

  ```tsx
  "use client";

  import { useState, useEffect } from "react";
  import { createLogger } from "@/lib/log";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { Button } from "@repo/ui";
  import { getTemplates } from "@/lib/messaging/api";
  import type { TemplateDto } from "@/lib/messaging/types";
  import { TemplateCard } from "./TemplateCard";
  import { TemplateEditPanel } from "./TemplateEditPanel";

  const log = createLogger("templates.listshell");

  export function TemplateListShell() {
    const [templates, setTemplates] = useState<TemplateDto[]>([]);
    const [editing, setEditing] = useState<TemplateDto | null>(null);

    usePageHeader({
      title: "Szablony wiadomości",
      subtitle: `${templates.length} szablonów`,
      right: <Button variant="primary">+ Nowy szablon</Button>,
    });

    useEffect(() => {
      getTemplates()
        .then(ts => { log.info("op=getTemplates outcome=ok", { count: ts.length }); setTemplates(ts); })
        .catch(err => log.error("op=getTemplates outcome=error", { err: String(err) }));
    }, []);

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, padding: 24 }}>
        <div className="flex flex-col gap-2">
          {templates.length === 0 && (
            <div className="t-mono text-[12px] text-admin-mute py-8 text-center">Brak szablonów</div>
          )}
          {templates.map(t => <TemplateCard key={t.id} template={t} onEdit={setEditing} />)}
        </div>
        <div>
          {editing ? (
            <TemplateEditPanel
              template={editing}
              onClose={() => setEditing(null)}
              onSaved={() => { setEditing(null); getTemplates().then(setTemplates).catch(() => {}); }}
            />
          ) : (
            <div className="admin-card flex items-center justify-center t-mono text-[12px] text-admin-mute" style={{ padding: 40, minHeight: 160 }}>
              wybierz szablon do edycji
            </div>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 5: Update `templates/page.tsx` + run tests GREEN**

  Replace `apps/web/app/(admin)/admin/templates/page.tsx`:

  ```tsx
  import { TemplateListShell } from "./_components/TemplateListShell";

  export default function TemplatesPage() {
    return <TemplateListShell />;
  }
  ```

  Run: `pnpm --filter web test -- --run templates`

  Commit:
  ```
  feat(templates): editor parity — TemplateCard + TemplateEditPanel + placeholder chips [milestone:9][task:9-32]

  Refs: docs/dispatch-log/9-32-<UTC>.md
  ```

---

## Task 9-33 — Sklep admin product grid + edit panel reskin

**Review:** combined single-stage

**Context:**
- `sklep/page.tsx` currently renders a `<PlaceholderCard>` stub (M7 minimal implementation).
- There is no backend for products or reservations in the current codebase. This task ships the **frontend-only** grid + edit panel with static/empty placeholder data. Task 9-34 addresses the reservations queue and flags the missing backend endpoint.
- `Stamp`, `PhImg`, `Chip`, `Button`, `Tape`, `I`, `AdminCard` from `@repo/ui` are available (wired in wave 1).
- Wave 1 grid preset `grid-cols-admin-sklep` (1.5fr / 1fr) is available.
- The existing test `sklep/__tests__/page.test.tsx` will break (PlaceholderCard is removed) — update it.

**Files:**
- Modify: `apps/web/app/(admin)/admin/sklep/page.tsx` — replace PlaceholderCard stub with `<SklepShell>`
- Create: `apps/web/app/(admin)/admin/sklep/_components/SklepShell.tsx`
- Create: `apps/web/app/(admin)/admin/sklep/_components/ProductCard.tsx`
- Create: `apps/web/app/(admin)/admin/sklep/_components/ProductEditPanel.tsx`
- Modify: `apps/web/app/(admin)/admin/sklep/__tests__/page.test.tsx` — update to new shell
- Create: `apps/web/app/(admin)/admin/sklep/__tests__/ProductCard.test.tsx`
- Create: `apps/web/app/(admin)/admin/sklep/__tests__/ProductEditPanel.test.tsx`

**Acceptance:**
- Page renders `grid-cols-admin-sklep` layout.
- Left: filter chips (wszystkie/dostępne/zarezerwowane/sprzedane) + 2-col product grid; each card has Stamp overlay, edit/eye buttons, brand/size t-mono, name t-display-18, price t-display-22, optional reservations counter.
- Right: `<ProductEditPanel>`: Tape header + close + 4-photo grid + dashed "+ dodaj zdjęcie" button + form (name/brand/size/price/desc) + status chips row.
- `usePageHeader` set correctly.
- Tests: grid renders, filter chips change visible products, edit panel opens on card click.

**Note:** Product data is seeded from a static `PRODUCTS` constant in `SklepShell.tsx` until the backend slice is added. The shape anticipates the future API response.

---

- [ ] **Step 1: RED — write tests**

  Update `apps/web/app/(admin)/admin/sklep/__tests__/page.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import SklepPage from "../page";

  vi.mock("@/lib/log", () => ({
    createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }));
  vi.mock("@/app/(admin)/admin/_components/PageHeaderContext", () => ({
    usePageHeader: vi.fn(),
  }));

  describe("SklepPage", () => {
    it("renders the sklep shell (not the placeholder card)", () => {
      render(<SklepPage />);
      expect(screen.queryByText(/do implementacji w przyszłości/i)).not.toBeInTheDocument();
    });

    it("renders filter chips", () => {
      render(<SklepPage />);
      expect(screen.getByText(/wszystkie/i)).toBeInTheDocument();
      expect(screen.getByText(/dostępne/i)).toBeInTheDocument();
    });
  });
  ```

  Create `apps/web/app/(admin)/admin/sklep/__tests__/ProductCard.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { ProductCard } from "../_components/ProductCard";

  vi.mock("@/lib/log", () => ({
    createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }));

  const PRODUCT = {
    id: "p1",
    name: "AF1 Mid 'Bandana'",
    brand: "Nike",
    size: "EU 43",
    pricePln: "990 zł",
    status: "zarezerwowane" as const,
    reservationsCount: 2,
    photos: [] as string[],
    description: "Custom AF1 mid",
  };

  describe("ProductCard", () => {
    it("renders product name and brand+size", () => {
      render(<ProductCard product={PRODUCT} onEdit={vi.fn()} />);
      expect(screen.getByText("AF1 Mid 'Bandana'")).toBeInTheDocument();
      expect(screen.getByText(/Nike · EU 43/i)).toBeInTheDocument();
    });

    it("renders price", () => {
      render(<ProductCard product={PRODUCT} onEdit={vi.fn()} />);
      expect(screen.getByText("990 zł")).toBeInTheDocument();
    });

    it("renders reservations counter when status is zarezerwowane", () => {
      render(<ProductCard product={PRODUCT} onEdit={vi.fn()} />);
      expect(screen.getByText(/2 rezerwacje/i)).toBeInTheDocument();
    });

    it("calls onEdit when edit button clicked", () => {
      const onEdit = vi.fn();
      render(<ProductCard product={PRODUCT} onEdit={onEdit} />);
      fireEvent.click(screen.getByRole("button", { name: /edytuj/i }));
      expect(onEdit).toHaveBeenCalledWith(PRODUCT);
    });
  });
  ```

  Create `apps/web/app/(admin)/admin/sklep/__tests__/ProductEditPanel.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { ProductEditPanel } from "../_components/ProductEditPanel";

  vi.mock("@/lib/log", () => ({
    createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }));

  const PRODUCT = {
    id: "p1",
    name: "AF1 Mid 'Bandana'",
    brand: "Nike",
    size: "EU 43",
    pricePln: "990 zł",
    status: "dostępne" as const,
    reservationsCount: 0,
    photos: [] as string[],
    description: "Custom AF1",
  };

  describe("ProductEditPanel", () => {
    it("renders Tape header with product name", () => {
      render(<ProductEditPanel product={PRODUCT} onClose={vi.fn()} />);
      expect(screen.getByText(/edytujesz · AF1 Mid 'Bandana'/i)).toBeInTheDocument();
    });

    it("renders form fields (name, brand, size, cena)", () => {
      render(<ProductEditPanel product={PRODUCT} onClose={vi.fn()} />);
      expect(screen.getByLabelText(/nazwa/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/marka/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/rozmiar/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cena/i)).toBeInTheDocument();
    });

    it("renders status chip row", () => {
      render(<ProductEditPanel product={PRODUCT} onClose={vi.fn()} />);
      expect(screen.getByText("dostępne")).toBeInTheDocument();
      expect(screen.getByText("zarezerwowane")).toBeInTheDocument();
      expect(screen.getByText("sprzedane")).toBeInTheDocument();
    });

    it("close button calls onClose", () => {
      const onClose = vi.fn();
      render(<ProductEditPanel product={PRODUCT} onClose={onClose} />);
      fireEvent.click(screen.getByRole("button", { name: /zamknij/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Define `ProductDto` type + create `ProductCard.tsx`**

  Add type to `apps/web/lib/sklep/types.ts` (create new file):

  ```ts
  // apps/web/lib/sklep/types.ts
  export type ProductStatus = "dostępne" | "zarezerwowane" | "sprzedane";

  /** Frontend product shape — anticipates future GET /api/admin/sklep/products response. */
  export interface ProductDto {
    id: string;
    name: string;
    brand: string;
    size: string;
    pricePln: string;
    status: ProductStatus;
    reservationsCount: number;
    photos: string[];
    description: string | null;
  }
  ```

  Create `apps/web/app/(admin)/admin/sklep/_components/ProductCard.tsx`:

  ```tsx
  "use client";

  import { createLogger } from "@/lib/log";
  import { Stamp, PhImg } from "@repo/ui";
  import { I } from "@repo/ui";
  import type { ProductDto, ProductStatus } from "@/lib/sklep/types";

  const log = createLogger("sklep.productcard");

  const STAMP_COLOR: Record<ProductStatus, "green" | "pink" | "ink"> = {
    dostępne: "green",
    zarezerwowane: "pink",
    sprzedane: "ink",
  };

  const STAMP_LABEL: Record<ProductStatus, string> = {
    dostępne: "dostępne",
    zarezerwowane: "rezerwacja",
    sprzedane: "sprzedane",
  };

  interface Props {
    product: ProductDto;
    onEdit: (p: ProductDto) => void;
  }

  export function ProductCard({ product: p, onEdit }: Props) {
    log.debug("op=ProductCard.render", { id: p.id });
    return (
      <div className="admin-card overflow-hidden" style={{ padding: 0 }}>
        <div className="relative border-b-[1.5px] border-ink" style={{ aspectRatio: "1" }}>
          <PhImg label={p.name} style={{ width: "100%", height: "100%", border: "none" }} />
          <div style={{ position: "absolute", top: 8, left: 8 }}>
            <Stamp color={STAMP_COLOR[p.status]} angle={-3}>{STAMP_LABEL[p.status]}</Stamp>
          </div>
          <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
            <button className="btn-clean" style={{ padding: 5 }} onClick={() => onEdit(p)} aria-label="edytuj">{I.edit}</button>
            <button className="btn-clean" style={{ padding: 5 }} aria-label="podgląd">{I.eye}</button>
          </div>
        </div>
        <div style={{ padding: 12 }}>
          <div className="t-mono" style={{ fontSize: 10, color: "rgba(0,0,0,0.55)" }}>{p.brand} · {p.size}</div>
          <div className="t-display mt-0.5" style={{ fontSize: 18 }}>{p.name}</div>
          <div className="flex justify-between items-center mt-1.5">
            <div className="t-display" style={{ fontSize: 22 }}>{p.pricePln}</div>
            {p.status === "zarezerwowane" && p.reservationsCount > 0 && (
              <span className="t-mono font-bold" style={{ fontSize: 10, color: "var(--pink)" }}>
                {p.reservationsCount} rezerwacje
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Create `ProductEditPanel.tsx`**

  Create `apps/web/app/(admin)/admin/sklep/_components/ProductEditPanel.tsx`:

  ```tsx
  "use client";

  import { useState } from "react";
  import { createLogger } from "@/lib/log";
  import { Tape, PhImg, Chip } from "@repo/ui";
  import { I } from "@repo/ui";
  import type { ProductDto, ProductStatus } from "@/lib/sklep/types";

  const log = createLogger("sklep.producteditpanel");
  const STATUSES: ProductStatus[] = ["dostępne", "zarezerwowane", "sprzedane"];

  interface Props {
    product: ProductDto;
    onClose: () => void;
  }

  export function ProductEditPanel({ product, onClose }: Props) {
    const [name, setName] = useState(product.name);
    const [brand, setBrand] = useState(product.brand);
    const [size, setSize] = useState(product.size);
    const [price, setPrice] = useState(product.pricePln);
    const [desc, setDesc] = useState(product.description ?? "");
    const [status, setStatus] = useState<ProductStatus>(product.status);
    log.debug("op=ProductEditPanel.render", { id: product.id });

    return (
      <div className="admin-card" style={{ padding: 18 }}>
        <div className="flex justify-between items-center mb-3">
          <Tape>edytujesz · {product.name}</Tape>
          <button className="btn-clean" style={{ padding: 4 }} onClick={onClose} aria-label="zamknij">{I.close}</button>
        </div>

        {/* 4-photo grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
          {[1, 2, 3, 4].map(i => (
            <PhImg key={i} label={`zdjęcie ${i}`} style={{ aspectRatio: "1" }} />
          ))}
        </div>
        <button className="btn-clean" style={{ width: "100%", justifyContent: "center", borderStyle: "dashed", marginBottom: 14 }} type="button">
          {I.upload} dodaj zdjęcie
        </button>

        <div style={{ display: "grid", gap: 10 }}>
          <div className="field"><label htmlFor="prod-name">Nazwa</label><input id="prod-name" value={name} onChange={e => setName(e.target.value)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
            <div className="field"><label htmlFor="prod-brand">Marka</label><input id="prod-brand" value={brand} onChange={e => setBrand(e.target.value)} /></div>
            <div className="field"><label htmlFor="prod-size">Rozmiar</label><input id="prod-size" value={size} onChange={e => setSize(e.target.value)} /></div>
            <div className="field"><label htmlFor="prod-price">Cena</label><input id="prod-price" value={price} onChange={e => setPrice(e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="prod-desc">Opis</label><textarea id="prod-desc" rows={3} value={desc} onChange={e => setDesc(e.target.value)} /></div>
          <div className="field">
            <label>Status</label>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map(s => (
                <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s}</Chip>
              ))}
            </div>
          </div>
        </div>
        {/* ReservationsQueue inserted by task 9-34 below the status chips */}

        <div className="flex gap-2 mt-3.5">
          <button className="btn-clean primary" style={{ flex: 1, justifyContent: "center" }} type="button">zapisz</button>
          <button className="btn-clean" style={{ color: "var(--red)", borderColor: "var(--red)" }} type="button">{I.trash}</button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Create `SklepShell.tsx` + update `sklep/page.tsx`**

  Create `apps/web/app/(admin)/admin/sklep/_components/SklepShell.tsx`:

  ```tsx
  "use client";

  import { useState } from "react";
  import { createLogger } from "@/lib/log";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import { Button, Chip } from "@repo/ui";
  import type { ProductDto, ProductStatus } from "@/lib/sklep/types";
  import { ProductCard } from "./ProductCard";
  import { ProductEditPanel } from "./ProductEditPanel";

  const log = createLogger("sklep.shell");

  // Static seed data — replaced by real API call once backend endpoint exists (tracked M10)
  const SEED_PRODUCTS: ProductDto[] = [
    { id: "p1", name: "AF1 Mid 'Bandana'", brand: "Nike", size: "EU 43", pricePln: "990 zł", status: "zarezerwowane", reservationsCount: 2, photos: [], description: "Custom AF1 mid · paisley bandana motif." },
    { id: "p2", name: "Chuck 70 Hi custom", brand: "Converse", size: "EU 41", pricePln: "750 zł", status: "dostępne", reservationsCount: 0, photos: [], description: null },
    { id: "p3", name: "Jordan 1 Retro", brand: "Nike", size: "EU 44", pricePln: "1 200 zł", status: "dostępne", reservationsCount: 0, photos: [], description: null },
    { id: "p4", name: "DM 1460 — Vibram", brand: "Dr. Martens", size: "EU 40", pricePln: "640 zł", status: "sprzedane", reservationsCount: 0, photos: [], description: "Vibram sole swap" },
  ];

  type FilterKey = "wszystkie" | ProductStatus;

  export function SklepShell() {
    const [filter, setFilter] = useState<FilterKey>("wszystkie");
    const [editing, setEditing] = useState<ProductDto | null>(null);
    log.debug("op=SklepShell.render", { filter });

    const products = filter === "wszystkie" ? SEED_PRODUCTS : SEED_PRODUCTS.filter(p => p.status === filter);
    const reserved = SEED_PRODUCTS.filter(p => p.status === "zarezerwowane").length;
    const sold = SEED_PRODUCTS.filter(p => p.status === "sprzedane").length;

    usePageHeader({
      title: "Sklep",
      subtitle: `${SEED_PRODUCTS.length} par · ${reserved} zarezerwowanych · ${sold} sprzedanych`,
      right: <Button variant="primary">+ Dodaj parę</Button>,
    });

    return (
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        {/* LEFT */}
        <div>
          <div className="flex gap-2 flex-wrap mb-3.5">
            {(["wszystkie", "dostępne", "zarezerwowane", "sprzedane"] as FilterKey[]).map(f => (
              <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f} ({f === "wszystkie" ? SEED_PRODUCTS.length : SEED_PRODUCTS.filter(p => p.status === f).length})
              </Chip>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {products.map(p => <ProductCard key={p.id} product={p} onEdit={setEditing} />)}
          </div>
        </div>
        {/* RIGHT */}
        <div>
          {editing ? (
            <ProductEditPanel product={editing} onClose={() => setEditing(null)} />
          ) : (
            <div className="admin-card flex items-center justify-center t-mono text-[12px] text-admin-mute" style={{ padding: 40, minHeight: 200 }}>
              wybierz produkt do edycji
            </div>
          )}
        </div>
      </div>
    );
  }
  ```

  Update `apps/web/app/(admin)/admin/sklep/page.tsx`:

  ```tsx
  import { SklepShell } from "./_components/SklepShell";

  export default function SklepPage() {
    return <SklepShell />;
  }
  ```

- [ ] **Step 5: Run tests GREEN**

  ```bash
  pnpm --filter web test -- --run sklep
  ```

  Fix any snapshot drift. Confirm ProductCard, ProductEditPanel, SklepShell all render without errors.

  Commit:
  ```
  feat(sklep): product grid + edit panel reskin — Stamp overlay, filter chips, SklepShell [milestone:9][task:9-33]

  Refs: docs/dispatch-log/9-33-<UTC>.md
  ```

---

## Task 9-34 — Sklep admin `<ReservationsQueue>` NEW

**Review:** combined single-stage

**Context:**
- Task 9-33 left `<ProductEditPanel>` with a comment `{/* ReservationsQueue inserted by task 9-34 below the status chips */}`.
- The backend does NOT expose `GET /api/admin/sklep/{productId}/reservations` — there is no sklep backend yet. This task ships the frontend component AND adds the backend sub-slice (controller + service + test) in Java. Flagged `9-34 [BACKEND-DEP]`.
- Backend sub-slice naming: follow existing conventions — `SklepsController.java` (or `ProductReservationController.java`), `ProductReservationService.java`, test as `ProductReservationControllerIntegrationTest.java` (NOT `IT.java`).
- Frontend component is ≤ 80 LOC; fetches from the new endpoint.

**Files:**
- Create: `apps/web/app/(admin)/admin/sklep/_components/ReservationsQueue.tsx`
- Modify: `apps/web/app/(admin)/admin/sklep/_components/ProductEditPanel.tsx` — wire `<ReservationsQueue productId={product.id} />`
- Create: `apps/web/app/(admin)/admin/sklep/__tests__/ReservationsQueue.test.tsx`
- Create (backend): `backend/app/src/main/java/com/drshoes/app/sklep/ProductReservation.java` — JPA entity
- Create (backend): `backend/app/src/main/java/com/drshoes/app/sklep/ProductReservationRepository.java`
- Create (backend): `backend/app/src/main/java/com/drshoes/app/sklep/ProductReservationService.java`
- Create (backend): `backend/app/src/main/java/com/drshoes/app/sklep/ProductReservationController.java`
- Create (backend): `backend/app/src/main/resources/db/migration/V016__sklep_product_reservations.sql`
- Create (backend): `backend/app/src/test/java/com/drshoes/app/sklep/ProductReservationControllerIntegrationTest.java`

**Acceptance:**
- `GET /api/admin/sklep/{productId}/reservations` returns `List<ProductReservationDto>` (200); requires `ROLE_OWNER` or `ROLE_ADMIN`.
- Frontend `<ReservationsQueue>` renders each reservation row (name + timestamp + phone + note + three action buttons) + empty state + loading state.
- Clicking "anuluj" button calls `DELETE /api/admin/sklep/{productId}/reservations/{reservationId}`.
- Backend integration test (`ProductReservationControllerIntegrationTest`) is green.
- All existing vitest and Maven tests stay green.

---

- [ ] **Step 1: RED — write frontend test + backend IT**

  Create `apps/web/app/(admin)/admin/sklep/__tests__/ReservationsQueue.test.tsx`:

  ```tsx
  import { render, screen, waitFor } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { ReservationsQueue } from "../_components/ReservationsQueue";

  vi.mock("@/lib/log", () => ({
    createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  }));
  vi.mock("@/lib/api", () => ({
    api: {
      get: vi.fn().mockResolvedValue([
        {
          id: "r1",
          productId: "p1",
          clientName: "Karol Jastrzębski",
          phone: "+48 511 003 887",
          note: "może wpaść w czwartek",
          reservedAt: "2024-05-07T10:24:00Z",
          status: "PENDING",
        },
        {
          id: "r2",
          productId: "p1",
          clientName: "Mateusz Kowalik",
          phone: "+48 663 119 408",
          note: "jeśli nie odbierze pierwszy",
          reservedAt: "2024-05-06T18:55:00Z",
          status: "PENDING",
        },
      ]),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  }));

  describe("ReservationsQueue", () => {
    it("renders reservation queue header", async () => {
      render(<ReservationsQueue productId="p1" />);
      await waitFor(() => expect(screen.getByText(/Rezerwacje/i)).toBeInTheDocument());
    });

    it("renders each reservation with name and phone", async () => {
      render(<ReservationsQueue productId="p1" />);
      await waitFor(() => {
        expect(screen.getByText("Karol Jastrzębski")).toBeInTheDocument();
        expect(screen.getByText("+48 511 003 887")).toBeInTheDocument();
      });
    });

    it("renders action buttons for each reservation", async () => {
      render(<ReservationsQueue productId="p1" />);
      await waitFor(() => {
        const confirmBtns = screen.getAllByRole("button", { name: /potwierdź sprzedaż/i });
        expect(confirmBtns).toHaveLength(2);
      });
    });

    it("renders empty state when no reservations", async () => {
      const { api } = await import("@/lib/api");
      vi.mocked(api.get).mockResolvedValueOnce([]);
      render(<ReservationsQueue productId="p2" />);
      await waitFor(() => expect(screen.getByText(/brak rezerwacji/i)).toBeInTheDocument());
    });
  });
  ```

  Create backend test `backend/app/src/test/java/com/drshoes/app/sklep/ProductReservationControllerIntegrationTest.java`:

  ```java
  package com.drshoes.app.sklep;

  import com.drshoes.app.AbstractIntegrationTest;
  import org.junit.jupiter.api.Test;
  import org.springframework.http.MediaType;

  import static org.hamcrest.Matchers.*;
  import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
  import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

  /**
   * Integration tests for GET /api/admin/sklep/{productId}/reservations.
   * Uses AbstractIntegrationTest (Testcontainers Postgres + Flyway) — NOT AdminWebTestBase
   * which does not wire Spring Security for sklep endpoints yet.
   *
   * NOTE: uses *IntegrationTest.java suffix — the *IT.java suffix is excluded from Failsafe
   * in this project (hygiene issue discovered in M3, locked 2026-05-09 per task 4-1).
   */
  class ProductReservationControllerIntegrationTest extends AbstractIntegrationTest {

      @Test
      void list_returns_200_empty_for_unknown_product() throws Exception {
          mockMvc.perform(
                  get("/api/admin/sklep/00000000-0000-0000-0000-000000000000/reservations")
                      .contentType(MediaType.APPLICATION_JSON)
                      .with(ownerAuth()))
              .andExpect(status().isOk())
              .andExpect(content().json("[]"));
      }

      @Test
      void list_requires_authentication() throws Exception {
          mockMvc.perform(
                  get("/api/admin/sklep/00000000-0000-0000-0000-000000000000/reservations"))
              .andExpect(status().isUnauthorized());
      }
  }
  ```

  Expected compile failures: `ProductReservationController`, `ProductReservationControllerIntegrationTest` class references fail.

- [ ] **Step 2: Backend sub-slice — migration + entity + repository + service**

  Create `backend/app/src/main/resources/db/migration/V016__sklep_product_reservations.sql`:

  ```sql
  -- V016: Sklep product reservations queue
  -- Minimal schema: product_reservation holds client contact + note + status.
  -- Product entity deferred — productId is an unvalidated UUID for now (no FK to a products table).
  -- Full product catalogue migration is M10 scope.

  CREATE TABLE product_reservation (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id      UUID        NOT NULL,
      client_name     TEXT        NOT NULL,
      phone           TEXT,
      note            TEXT,
      status          TEXT        NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
      reserved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_product_reservation_product_id ON product_reservation(product_id);
  CREATE INDEX idx_product_reservation_status     ON product_reservation(product_id, status);
  ```

  Create `backend/app/src/main/java/com/drshoes/app/sklep/ProductReservation.java`:

  ```java
  package com.drshoes.app.sklep;

  import jakarta.persistence.*;
  import java.time.Instant;
  import java.util.UUID;

  /**
   * JPA entity for sklep product reservation.
   * productId is an unvalidated UUID — no FK constraint to a products table
   * until the full product catalogue is shipped in M10.
   */
  @Entity
  @Table(name = "product_reservation")
  public class ProductReservation {

      @Id @GeneratedValue(strategy = GenerationType.UUID)
      private UUID id;

      @Column(name = "product_id", nullable = false)
      private UUID productId;

      @Column(name = "client_name", nullable = false)
      private String clientName;

      @Column
      private String phone;

      @Column
      private String note;

      @Column(nullable = false)
      private String status = "PENDING";

      @Column(name = "reserved_at", nullable = false)
      private Instant reservedAt = Instant.now();

      @Column(name = "created_at", nullable = false)
      private Instant createdAt = Instant.now();

      @Column(name = "updated_at", nullable = false)
      private Instant updatedAt = Instant.now();

      // JPA
      protected ProductReservation() {}

      public ProductReservation(UUID productId, String clientName, String phone, String note) {
          this.productId = productId;
          this.clientName = clientName;
          this.phone = phone;
          this.note = note;
      }

      public UUID getId() { return id; }
      public UUID getProductId() { return productId; }
      public String getClientName() { return clientName; }
      public String getPhone() { return phone; }
      public String getNote() { return note; }
      public String getStatus() { return status; }
      public Instant getReservedAt() { return reservedAt; }
      public Instant getCreatedAt() { return createdAt; }
      public Instant getUpdatedAt() { return updatedAt; }
      public void setStatus(String status) { this.status = status; this.updatedAt = Instant.now(); }
  }
  ```

  Create `backend/app/src/main/java/com/drshoes/app/sklep/ProductReservationRepository.java`:

  ```java
  package com.drshoes.app.sklep;

  import org.springframework.data.jpa.repository.JpaRepository;
  import java.util.List;
  import java.util.UUID;

  public interface ProductReservationRepository extends JpaRepository<ProductReservation, UUID> {
      List<ProductReservation> findByProductIdOrderByReservedAtAsc(UUID productId);
  }
  ```

  Create `backend/app/src/main/java/com/drshoes/app/sklep/ProductReservationDto.java` (inner record for serialization):

  ```java
  package com.drshoes.app.sklep;

  import java.time.Instant;
  import java.util.UUID;

  public record ProductReservationDto(
      UUID id,
      UUID productId,
      String clientName,
      String phone,
      String note,
      String status,
      Instant reservedAt
  ) {
      static ProductReservationDto from(ProductReservation r) {
          return new ProductReservationDto(
              r.getId(), r.getProductId(), r.getClientName(),
              r.getPhone(), r.getNote(), r.getStatus(), r.getReservedAt()
          );
      }
  }
  ```

  Create `backend/app/src/main/java/com/drshoes/app/sklep/ProductReservationService.java`:

  ```java
  package com.drshoes.app.sklep;

  import com.drshoes.app.auth.domain.AdminPrincipal;
  import org.slf4j.Logger;
  import org.slf4j.LoggerFactory;
  import org.springframework.stereotype.Service;
  import org.springframework.transaction.annotation.Transactional;

  import java.util.List;
  import java.util.UUID;

  @Service
  public class ProductReservationService {

      private static final Logger log = LoggerFactory.getLogger(ProductReservationService.class);
      private final ProductReservationRepository repo;

      public ProductReservationService(ProductReservationRepository repo) {
          this.repo = repo;
      }

      @Transactional(readOnly = true)
      public List<ProductReservationDto> list(UUID productId, AdminPrincipal actor) {
          var result = repo.findByProductIdOrderByReservedAtAsc(productId)
              .stream().map(ProductReservationDto::from).toList();
          log.info("op=ProductReservationService.list actor={} productId={} count={} outcome=ok",
              actor.id(), productId, result.size());
          return result;
      }

      @Transactional
      public void cancel(UUID productId, UUID reservationId, AdminPrincipal actor) {
          var r = repo.findById(reservationId).orElseThrow(
              () -> new IllegalArgumentException("Reservation not found: " + reservationId));
          if (!r.getProductId().equals(productId)) {
              throw new IllegalArgumentException("Reservation does not belong to product: " + productId);
          }
          r.setStatus("CANCELLED");
          repo.save(r);
          log.info("op=ProductReservationService.cancel actor={} productId={} reservationId={} outcome=ok",
              actor.id(), productId, reservationId);
      }
  }
  ```

- [ ] **Step 3: Create `ProductReservationController.java`**

  Create `backend/app/src/main/java/com/drshoes/app/sklep/ProductReservationController.java`:

  ```java
  package com.drshoes.app.sklep;

  import com.drshoes.app.auth.domain.AdminPrincipal;
  import org.slf4j.Logger;
  import org.slf4j.LoggerFactory;
  import org.springframework.http.ResponseEntity;
  import org.springframework.security.core.annotation.AuthenticationPrincipal;
  import org.springframework.web.bind.annotation.*;

  import java.util.List;
  import java.util.UUID;

  /**
   * REST controller for /api/admin/sklep/{productId}/reservations.
   * Requires admin authentication (Spring Security configured in SecurityConfig).
   * Full product catalogue (products table + full CRUD) is deferred to M10.
   */
  @RestController
  @RequestMapping("/api/admin/sklep/{productId}/reservations")
  public class ProductReservationController {

      private static final Logger log = LoggerFactory.getLogger(ProductReservationController.class);
      private final ProductReservationService svc;

      public ProductReservationController(ProductReservationService svc) {
          this.svc = svc;
      }

      /** GET /api/admin/sklep/{productId}/reservations — list reservations for a product. */
      @GetMapping
      public List<ProductReservationDto> list(
          @PathVariable UUID productId,
          @AuthenticationPrincipal AdminPrincipal actor
      ) {
          log.info("op=listReservations actor={} productId={}", actor.id(), productId);
          return svc.list(productId, actor);
      }

      /** DELETE /api/admin/sklep/{productId}/reservations/{id} — cancel a reservation. */
      @DeleteMapping("/{id}")
      public ResponseEntity<Void> cancel(
          @PathVariable UUID productId,
          @PathVariable UUID id,
          @AuthenticationPrincipal AdminPrincipal actor
      ) {
          log.info("op=cancelReservation actor={} productId={} reservationId={}", actor.id(), productId, id);
          svc.cancel(productId, id, actor);
          return ResponseEntity.noContent().build();
      }
  }
  ```

- [ ] **Step 4: Create `ReservationsQueue.tsx`**

  Create `apps/web/app/(admin)/admin/sklep/_components/ReservationsQueue.tsx`:

  ```tsx
  "use client";

  import { useState, useEffect } from "react";
  import { createLogger } from "@/lib/log";
  import { api } from "@/lib/api";
  import { I } from "@repo/ui";

  const log = createLogger("sklep.reservationsqueue");

  interface ReservationDto {
    id: string;
    productId: string;
    clientName: string;
    phone: string | null;
    note: string | null;
    status: string;
    reservedAt: string;
  }

  interface Props {
    productId: string;
  }

  export function ReservationsQueue({ productId }: Props) {
    const [reservations, setReservations] = useState<ReservationDto[]>([]);
    const [loading, setLoading] = useState(true);
    log.debug("op=ReservationsQueue.render", { productId });

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      api.get<ReservationDto[]>(`/admin/sklep/${productId}/reservations`)
        .then(data => { if (!cancelled) { setReservations(data); setLoading(false); } })
        .catch(err => { log.error("op=listReservations outcome=error", { productId, err: String(err) }); if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [productId]);

    async function handleCancel(id: string) {
      try {
        await api.delete(`/admin/sklep/${productId}/reservations/${id}`);
        setReservations(prev => prev.filter(r => r.id !== id));
        log.info("op=cancelReservation outcome=ok", { productId, id });
      } catch (err) {
        log.error("op=cancelReservation outcome=error", { productId, id, err: String(err) });
      }
    }

    return (
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed var(--line)" }}>
        <div className="t-stencil mb-2" style={{ fontSize: 12, letterSpacing: ".1em" }}>
          Rezerwacje · {loading ? "…" : reservations.length}
        </div>
        {!loading && reservations.length === 0 && (
          <div className="t-mono opacity-55" style={{ fontSize: 11 }}>Brak rezerwacji</div>
        )}
        <div className="flex flex-col gap-2">
          {reservations.map((r, i) => (
            <div key={r.id} className="admin-card flex flex-col gap-1" style={{ padding: 10 }}>
              <div className="flex justify-between items-center">
                <span style={{ fontWeight: 600, fontSize: 13 }}>{i + 1}. {r.clientName}</span>
                <span className="t-mono opacity-50" style={{ fontSize: 10 }}>
                  {new Date(r.reservedAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              {r.phone && <div className="t-mono" style={{ fontSize: 11, color: "rgba(0,0,0,0.7)" }}>{r.phone}</div>}
              {r.note && <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)" }}>„{r.note}"</div>}
              <div className="flex gap-1.5 mt-1">
                <button className="btn-clean" style={{ fontSize: 11, padding: "3px 8px" }} type="button">potwierdź sprzedaż</button>
                <button className="btn-clean" style={{ fontSize: 11, padding: "3px 8px" }} type="button">{I.send} pisz</button>
                <button
                  className="btn-clean"
                  style={{ fontSize: 11, padding: "3px 8px", color: "var(--red)", borderColor: "var(--red)" }}
                  type="button"
                  onClick={() => handleCancel(r.id)}
                  aria-label={`anuluj rezerwację ${r.clientName}`}
                >
                  anuluj
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 5: Wire `<ReservationsQueue>` into `ProductEditPanel.tsx` + run all tests GREEN**

  In `ProductEditPanel.tsx`, add the import and wire-up:

  ```tsx
  // Add import at top:
  import { ReservationsQueue } from "./ReservationsQueue";

  // Replace the comment placeholder after the status chips field:
  // {/* ReservationsQueue inserted by task 9-34 below the status chips */}
  // With:
  <ReservationsQueue productId={product.id} />
  ```

  Run backend tests:
  ```bash
  cd /path/to/backend && mvn -pl app test -Dtest="ProductReservationControllerIntegrationTest" -q
  ```

  Run frontend tests:
  ```bash
  pnpm --filter web test -- --run sklep
  ```

  Confirm all 400+ backend tests still pass:
  ```bash
  mvn -pl app test -q
  ```

  Commit:
  ```
  feat(sklep): ReservationsQueue + backend endpoint V016 + ProductReservationController [milestone:9][task:9-34]

  Adds GET /api/admin/sklep/{productId}/reservations and
  DELETE /api/admin/sklep/{productId}/reservations/{id}.
  Frontend ReservationsQueue wired into ProductEditPanel.

  Refs: docs/dispatch-log/9-34-<UTC>.md
  ```
# Wave 7 — Public landing (9-35 .. 9-40)

> **Subagent reading order (mandatory before any implementation):**
> 1. Read `docs/superpowers/specs/2026-05-15-milestone-09-design-parity-design.md` sections 5 and 7.
> 2. Read `handoff/design/landing.jsx` — full file, the canonical design reference.
> 3. Read `apps/web/app/(public)/page.tsx` — current 9-line placeholder to be replaced.
> 4. Read `apps/web/app/layout.tsx` — existing font wiring (note: `--font-stencil` is added in Wave 1 task 9-1; Wave 7 may be dispatched after Wave 1 lands).
> 5. Read your assigned task section below and write `docs/dispatch-log/<task-id>-<UTC>.md`.
>
> **Precondition:** Wave 1 (9-1 through 9-14) must be merged first. All primitives (`Tape`, `Stamp`, `Sticker`, `PhImg`, `Splatter`, `DrShoesMark`, `Button`, `I` icons) must be importable from `@repo/ui` before this wave executes.
>
> **Errata / locked decisions for Wave 7:**
> 1. The public `(public)` route group has only `page.tsx`; there is no `(public)/sklep/page.tsx` or `(public)/aktualnosci/page.tsx` — those stubs do NOT yet exist. The landing links to `#sklep` and `#aktualnosci` anchors on the same page (not `/sklep`, `/aktualnosci` routes). This is correct per spec section 5.
> 2. The design's `Kontakt` section uses `bg: var(--paper-2)` and `I.pin`, `I.phone`, `I.mail`, `I.ig`, `I.clock` icons. The task spec says `bg-ink text-paper` for Contact — follow the **task spec** wording in 9-40 (it diverges from the design reference at that detail); the inline contact form from `landing.jsx` is a separate concern and is out of scope for 9-40 (spec says address/hours/contact rows + map placeholder only).
> 3. LOC cap is 80 LOC per TS module. Every component that would exceed 80 LOC must be split into a sub-component file under the same `_components/` directory.
> 4. All commits: `feat(public): <subject> [milestone:9][task:9-N]` with `Refs: docs/dispatch-log/9-N-<UTC>.md` in body.
> 5. Every new `.tsx` file must include a named logger: `const log = logger('public/<ComponentName>');` using `lib/log.ts` — per dispatch-protocol clause #7.
> 6. No `Co-Authored-By:` lines in any commit.

---

## Task 9-35 — `<StickyNav>`

**File to create:** `apps/web/app/(public)/_components/StickyNav.tsx`  
**Test file:** `apps/web/app/(public)/_components/__tests__/StickyNav.test.tsx`

**Description:** Sticky top navigation bar for the public landing — ink background, acid bottom border, DrShoesMark brand logo on the left, stencil-font anchor links and a CTA "Zamów" button on the right.

---

### Step 1 — RED: write failing tests

Create `apps/web/app/(public)/_components/__tests__/StickyNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StickyNav } from '../StickyNav';

describe('StickyNav', () => {
  it('matches snapshot', () => {
    const { container } = render(<StickyNav />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('Aktualności link points to #aktualnosci', () => {
    render(<StickyNav />);
    expect(screen.getByRole('link', { name: /Aktualności/i }))
      .toHaveAttribute('href', '#aktualnosci');
  });

  it('Sklep link points to #sklep', () => {
    render(<StickyNav />);
    expect(screen.getByRole('link', { name: /Sklep/i }))
      .toHaveAttribute('href', '#sklep');
  });

  it('Kontakt link points to #kontakt', () => {
    render(<StickyNav />);
    expect(screen.getByRole('link', { name: /Kontakt/i }))
      .toHaveAttribute('href', '#kontakt');
  });

  it('Zamów CTA points to #zamow', () => {
    render(<StickyNav />);
    expect(screen.getByRole('link', { name: /Zamów/i }))
      .toHaveAttribute('href', '#zamow');
  });
});
```

Run tests — expect 5 failures (module not found):

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/StickyNav.test.tsx 2>&1 | tail -20
```

---

### Step 2 — GREEN: implement `StickyNav.tsx`

Create `apps/web/app/(public)/_components/StickyNav.tsx` (target ≤ 50 LOC):

```tsx
'use client';

import { DrShoesMark, Button } from '@repo/ui';
import * as I from '@repo/ui/icons';
import { logger } from '@/lib/log';

const log = logger('public/StickyNav');

export function StickyNav() {
  log.debug('op=StickyNav.render');

  return (
    <header
      className="sticky top-0 z-50 bg-ink text-paper border-b-[3px] border-acid"
    >
      <div className="max-w-[1280px] mx-auto py-3 px-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DrShoesMark size={0.42} color="var(--paper)" accent="var(--acid)" />
        </div>
        <nav className="flex gap-7 items-center font-stencil text-sm uppercase tracking-[0.1em] font-bold">
          <a href="#aktualnosci" className="text-paper no-underline hover:text-acid transition-colors">
            Aktualności
          </a>
          <a href="#sklep" className="text-paper no-underline hover:text-acid transition-colors">
            Sklep
          </a>
          <a href="#kontakt" className="text-paper no-underline hover:text-acid transition-colors">
            Kontakt
          </a>
          <Button variant="acid" size="sm" asChild>
            <a href="#zamow" className="flex items-center gap-1.5">
              <I.sprayCan size={14} />
              Zamów
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
```

---

### Step 3 — GREEN verification

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/StickyNav.test.tsx 2>&1 | tail -20
```

Expected: 5 tests pass.

---

### Step 4 — REFACTOR check

- Confirm file is ≤ 80 LOC: `wc -l apps/web/app/\(public\)/_components/StickyNav.tsx`
- Confirm TypeScript compiles: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30`

---

### Step 5 — Commit

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add apps/web/app/\(public\)/_components/StickyNav.tsx \
        apps/web/app/\(public\)/_components/__tests__/StickyNav.test.tsx
git commit -m "$(cat <<'EOF'
feat(public): add StickyNav for landing — ink/acid ribbon with stencil nav links [milestone:9][task:9-35]

Refs: docs/dispatch-log/9-35-<UTC>.md
EOF
)"
```

Write dispatch log to `docs/dispatch-log/9-35-<UTC>.md` with: files created, test summary (5/5), decisions (Button asChild pattern for CTA anchor), commit SHA.

---

## Task 9-36 — `<Hero>`

**Files to create:**
- `apps/web/app/(public)/_components/Hero.tsx`
- `apps/web/app/(public)/_components/__tests__/Hero.test.tsx`

**Description:** Full-bleed ink-background hero section. PhImg dark background, two Splatter overlays (acid top-right, pink bottom-left), two Tape labels, large display headline, tag-font tagline, two CTA buttons, and an absolute sticker+scroll cue at the bottom right.

---

### Step 1 — RED: write failing tests

Create `apps/web/app/(public)/_components/__tests__/Hero.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Hero } from '../Hero';

describe('Hero', () => {
  it('matches snapshot', () => {
    const { container } = render(<Hero />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders the Dr.Shoes headline', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders two Splatter elements', () => {
    const { container } = render(<Hero />);
    // Splatter renders an SVG with data-testid="splatter"
    const splatters = container.querySelectorAll('[data-testid="splatter"]');
    expect(splatters.length).toBe(2);
  });

  it('"Zamów custom" CTA links to #zamow', () => {
    render(<Hero />);
    expect(
      screen.getByRole('link', { name: /Zamów custom/i })
    ).toHaveAttribute('href', '#zamow');
  });

  it('"Oddaj buty do naprawy" CTA links to #zamow', () => {
    render(<Hero />);
    expect(
      screen.getByRole('link', { name: /Oddaj buty do naprawy/i })
    ).toHaveAttribute('href', '#zamow');
  });
});
```

Run — expect 5 failures:

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/Hero.test.tsx 2>&1 | tail -20
```

---

### Step 2 — GREEN: implement `Hero.tsx`

Create `apps/web/app/(public)/_components/Hero.tsx` (target ≤ 78 LOC):

```tsx
import { PhImg, Splatter, Tape, Sticker, Button } from '@repo/ui';
import * as I from '@repo/ui/icons';
import { logger } from '@/lib/log';

const log = logger('public/Hero');

export function Hero() {
  log.debug('op=Hero.render');

  return (
    <section
      id="zamow"
      className="relative overflow-hidden bg-ink text-paper"
    >
      {/* full-bleed background */}
      <div className="absolute inset-0">
        <PhImg
          dark
          label="HERO REEL · workshop b-roll · custom AF1 closeup"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>

      {/* splatters */}
      <Splatter
        color="var(--acid)"
        size={420}
        style={{ top: -80, right: -60, opacity: 0.85 }}
      />
      <Splatter
        color="var(--pink)"
        size={280}
        style={{ bottom: -40, left: 120, opacity: 0.65 }}
      />

      {/* content */}
      <div className="relative max-w-[1280px] mx-auto px-7 py-[120px_28px_110px]">
        {/* tape labels row */}
        <div className="flex gap-3 items-center mb-6">
          <Tape>est. 2014 · Wrocław</Tape>
          <Tape color="pink" angle={1.5}>pracownia · nie sklep</Tape>
        </div>

        {/* headline */}
        <h1
          className="t-display text-paper m-0"
          style={{ fontSize: 'clamp(96px, 14vw, 220px)' }}
        >
          Dr
          <span style={{ color: 'var(--acid)', WebkitTextStroke: '3px var(--paper)' }}>
            .
          </span>
          Shoes
        </h1>

        {/* tagline */}
        <div
          className="t-tag text-acid"
          style={{ fontSize: 36, transform: 'rotate(-2deg)', marginTop: -6, marginLeft: 8 }}
        >
          customy · naprawy · malowanie — robione ręcznie
        </div>

        {/* CTA buttons */}
        <div className="flex gap-3.5 mt-11 flex-wrap">
          <Button variant="acid" size="lg" asChild>
            <a href="#zamow" className="flex items-center gap-2">
              <I.sprayCan size={18} />
              Zamów custom
            </a>
          </Button>
          <Button variant="paper" size="lg" asChild>
            <a href="#zamow">Oddaj buty do naprawy</a>
          </Button>
        </div>

        {/* bottom-right sticker + scroll cue */}
        <div className="absolute right-7 bottom-[30px] flex flex-col items-end gap-2">
          <Sticker>
            <span
              className="inline-block w-1.5 h-1.5 bg-acid rounded-full mr-1"
            />
            @dr_shoes · 38.4k
          </Sticker>
          <div
            className="t-mono text-paper"
            style={{ fontSize: 12, opacity: 0.55, letterSpacing: '.15em' }}
          >
            ↓ scroll
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

### Step 3 — GREEN verification

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/Hero.test.tsx 2>&1 | tail -20
```

Expected: 5 tests pass.

---

### Step 4 — REFACTOR check

- `wc -l apps/web/app/\(public\)/_components/Hero.tsx` — must be ≤ 80
- `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30`

---

### Step 5 — Commit

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add apps/web/app/\(public\)/_components/Hero.tsx \
        apps/web/app/\(public\)/_components/__tests__/Hero.test.tsx
git commit -m "$(cat <<'EOF'
feat(public): add Hero section — full-bleed dark background, splatters, display headline, dual CTAs [milestone:9][task:9-36]

Refs: docs/dispatch-log/9-36-<UTC>.md
EOF
)"
```

Write dispatch log to `docs/dispatch-log/9-36-<UTC>.md`.

---

## Task 9-37 — `<Services>`

**Files to create:**
- `apps/web/app/(public)/_components/Services.tsx`
- `apps/web/app/(public)/_components/ServiceTile.tsx` (sub-component, extracted to keep LOC ≤ 80 each)
- `apps/web/app/(public)/_components/__tests__/Services.test.tsx`

**Description:** Paper-background section showcasing three service categories (Naprawa butów / Custom malowanie butów / Custom kurtki). Header with tape + h2. 3-column grid of `<ServiceTile>` cards — each a 3:4 aspect PhImg with a large tag number, Tape label at bottom-left, and icon badge at bottom-right.

---

### Step 1 — RED: write failing tests

Create `apps/web/app/(public)/_components/__tests__/Services.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Services } from '../Services';

describe('Services', () => {
  it('matches snapshot', () => {
    const { container } = render(<Services />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders 3 service tiles', () => {
    render(<Services />);
    const tiles = screen.getAllByRole('link');
    // All 3 tiles are <a href="#zamow">
    expect(tiles.filter(el => el.getAttribute('href') === '#zamow').length).toBe(3);
  });

  it('renders tile for Naprawa butów', () => {
    render(<Services />);
    expect(screen.getByText('Naprawa butów')).toBeInTheDocument();
  });

  it('renders tile for Custom malowanie butów', () => {
    render(<Services />);
    expect(screen.getByText('Custom malowanie butów')).toBeInTheDocument();
  });

  it('renders tile for Custom kurtki', () => {
    render(<Services />);
    expect(screen.getByText('Custom kurtki')).toBeInTheDocument();
  });
});
```

Run — expect 5 failures:

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/Services.test.tsx 2>&1 | tail -20
```

---

### Step 2 — GREEN: implement `ServiceTile.tsx` (sub-component)

Create `apps/web/app/(public)/_components/ServiceTile.tsx` (≤ 50 LOC):

```tsx
import { PhImg, Tape } from '@repo/ui';
import type { FC, ComponentType } from 'react';

interface ServiceTileProps {
  tag: '01' | '02' | '03';
  label: string;
  imgLabel: string;
  accentColor: string;
  tapeColor: 'acid' | 'pink' | 'blue';
  Icon: ComponentType<{ size: number }>;
}

export const ServiceTile: FC<ServiceTileProps> = ({
  tag, label, imgLabel, accentColor, tapeColor, Icon,
}) => (
  <a
    href="#zamow"
    className="zoom-card relative border-[3px] border-ink overflow-hidden bg-paper-2 no-underline text-ink shadow-[8px_8px_0_var(--ink)]"
    style={{ aspectRatio: '3/4', display: 'block' }}
  >
    <PhImg
      dark
      label={imgLabel}
      style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }}
    />
    {/* tag number */}
    <div
      className="absolute top-3.5 left-3.5 t-display leading-none"
      style={{ fontSize: 64, color: accentColor, mixBlendMode: 'screen' }}
    >
      {tag}
    </div>
    {/* bottom row: tape label + icon badge */}
    <div className="absolute left-3.5 right-3.5 bottom-3.5 flex items-end justify-between">
      <Tape color={tapeColor} angle={-2}>{label}</Tape>
      <div className="bg-paper p-2 border-[2px] border-ink text-ink">
        <Icon size={26} />
      </div>
    </div>
  </a>
);
```

---

### Step 3 — GREEN: implement `Services.tsx`

Create `apps/web/app/(public)/_components/Services.tsx` (≤ 55 LOC):

```tsx
import { Tape } from '@repo/ui';
import * as I from '@repo/ui/icons';
import { ServiceTile } from './ServiceTile';
import { logger } from '@/lib/log';

const log = logger('public/Services');

const SERVICES = [
  {
    tag: '01' as const,
    label: 'Naprawa butów',
    imgLabel: 'naprawa · vibram doszyty',
    accentColor: 'var(--acid)',
    tapeColor: 'acid' as const,
    Icon: I.shoe,
  },
  {
    tag: '02' as const,
    label: 'Custom malowanie butów',
    imgLabel: 'custom · AF1 bandana',
    accentColor: 'var(--pink)',
    tapeColor: 'pink' as const,
    Icon: I.brush,
  },
  {
    tag: '03' as const,
    label: 'Custom kurtki',
    imgLabel: 'custom · Carhartt back',
    accentColor: 'var(--blue)',
    tapeColor: 'blue' as const,
    Icon: I.jacket,
  },
] as const;

export function Services() {
  log.debug('op=Services.render');

  return (
    <section className="py-[100px_28px_120px] bg-paper relative">
      <div className="max-w-[1280px] mx-auto">
        {/* header row */}
        <div className="flex justify-between items-end mb-9 flex-wrap gap-4">
          <div>
            <Tape color="paper" angle={-2}>co robimy</Tape>
            <h2 className="t-display m-0 mt-4" style={{ fontSize: 96 }}>
              Trzy <span style={{ color: 'var(--pink)' }}>rzeczy</span>.
              <br />Robimy je dobrze.
            </h2>
          </div>
          <p
            className="t-mono"
            style={{ fontSize: 13, maxWidth: 360, color: 'rgba(0,0,0,0.7)', lineHeight: 1.5 }}
          >
            Każda para to inna historia. Przed wyceną pisz na DM lub wypełnij
            formularz — odpowiadamy w 24h.
          </p>
        </div>

        {/* 3-col grid */}
        <div className="grid grid-cols-3 gap-[22px]">
          {SERVICES.map(s => (
            <ServiceTile key={s.tag} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

### Step 4 — GREEN verification

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/Services.test.tsx 2>&1 | tail -20
```

Expected: 5 tests pass.

Confirm LOC:

```bash
wc -l apps/web/app/\(public\)/_components/Services.tsx \
       apps/web/app/\(public\)/_components/ServiceTile.tsx
```

Both must be ≤ 80 LOC.

---

### Step 5 — Commit

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add apps/web/app/\(public\)/_components/Services.tsx \
        apps/web/app/\(public\)/_components/ServiceTile.tsx \
        apps/web/app/\(public\)/_components/__tests__/Services.test.tsx
git commit -m "$(cat <<'EOF'
feat(public): add Services section — 3-col graffiti tile grid with service categories [milestone:9][task:9-37]

Refs: docs/dispatch-log/9-37-<UTC>.md
EOF
)"
```

Write dispatch log to `docs/dispatch-log/9-37-<UTC>.md`.

---

## Task 9-38 — `<NewsTeaser>`

**Files to create:**
- `apps/web/app/(public)/_components/NewsTeaser.tsx`
- `apps/web/app/(public)/_components/NewsTeaserCard.tsx` (sub-component)
- `apps/web/app/(public)/_components/__tests__/NewsTeaser.test.tsx`

**Description:** Ink-background news section. Pink Splatter top-left. Grid layout: 1 large hero article (spans 2 rows, spray-frame pink) + 3 smaller cards. All data is static placeholder — real news unlocks with the Aktualności stub.

---

### Step 1 — RED: write failing tests

Create `apps/web/app/(public)/_components/__tests__/NewsTeaser.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NewsTeaser } from '../NewsTeaser';

describe('NewsTeaser', () => {
  it('matches snapshot', () => {
    const { container } = render(<NewsTeaser />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders exactly 1 hero article (large tile)', () => {
    const { container } = render(<NewsTeaser />);
    // hero tile has spray-frame class
    expect(container.querySelectorAll('.spray-frame').length).toBe(1);
  });

  it('renders 3 small news cards', () => {
    render(<NewsTeaser />);
    // All 4 articles are rendered; 3 small ones do not have "spray-frame"
    const { container } = render(<NewsTeaser />);
    const smallCards = container.querySelectorAll('article:not(.spray-frame)');
    expect(smallCards.length).toBe(3);
  });

  it('has a section anchor id="aktualnosci"', () => {
    const { container } = render(<NewsTeaser />);
    expect(container.querySelector('#aktualnosci')).toBeInTheDocument();
  });

  it('renders "Wszystkie wpisy" link', () => {
    render(<NewsTeaser />);
    expect(screen.getByRole('link', { name: /Wszystkie wpisy/i })).toBeInTheDocument();
  });
});
```

Run — expect 5 failures:

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/NewsTeaser.test.tsx 2>&1 | tail -20
```

---

### Step 2 — GREEN: implement `NewsTeaserCard.tsx` (sub-component, ≤ 55 LOC)

Create `apps/web/app/(public)/_components/NewsTeaserCard.tsx`:

```tsx
import { PhImg, Stamp } from '@repo/ui';

export interface NewsEntry {
  date: string;
  title: string;
  excerpt: string;
}

interface NewsTeaserCardProps {
  entry: NewsEntry;
  hero?: boolean;
  index: number;
}

export function NewsTeaserCard({ entry, hero = false, index }: NewsTeaserCardProps) {
  if (hero) {
    return (
      <article
        className="zoom-card spray-frame pink bg-paper text-ink"
        style={{ border: 'none', padding: 0, gridRow: 'span 2' }}
      >
        <div
          className="overflow-hidden border-b-[3px] border-ink"
          style={{ aspectRatio: '16/10' }}
        >
          <PhImg
            label="news cover · workshop fresh paint"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
        <div className="p-[26px] relative">
          <div className="absolute" style={{ top: -22, right: 24 }}>
            <Stamp color="pink" angle={3}>świeże</Stamp>
          </div>
          <div
            className="t-mono"
            style={{ fontSize: 12, letterSpacing: '.1em', color: 'rgba(0,0,0,0.55)' }}
          >
            {entry.date} · pracownia
          </div>
          <h3
            className="t-display"
            style={{ fontSize: 38, margin: '10px 0 12px', lineHeight: 1 }}
          >
            {entry.title}
          </h3>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: 'rgba(0,0,0,0.78)', margin: 0 }}>
            {entry.excerpt}
          </p>
          <div className="mt-4">
            <a className="btn btn-paper btn-sm" href="#">czytaj →</a>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className="zoom-card bg-paper text-ink border-[3px] border-paper"
      key={index}
    >
      <div className="overflow-hidden border-b-[3px] border-ink" style={{ aspectRatio: '4/3' }}>
        <PhImg
          label={`news · ${index}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
      <div className="p-[18px]">
        <div className="t-mono" style={{ fontSize: 11, letterSpacing: '.1em', color: 'rgba(0,0,0,0.55)' }}>
          {entry.date}
        </div>
        <h4 className="t-display" style={{ fontSize: 22, margin: '8px 0 8px', lineHeight: 1 }}>
          {entry.title}
        </h4>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(0,0,0,0.7)', margin: 0 }}>
          {entry.excerpt}
        </p>
        <a
          className="t-mono"
          href="#"
          style={{
            display: 'inline-block',
            marginTop: 12,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--ink)',
            borderBottom: '2px solid var(--acid)',
          }}
        >
          czytaj →
        </a>
      </div>
    </article>
  );
}
```

---

### Step 3 — GREEN: implement `NewsTeaser.tsx` (≤ 60 LOC)

Create `apps/web/app/(public)/_components/NewsTeaser.tsx`:

```tsx
import { Tape, Splatter, Button } from '@repo/ui';
import { NewsTeaserCard, type NewsEntry } from './NewsTeaserCard';
import { logger } from '@/lib/log';

const log = logger('public/NewsTeaser');

// Static placeholder data — real news loads when Aktualności stub unlocks (out of M9 scope)
const NEWS: NewsEntry[] = [
  {
    date: '12.05.2026',
    title: 'Nowe customowe Air Force 1 — projekt bandana',
    excerpt:
      'Właśnie wyszło z pracowni. Ręcznie malowany wzór inspirowany chustami bandana. Na zamówienie.',
  },
  {
    date: '08.05.2026',
    title: 'Naprawa Timberland — nowe vibram',
    excerpt: 'Klasyczna robota. Nowa podeszwa vibram, wkładka i regeneracja skóry.',
  },
  {
    date: '04.05.2026',
    title: 'Custom kurtka — Carhartt Detroit',
    excerpt: 'Back piece z logiem pracowni. Malarstwo na tkaninie, utrwalane termicznie.',
  },
  {
    date: '28.04.2026',
    title: 'Jordan 1 — malowanie niebieskie',
    excerpt: 'Dla klienta który chciał coś podobnego do Off-White ale swojego.',
  },
];

export function NewsTeaser() {
  log.debug('op=NewsTeaser.render');
  const [hero, ...rest] = NEWS;

  return (
    <section
      id="aktualnosci"
      className="py-[100px_28px] bg-ink text-paper relative overflow-hidden"
    >
      <Splatter
        color="var(--pink)"
        size={300}
        style={{ top: -60, left: -40, opacity: 0.4 }}
      />
      <div className="max-w-[1280px] mx-auto relative">
        {/* header */}
        <div className="flex justify-between items-end mb-9">
          <div>
            <Tape color="acid">aktualności</Tape>
            <h2 className="t-display m-0 mt-4" style={{ fontSize: 96 }}>
              Co się <span style={{ color: 'var(--acid)' }}>dzieje</span>
            </h2>
          </div>
          <Button variant="acid" size="sm" asChild>
            <a href="#">Wszystkie wpisy →</a>
          </Button>
        </div>

        {/* grid: 2fr 1fr 1fr */}
        <div
          className="grid gap-[22px]"
          style={{ gridTemplateColumns: '2fr 1fr 1fr' }}
        >
          <NewsTeaserCard entry={hero} hero index={0} />
          {rest.map((n, i) => (
            <NewsTeaserCard key={n.date} entry={n} index={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

### Step 4 — GREEN verification

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/NewsTeaser.test.tsx 2>&1 | tail -20
```

Expected: 5 tests pass.

```bash
wc -l apps/web/app/\(public\)/_components/NewsTeaser.tsx \
       apps/web/app/\(public\)/_components/NewsTeaserCard.tsx
```

Both must be ≤ 80 LOC.

---

### Step 5 — Commit

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add apps/web/app/\(public\)/_components/NewsTeaser.tsx \
        apps/web/app/\(public\)/_components/NewsTeaserCard.tsx \
        apps/web/app/\(public\)/_components/__tests__/NewsTeaser.test.tsx
git commit -m "$(cat <<'EOF'
feat(public): add NewsTeaser section — ink bg, hero + 3 small tiles, static placeholder data [milestone:9][task:9-38]

Refs: docs/dispatch-log/9-38-<UTC>.md
EOF
)"
```

Write dispatch log to `docs/dispatch-log/9-38-<UTC>.md`.

---

## Task 9-39 — `<SklepTeaser>`

**Files to create:**
- `apps/web/app/(public)/_components/SklepTeaser.tsx`
- `apps/web/app/(public)/_components/ProductTile.tsx` (sub-component)
- `apps/web/app/(public)/_components/__tests__/SklepTeaser.test.tsx`

**Description:** Paper-background shop teaser. "sklep" Tape + display headline + notice box. Non-functional filter pills row (design demo only — real Sklep page is a locked stub). 4-tile product grid with `<Stamp>` overlays. All data static placeholder.

---

### Step 1 — RED: write failing tests

Create `apps/web/app/(public)/_components/__tests__/SklepTeaser.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SklepTeaser } from '../SklepTeaser';

describe('SklepTeaser', () => {
  it('matches snapshot', () => {
    const { container } = render(<SklepTeaser />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders 4 product tiles', () => {
    const { container } = render(<SklepTeaser />);
    // Each ProductTile renders a div with data-testid="product-tile"
    expect(container.querySelectorAll('[data-testid="product-tile"]').length).toBe(4);
  });

  it('renders filter pill for Nike', () => {
    render(<SklepTeaser />);
    expect(screen.getByRole('button', { name: 'Nike' })).toBeInTheDocument();
  });

  it('renders filter pill for Vans', () => {
    render(<SklepTeaser />);
    expect(screen.getByRole('button', { name: 'Vans' })).toBeInTheDocument();
  });

  it('renders the notice box with payment info', () => {
    render(<SklepTeaser />);
    expect(screen.getByText(/Płatność i odbiór wyłącznie/i)).toBeInTheDocument();
  });
});
```

Run — expect 5 failures:

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/SklepTeaser.test.tsx 2>&1 | tail -20
```

---

### Step 2 — GREEN: implement `ProductTile.tsx` (sub-component, ≤ 60 LOC)

Create `apps/web/app/(public)/_components/ProductTile.tsx`:

```tsx
import { PhImg, Stamp } from '@repo/ui';

export type ProductStatus = 'dostępne' | 'zarezerwowane' | 'sprzedane';

export interface ProductEntry {
  id: string;
  name: string;
  brand: string;
  size: string;
  price: string;
  status: ProductStatus;
}

interface ProductTileProps {
  product: ProductEntry;
  index: number;
}

const stampForStatus = (s: ProductStatus) => {
  if (s === 'dostępne') return <Stamp color="green">dostępne</Stamp>;
  if (s === 'zarezerwowane') return <Stamp color="pink">rezerwacja</Stamp>;
  return <Stamp color="ink" angle={-3}>sprzedane</Stamp>;
};

export function ProductTile({ product, index }: ProductTileProps) {
  return (
    <div
      data-testid="product-tile"
      className="zoom-card bg-paper border-[3px] border-ink relative"
      style={{ boxShadow: '6px 6px 0 var(--ink)' }}
    >
      <div
        className="overflow-hidden border-b-[3px] border-ink relative"
        style={{ aspectRatio: '1/1' }}
      >
        <PhImg
          label={`${product.brand}\n${product.name}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
        <div className="absolute top-3.5 left-3.5">{stampForStatus(product.status)}</div>
        <div
          className="absolute top-3.5 right-3.5 t-mono text-paper bg-ink"
          style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px' }}
        >
          #{String(index + 1).padStart(2, '0')}
        </div>
      </div>
      <div className="p-[18px] flex flex-col gap-1.5">
        <div
          className="t-mono"
          style={{ fontSize: 11, color: 'rgba(0,0,0,0.55)', letterSpacing: '.1em' }}
        >
          {product.brand} · {product.size}
        </div>
        <h4 className="t-display m-0" style={{ fontSize: 24, lineHeight: 1 }}>
          {product.name}
        </h4>
        <div className="t-display mt-2.5" style={{ fontSize: 30 }}>
          {product.price}
        </div>
      </div>
    </div>
  );
}
```

---

### Step 3 — GREEN: implement `SklepTeaser.tsx` (≤ 75 LOC)

Create `apps/web/app/(public)/_components/SklepTeaser.tsx`:

```tsx
import { Tape } from '@repo/ui';
import { ProductTile, type ProductEntry } from './ProductTile';
import { logger } from '@/lib/log';

const log = logger('public/SklepTeaser');

// Static placeholder data — real data loads when Sklep stub unlocks (out of M9 scope)
const PRODUCTS: ProductEntry[] = [
  { id: 'p1', name: 'AF1 Bandana Custom', brand: 'Nike', size: 'EU 42', price: '850 zł', status: 'dostępne' },
  { id: 'p2', name: 'Old Skool Painted', brand: 'Vans', size: 'EU 41', price: '620 zł', status: 'zarezerwowane' },
  { id: 'p3', name: 'Jordan 1 Blue', brand: 'Jordan', size: 'EU 43', price: '1100 zł', status: 'dostępne' },
  { id: 'p4', name: '1460 Restored', brand: 'Dr. Martens', size: 'EU 40', price: '480 zł', status: 'sprzedane' },
];

const FILTERS = ['Wszystkie', 'Nike', 'Vans', 'Jordan', 'Dr. Martens'] as const;

export function SklepTeaser() {
  log.debug('op=SklepTeaser.render');

  return (
    <section id="sklep" className="py-[100px_28px] bg-paper relative">
      <div className="max-w-[1280px] mx-auto">
        {/* header row */}
        <div className="flex justify-between items-end mb-7 flex-wrap gap-4">
          <div>
            <Tape color="pink">sklep</Tape>
            <h2 className="t-display m-0 mt-4" style={{ fontSize: 96 }}>
              Pary <span style={{ color: 'var(--blue)' }}>do wzięcia</span>
            </h2>
          </div>
          <div
            className="t-mono border-[2px] border-ink bg-paper-2"
            style={{ fontSize: 12, maxWidth: 320, color: 'rgba(0,0,0,0.65)', lineHeight: 1.5, padding: '10px 14px' }}
          >
            ⚠ Płatność i odbiór wyłącznie na miejscu w pracowni.
            Rezerwacja jest niezobowiązująca przez 48h.
          </div>
        </div>

        {/* filter pills — non-functional placeholder for design fidelity */}
        <div className="flex gap-3.5 mb-7 flex-wrap items-center">
          <span className="t-mono" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.55)' }}>
            filtruj:
          </span>
          {FILTERS.map((f, i) => (
            <button
              key={f}
              type="button"
              className="t-mono font-bold border-[2px] border-ink bg-paper uppercase"
              style={{
                padding: '6px 16px',
                fontSize: 12,
                letterSpacing: '.05em',
                cursor: 'pointer',
                transform: `rotate(${(i % 2 ? 1 : -1) * 1.2}deg)`,
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* 4-tile product grid */}
        <div className="grid grid-cols-4 gap-4">
          {PRODUCTS.map((p, i) => (
            <ProductTile key={p.id} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

### Step 4 — GREEN verification

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/SklepTeaser.test.tsx 2>&1 | tail -20
```

Expected: 5 tests pass.

```bash
wc -l apps/web/app/\(public\)/_components/SklepTeaser.tsx \
       apps/web/app/\(public\)/_components/ProductTile.tsx
```

Both must be ≤ 80 LOC.

---

### Step 5 — Commit

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add apps/web/app/\(public\)/_components/SklepTeaser.tsx \
        apps/web/app/\(public\)/_components/ProductTile.tsx \
        apps/web/app/\(public\)/_components/__tests__/SklepTeaser.test.tsx
git commit -m "$(cat <<'EOF'
feat(public): add SklepTeaser section — 4-tile product grid with stamps, non-functional filter pills [milestone:9][task:9-39]

Refs: docs/dispatch-log/9-39-<UTC>.md
EOF
)"
```

Write dispatch log to `docs/dispatch-log/9-39-<UTC>.md`.

---

## Task 9-40 — `<Contact>` + `<Footer>` + compose `page.tsx`

**Files to create:**
- `apps/web/app/(public)/_components/Contact.tsx`
- `apps/web/app/(public)/_components/Footer.tsx`
- `apps/web/app/(public)/_components/__tests__/Contact.test.tsx`
- `apps/web/app/(public)/_components/__tests__/Footer.test.tsx`
- Modify: `apps/web/app/(public)/page.tsx` — compose all 6 public components
- Create: `apps/web/e2e/public-landing.spec.ts` — Playwright smoke

**Description:** `<Contact>` renders the workshop address, hours, and contact rows in a 2-column grid (info sticker board left, map iframe right). `<Footer>` is a minimal mono bar. `page.tsx` is updated to compose StickyNav + Hero + Services + NewsTeaser + SklepTeaser + Contact + Footer. Playwright spec verifies anchor targets and hero CTAs.

---

### Step 1 — RED: write failing unit tests

Create `apps/web/app/(public)/_components/__tests__/Contact.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Contact } from '../Contact';

describe('Contact', () => {
  it('matches snapshot', () => {
    const { container } = render(<Contact />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders section with id="kontakt"', () => {
    const { container } = render(<Contact />);
    expect(container.querySelector('#kontakt')).toBeInTheDocument();
  });

  it('renders workshop address', () => {
    render(<Contact />);
    expect(screen.getByText(/ul\. Włodkowica/i)).toBeInTheDocument();
  });

  it('renders workshop hours', () => {
    render(<Contact />);
    expect(screen.getByText(/Pn.+11/i)).toBeInTheDocument();
  });

  it('renders phone number', () => {
    render(<Contact />);
    expect(screen.getByText(/\+48 794 220 118/)).toBeInTheDocument();
  });
});
```

Create `apps/web/app/(public)/_components/__tests__/Footer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Footer } from '../Footer';

describe('Footer', () => {
  it('matches snapshot', () => {
    const { container } = render(<Footer />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders copyright text', () => {
    render(<Footer />);
    expect(screen.getByText(/© 2026 Dr Shoes/i)).toBeInTheDocument();
  });

  it('renders "made with paint & duct tape"', () => {
    render(<Footer />);
    expect(screen.getByText(/made with paint & duct tape/i)).toBeInTheDocument();
  });
});
```

Run — expect 8 failures:

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/Contact.test.tsx \
                apps/web/app/\(public\)/_components/__tests__/Footer.test.tsx 2>&1 | tail -20
```

---

### Step 2 — GREEN: implement `Contact.tsx` (≤ 78 LOC)

Create `apps/web/app/(public)/_components/Contact.tsx`:

```tsx
import { Tape, Sticker, Stamp } from '@repo/ui';
import * as I from '@repo/ui/icons';
import { logger } from '@/lib/log';

const log = logger('public/Contact');

export function Contact() {
  log.debug('op=Contact.render');

  return (
    <section id="kontakt" className="py-[100px_28px] bg-ink text-paper relative">
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-9">
          <Tape color="acid">kontakt</Tape>
          <h2 className="t-display m-0 mt-4" style={{ fontSize: 96 }}>
            Wpadnij<br /><span style={{ color: 'var(--pink)' }}>do nas</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-12">
          {/* left: sticker board */}
          <div
            className="bg-paper text-ink border-[3px] border-ink p-7 relative"
            style={{
              boxShadow: '8px 8px 0 var(--ink)',
              backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1.2px, transparent 1.6px)',
              backgroundSize: '12px 12px',
            }}
          >
            <div className="absolute" style={{ top: -16, left: 30 }}>
              <Tape color="paper">pracownia</Tape>
            </div>
            <div className="absolute" style={{ top: 18, right: 18, transform: 'rotate(8deg)' }}>
              <Stamp color="pink">@dr_shoes</Stamp>
            </div>

            <div className="grid mt-4" style={{ gridTemplateColumns: 'auto 1fr', gap: '20px 18px' }}>
              <div style={{ color: 'var(--pink)' }}><I.pin size={20} /></div>
              <div>
                <div className="t-display" style={{ fontSize: 22, lineHeight: 1 }}>ul. Włodkowica 14/2</div>
                <div className="t-mono" style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)', marginTop: 4 }}>50-072 Wrocław · piętro 2</div>
              </div>

              <div style={{ color: 'var(--blue)' }}><I.clock size={20} /></div>
              <div>
                <div className="t-mono" style={{ fontSize: 13, fontWeight: 700 }}>Pn–Pt 11:00 — 19:00</div>
                <div className="t-mono" style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>Sob 12:00 — 16:00 · Nd zamknięte</div>
              </div>

              <div><I.phone size={20} /></div>
              <div className="t-display" style={{ fontSize: 26 }}>+48 794 220 118</div>

              <div><I.mail size={20} /></div>
              <div className="t-mono" style={{ fontSize: 14 }}>siema@drshoes.pl</div>

              <div style={{ color: 'var(--pink)' }}><I.ig size={20} /></div>
              <div className="t-mono" style={{ fontSize: 14 }}>@dr_shoes · 38.4k followers</div>
            </div>

            <div className="flex gap-2 flex-wrap mt-6 pt-4" style={{ borderTop: '1px dashed rgba(0,0,0,0.3)' }}>
              <Sticker angle={-2}>spawn point</Sticker>
              <Sticker angle={1.5} style={{ background: 'var(--acid)' }}>RTV ok</Sticker>
              <Sticker angle={-1}>kawa za free</Sticker>
            </div>
          </div>

          {/* right: map placeholder iframe */}
          <div
            className="border-[3px] border-acid overflow-hidden"
            style={{ aspectRatio: '16/9', boxShadow: '6px 6px 0 var(--pink), 6px 6px 0 1.5px var(--ink)' }}
          >
            {/* TODO(owner): replace pb= with precise workshop embed URL when provided */}
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d40019.84895893577!2d16.9965853!3d51.1078852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x470fe9c2d4b58abf%3A0xb70956aec205e0b5!2sWroc%C5%82aw!5e0!3m2!1spl!2spl!4v1716000000000"
              title="Lokalizacja pracowni Dr Shoes — Wrocław"
              width="100%"
              height="100%"
              style={{ border: 'none', display: 'block' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

### Step 3 — GREEN: implement `Footer.tsx` (≤ 30 LOC)

Create `apps/web/app/(public)/_components/Footer.tsx`:

```tsx
import { logger } from '@/lib/log';

const log = logger('public/Footer');

export function Footer() {
  log.debug('op=Footer.render');

  return (
    <footer className="py-7 px-7 bg-ink text-paper border-t-[2px] border-acid">
      <div className="max-w-[1280px] mx-auto flex justify-between items-center t-mono opacity-60" style={{ fontSize: 11 }}>
        <span>© 2026 Dr Shoes · pracownia w Wrocławiu</span>
        <span>made with paint &amp; duct tape</span>
      </div>
    </footer>
  );
}
```

---

### Step 4 — GREEN: update `apps/web/app/(public)/page.tsx`

Replace the 9-line placeholder with the composed landing:

```tsx
import { StickyNav } from './_components/StickyNav';
import { Hero } from './_components/Hero';
import { Services } from './_components/Services';
import { NewsTeaser } from './_components/NewsTeaser';
import { SklepTeaser } from './_components/SklepTeaser';
import { Contact } from './_components/Contact';
import { Footer } from './_components/Footer';

export default function HomePage() {
  return (
    <>
      <StickyNav />
      <Hero />
      <Services />
      <NewsTeaser />
      <SklepTeaser />
      <Contact />
      <Footer />
    </>
  );
}
```

---

### Step 5 — GREEN: create Playwright spec

Create `apps/web/e2e/public-landing.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Public landing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('StickyNav links have correct anchors', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Aktualności/i }))
      .toHaveAttribute('href', '#aktualnosci');
    await expect(page.getByRole('link', { name: /Sklep/i }))
      .toHaveAttribute('href', '#sklep');
    await expect(page.getByRole('link', { name: /Kontakt/i }))
      .toHaveAttribute('href', '#kontakt');
  });

  test('hero CTAs both point to #zamow', async ({ page }) => {
    const zamowLinks = page.getByRole('link', { name: /Zamów custom/i });
    await expect(zamowLinks.first()).toHaveAttribute('href', '#zamow');
    const naprawaLink = page.getByRole('link', { name: /Oddaj buty do naprawy/i });
    await expect(naprawaLink).toHaveAttribute('href', '#zamow');
  });

  test('scrolling to #aktualnosci section', async ({ page }) => {
    await page.getByRole('link', { name: /Aktualności/i }).first().click();
    await expect(page.locator('#aktualnosci')).toBeInViewport();
  });

  test('scrolling to #sklep section', async ({ page }) => {
    await page.getByRole('link', { name: /Sklep/i }).first().click();
    await expect(page.locator('#sklep')).toBeInViewport();
  });

  test('scrolling to #kontakt section', async ({ page }) => {
    await page.getByRole('link', { name: /Kontakt/i }).first().click();
    await expect(page.locator('#kontakt')).toBeInViewport();
  });
});
```

---

### Step 6 — GREEN verification

Run unit tests:

```bash
cd /Users/atlasjedi/P/misza_madafaka
npx vitest run apps/web/app/\(public\)/_components/__tests__/Contact.test.tsx \
                apps/web/app/\(public\)/_components/__tests__/Footer.test.tsx 2>&1 | tail -20
```

Expected: 8 tests pass.

Confirm LOC caps:

```bash
wc -l apps/web/app/\(public\)/_components/Contact.tsx \
       apps/web/app/\(public\)/_components/Footer.tsx \
       apps/web/app/\(public\)/page.tsx
```

Contact must be ≤ 80 LOC, Footer ≤ 30 LOC, page.tsx ≤ 20 LOC.

TypeScript check:

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Run the full vitest suite to confirm no regressions:

```bash
npx vitest run 2>&1 | tail -30
```

Expected: all previously green tests still pass, plus 13 new snapshots.

Playwright smoke (requires running stack — skip in CI if stack not available per `e2e/` exclusion rule):

```bash
npx playwright test apps/web/e2e/public-landing.spec.ts --reporter=line 2>&1 | tail -20
```

---

### Step 7 — Commit

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add apps/web/app/\(public\)/_components/Contact.tsx \
        apps/web/app/\(public\)/_components/Footer.tsx \
        apps/web/app/\(public\)/_components/__tests__/Contact.test.tsx \
        apps/web/app/\(public\)/_components/__tests__/Footer.test.tsx \
        apps/web/app/\(public\)/page.tsx \
        apps/web/e2e/public-landing.spec.ts
git commit -m "$(cat <<'EOF'
feat(public): compose full landing page — Contact, Footer, page.tsx orchestration, Playwright smoke [milestone:9][task:9-40]

Refs: docs/dispatch-log/9-40-<UTC>.md
EOF
)"
```

Write dispatch log to `docs/dispatch-log/9-40-<UTC>.md` with: files created/modified, test summary (unit 8/8 + Playwright 5/5 or skipped), decisions (Contact layout follows design reference with ink bg, map is generic Wrocław centre per spec section 7 deferral, Footer simplified to two-item mono bar), commit SHA.

---

## Wave 7 summary

| Task | File(s) | Tests | LOC notes |
|------|---------|-------|-----------|
| 9-35 | `StickyNav.tsx` | 5 vitest | ≤ 50 LOC |
| 9-36 | `Hero.tsx` | 5 vitest | ≤ 80 LOC |
| 9-37 | `Services.tsx` + `ServiceTile.tsx` | 5 vitest | ≤ 55 + ≤ 50 LOC |
| 9-38 | `NewsTeaser.tsx` + `NewsTeaserCard.tsx` | 5 vitest | ≤ 60 + ≤ 80 LOC |
| 9-39 | `SklepTeaser.tsx` + `ProductTile.tsx` | 5 vitest | ≤ 75 + ≤ 60 LOC |
| 9-40 | `Contact.tsx` + `Footer.tsx` + `page.tsx` + `public-landing.spec.ts` | 8 vitest + 5 Playwright | ≤ 78 + ≤ 30 LOC |

**Total new vitest tests this wave: 33**  
**Total Playwright scenarios this wave: 5**  
**All tasks are combined single-stage (no TWO-STAGE) per anti-bloat directive 2026-05-11.**
# Wave 8 — Polish + audit + tag (9-41 .. 9-43)

---

## Task 9-41: Parity audit with screenshots

**Review:** combined single-stage

**Summary:** Playwright sweep of all admin + public routes, full-page screenshots into
`screenshots/m9-parity/`, visual comparison against `handoff/design/{admin.jsx,landing.jsx}`.
Gaps < 10 LOC fixed inline; larger gaps appended to a "deferred to M10" list in the dispatch
log. No new product feature code — only a spec file + the audit report + minor inline fixes.

**Files:**
- Create: `apps/web/e2e/m9-parity-audit.spec.ts` — Playwright screenshot sweep across all admin
  routes + public landing
- Create: `screenshots/m9-parity/` directory — one `.png` per route (created by the spec at
  runtime; the directory itself is `.gitignore`-listed)
- Modify: `apps/web/.gitignore` (or root `.gitignore`) — add `screenshots/m9-parity/` if not
  already present
- Create: `docs/dispatch-log/9-41-parity-audit-<UTC>.md` — structured dispatch log + audit
  findings table + deferred-to-M10 list
- Inline fix files (0–N, each ≤ 10 LOC change): discovered at audit time — commit atomically
  with the main step-5 commit or as small preceding fixup commits (same task tag)

**Acceptance:**
1. `pnpm --filter=web exec playwright test m9-parity-audit` runs to completion (all
   `page.screenshot()` calls succeed) against a running stack (`make demo` or
   `docker compose up -d && pnpm run dev`).
2. `screenshots/m9-parity/` contains one `.png` per route listed below.
3. `docs/dispatch-log/9-41-parity-audit-<UTC>.md` exists and contains a findings table with
   status `ok | fixed-inline | deferred-M10` per route.
4. Any inline fix is ≤ 10 LOC diff and passes `pnpm --filter=web test` without regressions.
5. Commit `chore(audit): m9 parity audit + inline fixes [milestone:9][task:9-41]` is present on
   `main`.

---

- [ ] **Step 1: RED — add the parity audit spec (failing because screenshots dir may not exist)**

  Create `apps/web/e2e/m9-parity-audit.spec.ts`:

  ```ts
  /**
   * M9 parity audit — full-page screenshot sweep.
   *
   * PREREQUISITE: stack running (make demo or docker compose up + pnpm run dev).
   * After the run, screenshots land in screenshots/m9-parity/ relative to the
   * repo root (configured via playwright.config.ts screenshotsDir or outputDir).
   *
   * Run: pnpm --filter=web exec playwright test m9-parity-audit --headed
   * Or headless: pnpm --filter=web exec playwright test m9-parity-audit
   *
   * The spec intentionally does NOT assert pixel equality — it produces
   * screenshots for manual visual comparison against handoff/design/.
   * Soft assertions note mismatches in the console without failing the spec.
   */
  import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
  import path from "path";
  import fs from "fs";

  const SCREENSHOT_DIR = path.resolve(__dirname, "../../../screenshots/m9-parity");

  /** Login via APIRequestContext (avoids Docker streaming issues on macOS). */
  async function login(page: Page, request: APIRequestContext) {
    const resp = await request.post("/api/admin/auth/login", {
      data: { email: "misza@drshoes.pl", password: "change-me-on-first-login" },
      headers: { "Content-Type": "application/json" },
    });
    if (resp.status() !== 204) {
      throw new Error(`Login failed: HTTP ${resp.status()} — is the demo stack running?`);
    }
    await request.get("/api/admin/auth/me"); // materialise XSRF-TOKEN cookie
    const state = await request.storageState();
    if (state.cookies.length > 0) {
      await page.context().addCookies(state.cookies);
    }
  }

  /** Navigate and take a full-page screenshot, returning the file path. */
  async function snap(page: Page, route: string, slug: string): Promise<string> {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.goto(route, { waitUntil: "networkidle", timeout: 20_000 });
    const filePath = path.join(SCREENSHOT_DIR, `${slug}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`  📸 ${slug} → ${filePath}`);
    return filePath;
  }

  test.describe("M9 parity audit — screenshot sweep", () => {
    test.beforeEach(async ({ page, request }) => {
      await login(page, request);
    });

    /** Public landing — no auth needed but login context is harmless */
    test("public-landing", async ({ page }) => {
      await snap(page, "/", "public-landing");
      // Soft: assert hero heading exists
      const hero = page.locator("h1");
      const count = await hero.count();
      if (count === 0) {
        console.warn("AUDIT GAP [public-landing]: <h1> missing — landing may not be rendered");
      }
    });

    test("admin-dashboard", async ({ page }) => {
      await snap(page, "/admin", "admin-dashboard");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-orders-list", async ({ page }) => {
      await snap(page, "/admin/orders", "admin-orders-list");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-orders-calendar", async ({ page }) => {
      await snap(page, "/admin/orders/calendar", "admin-orders-calendar");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-orders-kanban", async ({ page }) => {
      await snap(page, "/admin/orders/kanban", "admin-orders-kanban");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-orders-new", async ({ page }) => {
      await snap(page, "/admin/orders/new", "admin-orders-new");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-messages", async ({ page }) => {
      await snap(page, "/admin/messages", "admin-messages");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-clients", async ({ page }) => {
      await snap(page, "/admin/clients", "admin-clients");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-triggers", async ({ page }) => {
      await snap(page, "/admin/triggers", "admin-triggers");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-templates", async ({ page }) => {
      await snap(page, "/admin/templates", "admin-templates");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-sklep", async ({ page }) => {
      await snap(page, "/admin/sklep", "admin-sklep");
      await expect(page.locator("main")).toBeVisible();
    });

    test("admin-aktualnosci", async ({ page }) => {
      await snap(page, "/admin/aktualnosci", "admin-aktualnosci");
      await expect(page.locator("main")).toBeVisible();
    });
  });
  ```

  Verify the spec file parses:

  ```bash
  pnpm --filter=web exec playwright test m9-parity-audit --list
  # Should list 12 tests without errors
  ```

  Expected: spec lists 12 tests. Actual run (Step 2) requires live stack.

---

- [ ] **Step 2: Run the spec and collect screenshots**

  Ensure the stack is running (if not, start it):

  ```bash
  # In a separate terminal — or verify it's already up
  make demo
  # OR for dev mode without the full demo stack:
  # docker compose up -d postgres minio && pnpm run dev
  ```

  Run the audit spec:

  ```bash
  pnpm --filter=web exec playwright test m9-parity-audit --headed
  # --headed lets you watch each page render in real time
  # Output: 12 screenshots in screenshots/m9-parity/
  ```

  List the screenshots:

  ```bash
  ls -la screenshots/m9-parity/
  ```

  Expected: 12 `.png` files, each > 10 KB (non-empty page renders).

---

- [ ] **Step 3: Visual comparison against design reference**

  Open the design reference alongside each screenshot:

  ```bash
  open handoff/design/index.html
  # The index.html loads admin.jsx + landing.jsx via a local bundler or inline script.
  # Compare each screenshot against the corresponding section of the design.
  ```

  For each route, classify the gap status and record it in the audit table below (to be
  inserted into the dispatch log `docs/dispatch-log/9-41-parity-audit-<UTC>.md`):

  ```markdown
  ## Parity Audit Results — M9

  | Route | Screenshot | Status | Notes |
  |---|---|---|---|
  | `/` | public-landing.png | ok / fixed-inline / deferred-M10 | |
  | `/admin` | admin-dashboard.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/orders` | admin-orders-list.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/orders/calendar` | admin-orders-calendar.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/orders/kanban` | admin-orders-kanban.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/orders/new` | admin-orders-new.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/messages` | admin-messages.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/clients` | admin-clients.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/triggers` | admin-triggers.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/templates` | admin-templates.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/sklep` | admin-sklep.png | ok / fixed-inline / deferred-M10 | |
  | `/admin/aktualnosci` | admin-aktualnosci.png | ok / fixed-inline / deferred-M10 | |

  ## Deferred to M10

  *(Items too large for inline fix — each ≥ 10 LOC or requires a new component)*

  - [ ] ...
  ```

  Decision rule:
  - Gap requires **≤ 10 LOC change** → fix inline in this step, mark `fixed-inline`.
  - Gap requires **> 10 LOC** or a new component → mark `deferred-M10`, add to deferred list.
  - No gap → mark `ok`.

  **Known anticipated inline fixes (from spec section 4.10 + memory hygiene list):**

  1. `ClientListTable.tsx` — `RodoInline` is still the M7 placeholder; replace with `<RodoBadge>`
     import (the component exists at `_components/RodoBadge.tsx`). Diff: remove `RodoInline`
     function (~14 LOC) + update import + call-site — this crosses 10 LOC threshold, so it
     belongs to task 9-42. **Do NOT fix inline here.**

  2. Any missing `data-testid` on elements if the spec soft-asserts on them — ≤ 2 LOC each,
     fix inline.

  3. Typography class typos (e.g. `t-display` applied as `font-display` by mistake) — ≤ 3 LOC
     each, fix inline.

  4. Missing `usePageHeader` call-site on a page that renders without a topbar title —
     ≤ 5 LOC, fix inline.

  Apply any inline fixes:

  ```bash
  # Example of an inline fix commit:
  git add <file>
  git commit -m "fix(ui): <description of inline gap> [milestone:9][task:9-41]

  Refs: docs/dispatch-log/9-41-parity-audit-<UTC>.md"
  ```

---

- [ ] **Step 4: Write dispatch log + add screenshots dir to .gitignore**

  Add `screenshots/m9-parity/` to `.gitignore` (root or `apps/web/.gitignore`):

  ```bash
  grep -q "screenshots/m9-parity" .gitignore || echo "screenshots/m9-parity/" >> .gitignore
  ```

  Create `docs/dispatch-log/9-41-parity-audit-<UTC>.md` (replace `<UTC>` with current
  timestamp, e.g. `2026-05-15T18-00-00Z`):

  ```markdown
  ---
  task_id: "9-41"
  plan_file: "docs/superpowers/plans/2026-05-15-milestone-09-design-parity.md"
  start_time: "<UTC>"
  end_time: "<UTC>"
  ---

  # Task 9-41 — M9 Parity Audit

  ## Files changed
  - `apps/web/e2e/m9-parity-audit.spec.ts` +1-120: new Playwright screenshot sweep
  - `.gitignore` +1: added `screenshots/m9-parity/`
  - `docs/dispatch-log/9-41-parity-audit-<UTC>.md` +1: this file

  ## Inline fixes (≤ 10 LOC each)
  <!-- list each fix: file + what changed + commit sha -->

  ## Commands run
  | Command | Exit code |
  |---|---|
  | `pnpm --filter=web exec playwright test m9-parity-audit --headed` | 0 |

  ## Parity Audit Results
  <!-- paste the findings table here -->

  ## Deferred to M10
  <!-- paste the deferred list here -->

  ## Decisions
  <!-- any deviations from plan -->

  ## commit_sha
  <!-- git rev-parse HEAD -->

  ## next_action
  "Dispatch 9-42 (Clients reskin)"
  ```

  Verify existing vitest suite still green:

  ```bash
  pnpm --filter=web test --run
  # Expect: all existing tests pass (no regressions from inline fixes)
  ```

---

- [ ] **Step 5: Commit**

  Stage the spec file, the .gitignore update, and the dispatch log:

  ```bash
  git add apps/web/e2e/m9-parity-audit.spec.ts \
          .gitignore \
          docs/dispatch-log/9-41-parity-audit-<UTC>.md
  git commit -m "$(cat <<'EOF'
  chore(audit): m9 parity audit + inline fixes [milestone:9][task:9-41]

  Playwright sweep across 12 admin + public routes. Screenshots in
  screenshots/m9-parity/ (gitignored). Findings table + deferred-to-M10
  list written to dispatch log.

  Refs: docs/dispatch-log/9-41-parity-audit-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-42: Clients reskin (post-audit)

**Review:** combined single-stage

**Summary:** Reskin the Clients list page and Client detail page to match M9 design parity.
The functionality (search, pagination, edit modal, RODO consent, tabs for zlecenia/wiadomości)
shipped in M7 and is NOT changed — only visual styling is updated. Replaces the remaining
`RodoInline` placeholder with the real `<RodoBadge>` SC.

**Files:**
- Modify: `apps/web/app/(admin)/admin/clients/page.tsx` — `usePageHeader` hook call + `.tbl`
  table class on `ClientSearchResultsTable` + search input restyled as t-mono with ink border
- Modify: `apps/web/app/(admin)/admin/clients/_components/ClientListSearchBox.tsx` — input
  class upgraded to t-mono + ink border per design
- Modify: `apps/web/app/(admin)/admin/clients/_components/ClientListTable.tsx` — `.tbl` class
  on table element + replace `RodoInline` with `<RodoBadge>` import + channel column as `<Pill>`
  (if `<Pill>` can accept channel values — otherwise keep existing chip styled with `.chip`
  class from globals.css)
- Modify: `apps/web/app/(admin)/admin/clients/[id]/_components/ClientHeader.tsx` — upgrade
  header `<h1>` to `.t-display` (38px, Anton) + `<AdminCard>` wrapper + `<RodoBadge>` restyle
  (already uses it; just ensure correct size class)
- Modify: `apps/web/app/(admin)/admin/clients/[id]/page.tsx` — `usePageHeader` call with
  `title: client.fullName, subtitle: 'klient od {MM.YYYY}'` + wrap detail section cards with
  `<AdminCard>` from `@drshoes/ui`
- Modify: `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientListTable.test.tsx` —
  update any snapshot or class assertions to match new `.tbl` class
- Modify: `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientsPage.test.tsx` —
  update for new search input class if asserted

**Acceptance:**
1. `/admin/clients` renders with: t-mono search input with ink border, `.tbl` styled table,
   `<RodoBadge>` (not the inline placeholder) in the status column, channel column as styled chip.
2. `/admin/clients/{id}` renders with: `t-display` client name heading inside an `<AdminCard>`,
   topbar shows `client.fullName` as title and "klient od MM.YYYY" as subtitle, section cards
   use `<AdminCard>` wrapper.
3. `pnpm --filter=web test --run` passes with no regressions (updated snapshots/assertions are
   committed as part of this task).
4. Commit `feat(clients): reskin per M9 design parity [milestone:9][task:9-42]` is present on
   `main`.

---

- [ ] **Step 1: RED — add/update tests that assert the new styling**

  Update `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientListTable.test.tsx` —
  add a test asserting `.tbl` class and `<RodoBadge>` (not inline placeholder):

  ```ts
  it("table root has .tbl class", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ firstName: "Test" }]);
    const { container } = render(<ClientListTable page={page} currentPage={0} q="" />);
    const table = container.querySelector("table");
    expect(table).toHaveClass("tbl");
  });

  it("renders <RodoBadge> data-testid not inline pill", async () => {
    const { ClientListTable } = await import("../ClientListTable");
    const page = makePage([{ rodoConsentAt: "2026-04-01T00:00:00Z" }]);
    render(<ClientListTable page={page} currentPage={0} q="" />);
    // RodoBadge renders data-testid="rodo-badge"
    expect(screen.getByTestId("rodo-badge")).toBeInTheDocument();
  });
  ```

  Add a test for `ClientListSearchBox` input class:

  In `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientListSearchBox.test.tsx`,
  verify the input has the `t-mono` class and `border-ink`:

  ```ts
  it("search input has t-mono and border-ink classes", () => {
    render(<ClientListSearchBox initialQ="" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toMatch(/t-mono/);
    expect(input.className).toMatch(/border-ink/);
  });
  ```

  Run to confirm RED:

  ```bash
  pnpm --filter=web test --run -- clients
  # Expect: new assertions fail (class not yet applied)
  ```

---

- [ ] **Step 2: GREEN — implement the reskin**

  **2a. `ClientListSearchBox.tsx`** — update input className:

  ```tsx
  // Replace existing className on the <input>:
  className="t-mono w-full max-w-lg h-10 px-3 border border-ink rounded-sm
             focus:outline-none focus:ring-2 focus:ring-acid text-sm
             placeholder:text-admin-mute placeholder:opacity-60"
  ```

  **2b. `ClientListTable.tsx`** — three changes:

  1. Replace the `RodoInline` inline function (and import) with `<RodoBadge>`:

     ```ts
     // Remove: local RodoInline function declaration (~14 LOC)
     // Add at top of file:
     import { RodoBadge } from "../RodoBadge";
     ```

     In the table body, replace `<RodoInline rodoConsentAt={client.rodoConsentAt} />` with:

     ```tsx
     <RodoBadge rodoConsentAt={client.rodoConsentAt ?? null} />
     ```

  2. Add `.tbl` class to the `<table>` element:

     ```tsx
     // Before:
     <table className="w-full border-collapse">
     // After:
     <table className="tbl w-full">
     ```

  3. Channel pill — upgrade to use `.chip` CSS class from globals.css:

     ```tsx
     // Before:
     <span className="inline-block px-3 py-1 rounded-md text-[12px] font-semibold uppercase tracking-wide bg-admin-bg border border-admin-line text-admin-ink">
       {channelLabel(client.preferredChannel)}
     </span>
     // After:
     <span className="chip">{channelLabel(client.preferredChannel)}</span>
     ```

  **2c. `ClientHeader.tsx`** (detail page header) — upgrade `<h1>` class:

  ```tsx
  // Before:
  <h1 className="font-display text-3xl leading-tight text-admin-ink mb-3">
  // After:
  <h1 className="t-display text-admin-ink mb-3" style={{ fontSize: "clamp(28px, 4vw, 38px)" }}>
  ```

  The outer `<div className="admin-card p-6 mb-6 ...">` already uses the `.admin-card`
  CSS class which should match `<AdminCard>` styling. Verify in globals.css that `.admin-card`
  matches the `<AdminCard>` component (1.5px border + pop-card shadow). If `<AdminCard>` is
  a React component from `@drshoes/ui`, optionally swap:

  ```tsx
  // If AdminCard component is exported from @drshoes/ui after Wave 1 (task 9-10):
  import { AdminCard } from "@drshoes/ui";
  // Replace the outer div:
  <AdminCard className="p-6 mb-6">...</AdminCard>
  ```

  If the `AdminCard` component does not yet exist in the package (Wave 1 not yet shipped),
  keep the `.admin-card` class div — both are visually equivalent.

  **2d. `clients/[id]/page.tsx`** — add `usePageHeader` + `<AdminCard>` wrappers:

  Because `[id]/page.tsx` is a Server Component, `usePageHeader` (a client-side hook) cannot
  be called directly. Use the **PageHeader pattern from spec §3.3**: the page exports metadata
  or the layout reads client name from a shared fetch. The simplest approach for a Server
  Component is to pass the `PageHeader` value through the `<ClientPageHeaderSync>` island
  (a tiny "use client" bridge component):

  Create `apps/web/app/(admin)/admin/clients/[id]/_components/ClientPageHeaderSync.tsx`
  (< 20 LOC):

  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";

  interface Props {
    title: string;
    subtitle: string;
  }

  export function ClientPageHeaderSync({ title, subtitle }: Props) {
    usePageHeader({ title, subtitle });
    return null; // renders nothing, only syncs context
  }
  ```

  In `clients/[id]/page.tsx`, import `ClientPageHeaderSync` and render it at the top of the
  JSX tree:

  ```tsx
  import { ClientPageHeaderSync } from "./_components/ClientPageHeaderSync";

  // Inside the return (before <ClientHeader>):
  <ClientPageHeaderSync
    title={client.firstName + (client.lastName ? ` ${client.lastName}` : "")}
    subtitle={`klient od ${fmtMonthYear(client.createdAt)}`}
  />
  ```

  Add the `fmtMonthYear` helper (≤ 6 LOC):

  ```ts
  function fmtMonthYear(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", {
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Warsaw",
    });
  }
  ```

  Wrap both detail cards in `<AdminCard>`:

  ```tsx
  // Before:
  <div className="admin-card p-5">
  // After (if AdminCard is available from @drshoes/ui):
  <AdminCard className="p-5">
  // OR keep the div with the .admin-card class if the component is not yet available:
  <div className="admin-card p-5">
  ```

  **2e. `clients/page.tsx`** — add `ClientPageHeaderProvider` pattern for the list page.

  The list page is also a Server Component. Use the same bridge pattern:

  Create or reuse `ClientListPageHeaderSync.tsx` in `_components/`:

  ```tsx
  "use client";
  import { usePageHeader } from "@/app/(admin)/admin/_components/PageHeaderContext";
  import type { ReactNode } from "react";

  interface Props { count: number; right?: ReactNode }

  export function ClientListPageHeaderSync({ count, right }: Props) {
    usePageHeader({
      title: "Klienci",
      subtitle: `${count} klientów`,
      right,
    });
    return null;
  }
  ```

  In `clients/page.tsx`, import and render:

  ```tsx
  import { ClientListPageHeaderSync } from "./_components/ClientListPageHeaderSync";
  // ...
  // Inside return — at the very top, before the existing header div:
  <ClientListPageHeaderSync count={pageData?.totalElements ?? searchResults?.length ?? 0} />
  ```

  Remove the old `<h1>Klienci</h1>` block (the `<div className="flex items-center...mb-7">`)
  since the topbar now carries the page title.

---

- [ ] **Step 3: REFACTOR — keep files within 80-LOC budget**

  After changes, verify LOC counts:

  ```bash
  wc -l apps/web/app/\(admin\)/admin/clients/page.tsx
  wc -l apps/web/app/\(admin\)/admin/clients/_components/ClientListTable.tsx
  wc -l apps/web/app/\(admin\)/admin/clients/_components/ClientListSearchBox.tsx
  wc -l apps/web/app/\(admin\)/admin/clients/\[id\]/page.tsx
  wc -l apps/web/app/\(admin\)/admin/clients/\[id\]/_components/ClientHeader.tsx
  ```

  If `ClientListTable.tsx` grows above 80 LOC after removing `RodoInline` + adding new imports:
  extract `ClientListPagination` into its own file
  `_components/ClientListPagination.tsx` (it's already self-contained as a local function).

  If `clients/[id]/page.tsx` grows above 80 LOC after adding the helper + island import:
  move `fmtMonthYear` and `fmtDate` into a shared `lib/format.ts` utility (or the existing
  `lib/date.ts` if it exists).

---

- [ ] **Step 4: Run tests — confirm GREEN**

  ```bash
  pnpm --filter=web test --run -- clients
  # Expect: all client tests pass including new .tbl and rodo-badge assertions

  pnpm --filter=web test --run
  # Expect: full suite green, 250+ tests (M9 adds ~50 new tests across all tasks)
  ```

  If snapshots exist and need updating:

  ```bash
  pnpm --filter=web test --run -- --update-snapshots
  # Then re-run without --update-snapshots to confirm green
  pnpm --filter=web test --run
  ```

  Visual verification (if stack is running):

  ```bash
  # Navigate to http://localhost:3000/admin/clients in a browser
  # Confirm: t-mono search input, .tbl table, RodoBadge in status column
  # Navigate to http://localhost:3000/admin/clients/{any-seeded-id}
  # Confirm: topbar shows client full name as title, "klient od MM.YYYY" subtitle
  ```

---

- [ ] **Step 5: Commit**

  Write dispatch log `docs/dispatch-log/9-42-<UTC>.md`:

  ```markdown
  ---
  task_id: "9-42"
  plan_file: "docs/superpowers/plans/2026-05-15-milestone-09-design-parity.md"
  start_time: "<UTC>"
  end_time: "<UTC>"
  ---

  # Task 9-42 — Clients reskin

  ## Files changed
  - `apps/web/app/(admin)/admin/clients/page.tsx` +N-N: removed h1/header div,
    added ClientListPageHeaderSync
  - `apps/web/app/(admin)/admin/clients/_components/ClientListSearchBox.tsx` +N:
    input class → t-mono + border-ink
  - `apps/web/app/(admin)/admin/clients/_components/ClientListTable.tsx` +N-N:
    table → .tbl, RodoInline removed, RodoBadge imported, channel → .chip
  - `apps/web/app/(admin)/admin/clients/_components/ClientListPageHeaderSync.tsx`
    +1-18: new CC bridge for list page topbar
  - `apps/web/app/(admin)/admin/clients/[id]/_components/ClientPageHeaderSync.tsx`
    +1-15: new CC bridge for detail page topbar
  - `apps/web/app/(admin)/admin/clients/[id]/_components/ClientHeader.tsx` +N:
    h1 → t-display class
  - `apps/web/app/(admin)/admin/clients/[id]/page.tsx` +N-N: ClientPageHeaderSync
    rendered, fmtMonthYear helper added, AdminCard wrappers applied
  - test files: updated assertions for .tbl class + RodoBadge data-testid

  ## Commands run
  | Command | Exit code |
  |---|---|
  | `pnpm --filter=web test --run` | 0 |

  ## Decisions
  <!-- any deviations from plan (e.g. AdminCard from @drshoes/ui not yet available → kept .admin-card div) -->

  ## commit_sha
  <!-- git rev-parse HEAD -->

  ## next_action
  "Dispatch 9-43 (milestone-9 close-out)"
  ```

  Stage and commit:

  ```bash
  git add \
    apps/web/app/\(admin\)/admin/clients/page.tsx \
    apps/web/app/\(admin\)/admin/clients/_components/ClientListSearchBox.tsx \
    apps/web/app/\(admin\)/admin/clients/_components/ClientListTable.tsx \
    apps/web/app/\(admin\)/admin/clients/_components/ClientListPageHeaderSync.tsx \
    apps/web/app/\(admin\)/admin/clients/\[id\]/_components/ClientPageHeaderSync.tsx \
    apps/web/app/\(admin\)/admin/clients/\[id\]/_components/ClientHeader.tsx \
    apps/web/app/\(admin\)/admin/clients/\[id\]/page.tsx \
    apps/web/app/\(admin\)/admin/clients/_components/__tests__/ClientListTable.test.tsx \
    apps/web/app/\(admin\)/admin/clients/_components/__tests__/ClientListSearchBox.test.tsx \
    docs/dispatch-log/9-42-<UTC>.md
  git commit -m "$(cat <<'EOF'
  feat(clients): reskin per M9 design parity [milestone:9][task:9-42]

  - Search input: t-mono class + border-ink per graffiti design system
  - ClientListTable: .tbl class on <table>, replace RodoInline placeholder
    with <RodoBadge> SC, channel column uses .chip class
  - ClientListPageHeaderSync: CC bridge for list page topbar (title=Klienci,
    subtitle=N klientów)
  - ClientPageHeaderSync: CC bridge for detail page topbar (client full name
    as title, "klient od MM.YYYY" subtitle)
  - ClientHeader: h1 upgraded to t-display class for Anton/display font
  - Detail page: AdminCard wrappers on section cards

  Refs: docs/dispatch-log/9-42-<UTC>.md
  EOF
  )"
  ```

---

## Task 9-43: milestone-9 README update + git tag local

**Review:** combined single-stage (docs + runbook — no application logic)

**Summary:** Close out Milestone 9. Verify full suite green (backend + frontend vitest +
Playwright). Update `docs/superpowers/ROADMAP.md` to mark M9 done. Update `CLAUDE.md` status
block. Create annotated `milestone-9` git tag locally (do NOT push — owner signs off before
push, exactly as milestone-7 pattern). Write structured dispatch log.

**Files:**
- Modify: `docs/superpowers/ROADMAP.md` — append M9 to Done table, remove from In-Flight/Next
- Modify: `CLAUDE.md` — add `- [x] Milestone 9: ...` to status block
- Create: `docs/dispatch-log/9-43-<UTC>.md` — structured dispatch log with final suite counts

**Acceptance:**
1. `mvn -pl :app-am verify` exits 0 (backend suite ≥ 398 tests, 0 failures).
2. `pnpm --filter=web test --run` exits 0 (frontend vitest ≥ 250 tests after M9 adds ~50).
3. `pnpm --filter=web exec playwright test` exits 0 (≥ 6 green specs: _smoke + demo-flow +
   admin-sidebar-nav + dashboard-parity + public-landing + m9-parity-audit).
4. `docs/superpowers/ROADMAP.md` contains `| M9 |` in the Done table.
5. `CLAUDE.md` contains `- [x] Milestone 9`.
6. `git tag -l milestone-9` shows the tag locally.
7. Tag is NOT pushed to origin (owner signs off first).

---

- [ ] **Step 1: Run full suite — confirm green before tagging**

  ```bash
  # Backend
  cd /Users/atlasjedi/P/misza_madafaka/backend
  mvn -pl :app-am verify -B 2>&1 | tail -20
  # Expect: BUILD SUCCESS. Record: Tests run: N, Failures: 0, Errors: 0, Skipped: 0

  # Frontend vitest
  cd /Users/atlasjedi/P/misza_madafaka
  pnpm --filter=web test --run 2>&1 | tail -10
  # Expect: all pass. Record test count.

  # Playwright (requires running stack)
  pnpm --filter=web exec playwright test 2>&1 | tail -20
  # Expect: all pass. Record spec count.
  # If stack is not running, note that in the dispatch log and run only the
  # test:e2e --project=chromium with a local dev server:
  #   pnpm --filter=web exec playwright test --project=chromium
  ```

  If any suite is red: **STOP**. Diagnose the failure root cause. Fix it (inline if ≤ 10 LOC
  diff; dispatch a targeted sub-task if > 10 LOC). Do not proceed to Step 2 until all suites
  are green.

  Record counts for the dispatch log and tag message:

  ```bash
  BACKEND_COUNT=$(cd backend && mvn -pl :app-am verify -B -q 2>&1 | grep "Tests run" | tail -1 | grep -o "Tests run: [0-9]*" | grep -o "[0-9]*")
  echo "Backend tests: $BACKEND_COUNT"

  FRONTEND_COUNT=$(pnpm --filter=web test --run 2>&1 | grep -E "Tests.*passed" | grep -o "[0-9]* passed" | head -1)
  echo "Frontend tests: $FRONTEND_COUNT"
  ```

---

- [ ] **Step 2: Update `docs/superpowers/ROADMAP.md`**

  Open `docs/superpowers/ROADMAP.md`. In the **Done** table, append a new row after the M8
  row (or M7 if M8 is not yet there):

  ```markdown
  | **M9** | Design parity — design system (tokens/fonts/primitives), admin shell rewrite, all admin views reskinned, public landing | `milestone-9` |
  ```

  If M9 appears in an **In-Flight** or **Next** section, remove it from there.

  Also append M10 candidates to the Deferred section. Under `## Decision log`, add:

  ```markdown
  - **2026-05-15** — M9 closed. Deferred to M10 backlog per spec §7:
    - Real `/admin/search?q=` handler (topbar search is visual-only in M9)
    - Notifications popover behind the topbar bell
    - Drag-drop wiring for `<UnscheduledOrdersPanel>` (calendar, stub only)
    - Drag-drop wiring for kanban "+ dodaj" column button (stub only)
    - Add-tag flow on the order drawer (chip present, disabled with tooltip)
    - Light/dark mode toggle
    - Mobile responsive layout
    - Real `/sklep` and `/aktualnosci` implementations (locked stubs)
    - Map iframe embed coordinates for `<Contact>` — generic Wrocław centre used
  ```

---

- [ ] **Step 3: Update `CLAUDE.md` status block**

  Open `CLAUDE.md`. In the `## Status` section, add after the last `- [x]` line:

  ```markdown
  - [x] Milestone 9: Design parity — admin shell + all views reskinned + public landing
  ```

  Also update the **Forward roadmap** section near the bottom if it references M9 as planned
  or in-flight — mark it closed and note M10 as next.

---

- [ ] **Step 4: Commit the docs update**

  ```bash
  git add docs/superpowers/ROADMAP.md CLAUDE.md
  git commit -m "$(cat <<'EOF'
  docs(milestone-9): close milestone 9 — design parity shipped [milestone:9][task:9-43]

  Backend suite: <N>/0/0/0 (mvn -pl :app-am verify)
  Frontend vitest: <N> passed
  Playwright: <N> specs green

  M9 scope delivered:
  - Design system rewrite: tokens (ink/paper/acid palette), 5 next/font families,
    Tailwind preset extensions, globals.css graffiti utility classes
  - Primitive components: Tape, Stamp, Sticker, Pill, Chip, Splatter, PhImg,
    DrShoesMark, AdminCard, StatTile, Toggle, Button, icons (~25 SVG)
  - Admin shell rewrite: dark ink sidebar with acid border, AdminTopbar,
    AdminPageHeaderContext / usePageHeader
  - All admin views reskinned: Dashboard, Orders list + drawer, Calendar,
    Kanban, Messages (3-col + ClientMiniProfile), Triggers + TriggerEditPanel,
    Templates, Sklep admin + ReservationsQueue, Clients (post-audit)
  - Public landing: StickyNav + Hero + Services + NewsTeaser + SklepTeaser
    + Contact + Footer
  - Parity audit: 12-route Playwright screenshot sweep + inline fixes
  - Tests: +~50 vitest snapshots/smoke + 3 new Playwright specs

  Deferred to M10 backlog (per spec §7):
  - Real /admin/search?q= handler
  - Notifications popover (bell button visual-only)
  - Drag-drop for UnscheduledOrdersPanel + kanban "+ dodaj"
  - Add-tag flow on order drawer (chip disabled with tooltip)
  - Light/dark mode, mobile responsive layout
  - Real /sklep + /aktualnosci implementations
  - Map iframe precise coords for <Contact>

  HEAD SHA: <git rev-parse HEAD>

  Refs: docs/dispatch-log/9-43-<UTC>.md
  EOF
  )"
  ```

---

- [ ] **Step 5: Create annotated git tag `milestone-9` (LOCAL ONLY — do not push)**

  ```bash
  git tag -a milestone-9 -m "$(cat <<'EOF'
  Milestone 9 — Design parity (admin + landing)

  Goal: Bring the live application to parity with handoff/design/ (admin.jsx +
  landing.jsx + styles.css). "Chcemy mieć super produkt."

  Scope shipped:
  - Design system: ink/paper/acid tokens, Anton + Big Shoulders Stencil Display +
    Permanent Marker + Inter Tight + JetBrains Mono via next/font, Tailwind preset
    extensions (boxShadow pop/pop-sm/pop-card/pop-pink/pop-acid/pop-blue,
    gridTemplateColumns admin-msg-3/admin-trig/admin-sklep), globals.css graffiti
    utility classes (.t-display, .t-stencil, .t-tag, .t-mono, .sb-link, .tbl,
    .field, .admin-card, .btn-clean, .btn-*, etc.)
  - Primitives: Tape, Stamp, Sticker, Pill, Chip, Splatter, PhImg, DrShoesMark,
    AdminCard, StatTile, Toggle, Button, icons.tsx (~25 SVG icons)
  - Admin shell: dark ink sidebar (230px, 3px acid right border, stencil nav links,
    DrShoesMark header, avatar+power footer), AdminTopbar (t-display title + t-mono
    subtitle + search 280px + bell), AdminPageHeaderContext + usePageHeader hook,
    AdminLayout with PageHeaderProvider
  - Admin views (all reskinned to design):
    - Dashboard: 4 StatTile + OrdersWeekChart stacked-bar + MixDonut 3-segment +
      ReadyForPickupPanel + RecentMessagesPanel + FreshReservationsPanel (NEW)
    - Orders list: .tbl + Pill status + Chip filters + preset chips row
    - Order drawer: 5-step StatusTimeline (NEW) + tag chips row + OrderDrawerNotes
      sticky-notes (NEW) + photo grid labels + restyled footer actions
    - Calendar: segmented toggle restyle + UnscheduledOrdersPanel 280px (NEW, drag stub)
    - Kanban: colour-band column headers + AdminCard cards + post-drag popup (NEW)
    - Messages: grid-cols-admin-msg-3 + ClientMiniProfile right panel (NEW)
    - Triggers: TriggerEditPanel (NEW) + placeholder chips + manual-confirm Toggle +
      "test do siebie" button
    - Templates: editor parity with Triggers (simplified)
    - Sklep admin: ProductCard grid + ProductEditPanel + ReservationsQueue (NEW)
    - Clients: .tbl table + t-mono search + RodoBadge (replaces inline placeholder) +
      t-display detail header + usePageHeader bridge islands
  - Public landing (/): StickyNav + Hero (Splatter + Tape decorations + t-display h1) +
    Services (3-tile grid) + NewsTeaser (3-card ink bg) + SklepTeaser (4-tile product
    grid) + Contact (hours + address + map placeholder) + Footer
  - Tests: +~50 vitest snapshots per primitive + view-level smoke; 3 new Playwright
    specs (admin-sidebar-nav, dashboard-parity, public-landing); m9-parity-audit sweep
  - Parity audit (task 9-41): 12-route screenshot sweep + inline fixes

  Deferred to M10 backlog (spec §7):
  - Real /admin/search?q= handler
  - Notifications popover
  - Drag-drop UnscheduledOrdersPanel + kanban column button
  - Order drawer add-tag flow
  - Light/dark mode, mobile responsive
  - Real /sklep + /aktualnosci
  - Map iframe precise coords

  Backend: <N>/0/0/0 (mvn -pl :app-am verify)
  Frontend vitest: <N> passed
  Playwright: <N> specs green
  HEAD: <git rev-parse HEAD>
  EOF
  )"
  ```

  Verify the tag exists locally:

  ```bash
  git tag -l milestone-9
  # Expect: milestone-9

  git show milestone-9 --stat | head -10
  # Expect: tag message shows, commits under the tag shown
  ```

  **Do NOT push the tag to origin.** Owner signs off on the visual output first.

  To push when owner approves (paste-ready, do NOT run now):

  ```bash
  # WAIT FOR OWNER SIGN-OFF before running this
  git push origin milestone-9
  git push origin main
  ```

---

- [ ] **Step 6: Write dispatch log and final report**

  Create `docs/dispatch-log/9-43-<UTC>.md`:

  ```markdown
  ---
  task_id: "9-43"
  plan_file: "docs/superpowers/plans/2026-05-15-milestone-09-design-parity.md"
  start_time: "<UTC>"
  end_time: "<UTC>"
  ---

  # Task 9-43 — Milestone 9 close-out

  ## Suite verification

  | Suite | Result | Count |
  |---|---|---|
  | Backend `mvn -pl :app-am verify` | GREEN | <N>/0/0/0 |
  | Frontend `pnpm --filter=web test --run` | GREEN | <N> passed |
  | Playwright `pnpm --filter=web exec playwright test` | GREEN | <N> specs |

  ## Files changed
  - `docs/superpowers/ROADMAP.md` +N: M9 added to Done table, M10 deferrals documented
  - `CLAUDE.md` +1: `- [x] Milestone 9` added to status block
  - `docs/dispatch-log/9-43-<UTC>.md` +1: this file

  ## Tag
  `milestone-9` annotated tag created at HEAD <SHA>. NOT pushed to origin (owner sign-off pending).

  ## Deferred to M10
  - Real /admin/search?q= handler
  - Notifications popover
  - Drag-drop UnscheduledOrdersPanel + kanban column button
  - Order drawer add-tag flow
  - Light/dark mode, mobile responsive
  - Real /sklep + /aktualnosci
  - Map iframe precise coords

  ## Decisions
  - Tag held local per milestone-7 pattern (owner pushes after visual sign-off)

  ## commit_sha
  <git rev-parse HEAD>

  ## next_action
  "Owner visual sign-off → git push origin milestone-9 + git push origin main → plan M10"
  ```

  Stage and commit the dispatch log:

  ```bash
  git add docs/dispatch-log/9-43-<UTC>.md
  git commit -m "$(cat <<'EOF'
  chore(dispatch): record 9-43 completion — milestone-9 tag created [milestone:9][task:9-43]

  Refs: docs/dispatch-log/9-43-<UTC>.md
  EOF
  )"
  ```

---

**Errata-aware notes for 9-43:**

- The `milestone-9` tag message body format mirrors the M7 and M8 annotated tags. Run
  `git show milestone-8` to verify style alignment before creating the tag.
- If backend test count has grown beyond 398 (new backend slices from Wave 8 audit, e.g. a
  missing DTO field), update the expected count in the tag message accordingly.
- If the Playwright stack is not available during this task (e.g. CI environment without
  `make demo`), run the Playwright specs in dry-run mode and note it:
  ```bash
  pnpm --filter=web exec playwright test --list
  # Just confirm spec count; skip actual run in the dispatch log with a note
  ```
- `CLAUDE.md` status block uses `- [x]` syntax matching existing checked lines above M9.
  Do not change indentation or surrounding formatting.
- Resume prompt for the next session (paste-ready after `/clear`):

  ```
  Read docs/superpowers/specs/2026-05-15-milestone-09-design-parity-design.md sections 6.4 and 7.
  Then read docs/superpowers/ROADMAP.md.
  Verify HEAD: git log --oneline -3
  Verify tag: git tag -l milestone-9
  Confirm owner sign-off on design parity, then:
    git push origin milestone-9
    git push origin main
  Then brainstorm Milestone 10 scope from the M10 deferred list + any new owner priorities.
  ```
