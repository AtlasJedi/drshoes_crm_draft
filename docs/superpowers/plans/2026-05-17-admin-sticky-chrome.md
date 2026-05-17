# Plan — v2-L · Admin layout: sticky chrome + per-page scrollable list

**Milestone:** v2-fixes
**Task ID:** v2-L
**Stage:** single (UI-only, mechanical pattern across 4 files)

## Owner directive (locked 2026-05-17 in this session)

- "strona nigdy nie jest scrollable, ewentualnie widoki jeśli wychodzą poza obszar"
- "filtry przypięte na górze ale pole z listą scrollowalne"
- Confirmed approach (A): layout `<main>` wrap KEEPS `p-6` padding; each page restructures internally.

## Audit findings (verified Playwright 1440x900)

| Route | overflow | needs fix |
|---|---:|---|
| `/admin/orders` | 239px | YES — filtry, presets, tabs scrollują z listą |
| `/admin/clients` | 81px | YES — search box scrolluje z tabelą |
| `/admin/sklep` | 127px | YES — filter chips + grid scrollują wspólnie |
| `/admin` (dashboard) | 27px | NO (kosmetyczne, odpuszczamy) |
| pozostałe 8 route'ów | 0 | NO |

## Authoritative pattern

```tsx
<div className="h-full flex flex-col">
  {/* SHRINK-0: page chrome — tabs, presets, filters, header. NEVER scrolls. */}
  <div className="shrink-0 space-y-4 mb-4">
    {tabsOrChips}
    {presets}
    {filters}
  </div>
  {/* FLEX-1: scrollable list / table / grid region. */}
  <div className="flex-1 min-h-0 overflow-auto">
    {tableOrList}
  </div>
</div>
```

**Critical:** every direct flex child gets either `shrink-0` (sticky) or `flex-1 min-h-0 overflow-auto` (scroll). Default flex-shrink: 1 will make chrome shrink instead of scrolling — don't rely on defaults.

## Files to change

### 1. `apps/web/app/(admin)/admin/layout.tsx`
Tylko jedna linijka: wewnętrzny wrapper zmienia overflow.
**Before** (obecny stan po naszej wcześniejszej edycji):
```tsx
<div className={isMessagesRoute ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-auto p-6"}>
```
**After:**
```tsx
<div className={isMessagesRoute ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-hidden p-6"}>
```
Po tej zmianie żaden wrapper nie scrolluje — strona MUSI sama zarządzać scrollem.

### 2. `apps/web/app/(admin)/admin/orders/page.tsx`
Obecny root `<div>` → `<div className="h-full flex flex-col">`. Chrome (`OrderViewTabs`, `SavedFilterPresets`, `OrdersFilters`) opakuj w `<div className="shrink-0 space-y-3">`. Tabela `<OrdersPageClient />` (i empty-state fallback) opakuj w `<div className="flex-1 min-h-0 overflow-auto">`. `OrderDrawer` zostaje poza tym flexem (jest fixed overlay).

Uwaga: zachowaj wszystkie obecne `<div className="mb-5">` itp. wewnątrz chrome-shrink — ale jeśli to przeszkadza w spójności, możesz wciągnąć do `space-y-3`/`space-y-4`. Nie ruszaj logiki fetch / searchParams.

### 3. `apps/web/app/(admin)/admin/clients/page.tsx`
Root `<div>` → `<div className="h-full flex flex-col">`.
- Chrome: `<div className="shrink-0 mb-4"><ClientListSearchBox initialQ={q} /></div>` (pozbądź się obecnego `mb-5` wrappera — jest redundant).
- Scrollable: `<div className="flex-1 min-h-0 overflow-auto">` wokół `ClientSearchResultsTable | ClientListTable | empty-state | fetchError`.

### 4. `apps/web/app/(admin)/admin/sklep/_components/SklepShell.tsx`
Aktualnie root: `<div style={{ padding: 24, display: "grid", ... }}>`. To psuje pattern (inline style + grid bez flex).
**After:**
- Root: `<div className="h-full grid gap-5" style={{ gridTemplateColumns: "1.5fr 1fr" }}>`. **Usuń inline padding 24** — layout.tsx już daje `p-6`. Bez ten zmianykompresja w pionie się rozjedzie.
- LEFT (`<div>`):
  - Pierwszy child (filter chips) → dodaj `shrink-0` lub osobny wrapper, bo to lewa kolumna jest gridem-flexem.
  - Faktycznie LEFT to nie flex-col domyślnie. Zamień LEFT na `<div className="h-full flex flex-col min-h-0">` z chrome `shrink-0` (chip row) i scrollable region `flex-1 min-h-0 overflow-auto` na grid produktów.
- RIGHT zostaje jak jest (panel edycji); jeśli za długi, dodaj `<div className="h-full overflow-auto">` jako wrapper.

**Critical:** `min-h-0` na każdym flex-col parent — bez tego flex children nie znają wysokości i `overflow-auto` nie zadziała.

## Definition of Done

- [ ] 4 EDITED pliki (layout.tsx + 3 page.tsx/Shell).
- [ ] Po rebuild + Playwright 1440x900: dla każdej z `/admin/orders`, `/admin/clients`, `/admin/sklep`:
  - `wrap.scrollHeight === wrap.clientHeight` (wrap nie scrolluje)
  - osobny element wewnątrz strony zwraca `overflow-y: auto` i `scrollHeight > clientHeight` (lista scrolluje internally)
  - po `scrollTop = 200` na tym elemencie — chrome (filtry) zostaje w viewport
- [ ] Pozostałe route'y (`/admin`, kanban, calendar, triggers, templates, messages, aktualnosci, settings/miejsca, /admin/orders/new) — `wrap.scrollHeight === wrap.clientHeight` (nie regresują).
- [ ] `pnpm --filter web vitest run` — pełna suite GREEN, ZERO regress.
- [ ] `pnpm --filter web typecheck` — żadnych nowych błędów (pre-existing OK).
- [ ] Commit message:
  `fix(admin-layout): sticky chrome + scrollable list on orders/clients/sklep [milestone:v2-fixes][task:v2-L]`
  Body: `Refs: docs/dispatch-log/v2-L-<UTC>.md`.
- [ ] Dispatch log `docs/dispatch-log/v2-L-<UTC>.md` w formacie zgodnym z `v2-J-20260517T094424Z.md`.

## Out of scope

- NIE ruszaj `messages` route (`MessagesShell`, `SelectedThread`, `ReplyComposer`) — owner robi to osobno.
- NIE ruszaj `OrderDrawer` ani niczego pod `apps/web/components/order-drawer/`.
- NIE dotykaj `tailwind.config.ts`, globalnego CSS, `apps/web/components/admin/AdminSidebar.tsx`, `AdminTopbar.tsx`.
- NIE rozwiązuj 27px overflow na dashboardzie — kosmetyka, owner odpuści.
- NIE dodawaj/odejmuj funkcjonalności — tylko wrappery layoutowe.

## Notes for executor

- Sklep uses Polish status enum (`"zarezerwowane"`, `"sprzedane"`) i polega na `usePageHeader` — nie rusz.
- Orders ma `OrderDrawer` renderowany WARUNKOWO przy `drawerOrder` — zostaje poza flex-col root (sibling, nie child wewnątrz scrollable region).
- Clients ma 2 ścieżki: search (`searchResults !== null`) vs page (`pageData`). Obie idą do scrollable region.
- Każdy z 3 page.tsx ma `*PageHeaderSetter` — to client component bez DOM. Zostaje w shrink-0 albo poza flex (preferred — to nie chrome).
