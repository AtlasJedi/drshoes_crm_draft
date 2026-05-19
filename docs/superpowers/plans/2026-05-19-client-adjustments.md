# 2026-05-19 — Client adjustments (post-M9 demo round)

**Branch:** `client-adjustments-2026-05-19` (off `main` @ `c02b875`)
**Owner directive (verbatim, 2026-05-19):**

> 1. simplified dashboard view for not admin (worker). view with only "pilne" listed and statictics with types of order items (defined later new in 3.). in admin dashboard "pilne" listed instead of "gotowe do odbioru" section. make this section wider deleting świeże rezerwacje. we leave "nowe wiadomości"
> 2. Pilne now has new requirements. new order should be marked as "pilne" after 4 days. changing status from "przyjęte" on any other should remove "pilne" state
> 3. we add few more "pozycja zlecenia": now enum should go "CZYSZCZENIE" as default in new order item, than RENOWACJA, NAPRAWA, SZEWC, CUSTOM. Those should be reflected in dashboard statistics, now it only has naprawa and custom. we replace enum, destroy exising records to simplyfy.
> 4. in order list we want displayed in order: kod (named in list "nr zamówienia", shorten it to number, truncat DR-year), status, klient, opis (Pozycje name changed to opis), PRZYJĘCIE, ODBIÓR, SUMA. everything uppercase.
> 5. nowe zlecenie update: planowany odbiór now has +1,2,4 weeks, we want +1,2,3 weeks.
> 6. in order item drawer change Zaliczka amount color to dark green
> 7. in callender view we want "!" in front of order item when it has pilne status. pilne now applies only to rule defined in 1., not after 2 weeks.

**Dispatch style (locked):** Opus designs; Sonnet implements via thin prompts pointing at this plan; dispatch logs to `docs/dispatch-log/`. Two-stage review ONLY where flagged. Stay on this branch. Rebuild + restart containers at the end.

---

## Audit findings (ground truth as of 2026-05-19)

| Concern | Current | File:line |
|---|---|---|
| OrderItemKind enum | `USLUGA, CUSTOM, NAPRAWA, RENOWACJA` | `backend/app/src/main/java/com/drshoes/app/order/domain/OrderItemKind.java:8-12` |
| Kind labels PL | Usługa / Custom / Naprawa / Renowacje | `apps/web/lib/orders/status.ts:60-65` |
| Kind dropdown order | KIND_OPTIONS list | `apps/web/app/(admin)/admin/orders/_components/ItemEditRow.tsx`, `.../new/_components/NewOrderItemRow.tsx`, `OrdersFilters.tsx:15` |
| `order_items.kind` CHECK | `IN ('NAPRAWA','CUSTOM','USLUGA','RENOWACJA')` (last updated V029) | `backend/.../db/migration/V029__order_item_kind_expand.sql:4-5` |
| Urgency rule (computed) | 14 days, excludes WYDANE/ANULOWANE/WSTEPNIE_PRZYJETE; allows PRZYJETE/W_REALIZACJI/CZEKA_NA_KLIENTA/GOTOWE_DO_ODBIORU | `OrderUrgency.java:9-21` |
| Urgent spec filter | 14d cutoff, status IN {PRZYJETE, W_REALIZACJI, CZEKA_NA_KLIENTA, GOTOWE_DO_ODBIORU} | `OrderSpecifications.java:86-93` |
| MeResponse incl. role | yes — `role` in body | `AuthController.java:123-130`, `apps/web/lib/auth/types.ts` |
| Admin layout | role-blind | `apps/web/app/(admin)/admin/layout.tsx:35-49` |
| Dashboard sections | KPI row → charts (OrdersWeek + MixDonut) → 3-col bottom: ReadyForPickup (1.2fr) · RecentMessages (1fr) · FreshReservations (1fr) | `apps/web/app/(admin)/admin/page.tsx:60-70` |
| Mix donut buckets | 4 kinds (USLUGA/CUSTOM/NAPRAWA/RENOWACJA) | `DashboardChartsController.java:39-94`, `MixDonut.tsx` |
| Order list columns | Kod, Status, Klient, Pozycje, Przyjęto, Termin odbioru, Miejsce, Foto, Suma | `OrdersTable.tsx:64-72` |
| New-order quick-picks | +1 / +2 / +4 weeks | `NewOrderForm.tsx:35-39` |
| Drawer Zaliczka | rendered without color accent in `OrderDrawerInfoBlock.tsx:64` (class `t-stencil`, accent=false) | same file |
| Calendar item label | `{order.code} · {order.clientName.split(" ")[0]}` (CalendarResponseDto already carries `urgent`) | `CalendarMonthGrid.tsx:173-175`, `CalendarResponseDto.java:27-38` |
| Latest migration | V032 | `db/migration/` |
| OrderStatus enum | `WSTEPNIE_PRZYJETE, PRZYJETE, W_REALIZACJI, CZEKA_NA_KLIENTA, GOTOWE_DO_ODBIORU, WYDANE, ANULOWANE` | `OrderStatus.java:8-15` |

---

## Tasks (dispatch order)

### Task A — Urgency rule rewrite (Adj #2)  **TWO-STAGE**

**Goal:** A new order becomes "pilne" iff `status == PRZYJETE` AND `receivedAt + 4 days <= now`. Any status change away from `PRZYJETE` clears the flag automatically (because the flag is computed, not stored — the status change alone is enough).

**Changes:**
1. `OrderUrgency.java` — replace `THRESHOLD_DAYS = 14` → `THRESHOLD_DAYS = 4`. Replace `if (EXCLUDED.contains(status)) return false;` with `if (status != OrderStatus.PRZYJETE) return false;`. Delete the `EXCLUDED` set if unused after. Update class-level Javadoc.
2. `OrderSpecifications.java` lines 86–93 — change `Instant cutoff = ...minusSeconds(14L * 86400L)` to `4L * 86400L`. Change `root.get("status").in(PRZYJETE, W_REALIZACJI, CZEKA_NA_KLIENTA, GOTOWE_DO_ODBIORU)` to `cb.equal(root.get("status"), OrderStatus.PRZYJETE)`.
3. Tests:
   - Find every test that asserts on the 14-day or multi-status urgency (likely `OrderUrgencyTest`, `OrderSpecificationsTest`, any integration test that creates an order then asserts `urgent=true`). Update fixtures: shift `receivedAt` to >4d ago + status `PRZYJETE` for urgent cases. Add a regression case: status `W_REALIZACJI` with received 30 days ago → `urgent=false`.
   - No new DB migration needed (computed flag).
4. Frontend: the `Pilne` saved-filter button keeps `?urgent=true` — no FE change needed (rule is server-side). Verify badge count refreshes against new semantics.

**Acceptance:**
- Order created with status PRZYJETE and `receivedAt` 5 days ago → `urgent=true`.
- Same order moved to W_REALIZACJI → `urgent=false` on next fetch.
- Order with `receivedAt` 3 days ago, status PRZYJETE → `urgent=false`.
- Backend suite GREEN.

**Stage 2 review focus:** confirm no caller relies on the old EXCLUDED list (search for usages); confirm calendar/kanban/dashboard endpoints still pass urgent through correctly; spec query plan unchanged (single equality is fine).

---

### Task B — OrderItemKind enum replacement (Adj #3)  **TWO-STAGE**

**Goal:** Replace enum values with `CZYSZCZENIE` (default), `RENOWACJA`, `NAPRAWA`, `SZEWC`, `CUSTOM` (this exact order in the dropdown). Destroy existing `order_items` rows.

**Changes:**

**Backend:**
1. `OrderItemKind.java` — replace enum values to: `CZYSZCZENIE, RENOWACJA, NAPRAWA, SZEWC, CUSTOM` (order matters; the enum's declaration order is the canonical UI order).
2. New migration `V033__order_item_kind_v2.sql`:
   ```sql
   -- Owner directive (2026-05-19): destroy existing order_items to simplify enum migration.
   TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;
   ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_kind_check;
   ALTER TABLE order_items
     ADD CONSTRAINT order_items_kind_check
     CHECK (kind IN ('CZYSZCZENIE', 'RENOWACJA', 'NAPRAWA', 'SZEWC', 'CUSTOM'));
   ALTER TABLE order_items ALTER COLUMN kind SET DEFAULT 'CZYSZCZENIE';
   ```
   - Verify no other table FKs to `order_items.id` blocks truncation; if they do (e.g. photos referencing order_items, audit_log payload_json — payload is jsonb, no FK), CASCADE will handle it. Photos are tied to orders, not items. Audit_log carries entity refs as strings/jsonb.
3. `DashboardChartsController.java` (`/api/admin/dashboard/charts`) — update kind bucket aggregation: return one entry per new kind (CZYSZCZENIE, RENOWACJA, NAPRAWA, SZEWC, CUSTOM). Existing test fixtures need fresh kind values.
4. Any service/validator referencing old kinds (USLUGA-specific code, if any) — fail-loud delete; do not silently default. Grep for `USLUGA`, `OrderItemKind.USLUGA`.
5. Tests — backend unit + IT: replace fixture kinds. Add an enum-order assertion test that pins the declared values + order.

**Frontend:**
6. `apps/web/lib/orders/types.ts:28` — replace `OrderItemKind` union: `"CZYSZCZENIE" | "RENOWACJA" | "NAPRAWA" | "SZEWC" | "CUSTOM"`.
7. `apps/web/lib/orders/status.ts:60-65` — replace `KIND_LABELS_PL`:
   - `CZYSZCZENIE → "Czyszczenie"`
   - `RENOWACJA → "Renowacja"`
   - `NAPRAWA → "Naprawa"`
   - `SZEWC → "Szewc"`
   - `CUSTOM → "Custom"`
8. KIND_OPTIONS arrays (`ItemEditRow.tsx`, `NewOrderItemRow.tsx`, `OrdersFilters.tsx`) — rebuild in canonical order: CZYSZCZENIE first (default for new rows), then RENOWACJA, NAPRAWA, SZEWC, CUSTOM.
9. New-order item default — ensure the form initializes `kind: "CZYSZCZENIE"` when adding a new row (search NewOrderForm.tsx + NewOrderItemRow.tsx for the default).
10. `MixDonut.tsx` and any palette mapping (likely a kind→color map nearby) — extend with two more colors for the two new kinds. Reuse existing palette tokens; do NOT invent new hex.
11. Existing vitest specs that mention `USLUGA` etc — rebuild with new kinds.

**Acceptance:**
- After migration: `order_items` table empty, CHECK accepts only the 5 new values.
- Backend boot GREEN.
- Dashboard donut shows 5 buckets (empty data tolerable; structure visible).
- New-order modal default item kind is "Czyszczenie", dropdown order matches: Czyszczenie / Renowacja / Naprawa / Szewc / Custom.
- Order filter chips show all 5.
- Backend suite GREEN. Frontend vitest GREEN.

**Stage 2 review focus:** zero references to removed `USLUGA` remain (grep `USLUGA` returns 0). No accidental references to old `CUSTOM_BUTY`/`CUSTOM_KURTKA` (already deleted per V029 but worth re-checking). Dropdown order matches enum declaration. Migration applies idempotently on a fresh DB.

---

### Task C — Order list columns (Adj #4)  **SINGLE-STAGE**

**Goal:** Reshape `OrdersTable.tsx:64-72` columns to:

| Column | Header (UPPER) | Source |
|---|---|---|
| 1 | NR ZAMÓWIENIA | `order.code` minus `DR-YYYY-` prefix (e.g. `DR-2026-0013` → `0013`). Add a tiny helper `shortCode(code)` in `apps/web/lib/orders/format.ts` (or wherever `pricePLN` lives). |
| 2 | STATUS | unchanged badge |
| 3 | KLIENT | unchanged |
| 4 | OPIS | was `POZYCJE` — same data, only header text changes |
| 5 | PRZYJĘCIE | was `Przyjęto` — same data, header only |
| 6 | ODBIÓR | was `Termin odbioru` — same data, header only |
| 7 | SUMA | unchanged right-aligned |

**Removed columns:** `MIEJSCE`, `FOTO`. Delete the corresponding `<th>`, `<td>`, and any width/right-align CSS classes pinned to these columns.

**Header casing:** all headers UPPERCASE in the rendered DOM (apply via `text-transform: uppercase` if not already; check existing className). The existing screenshot mixed (`Kod` / `KLIENT`) — confirm a single util class is consistent.

**Acceptance:**
- Visual: column order + headers exactly as listed.
- Code `0013` rendered for `DR-2026-0013`. Other prefixes (legacy `DR-2025-XXXX`) also stripped.
- Existing E2E/Playwright that asserted column text needs update.
- vitest for OrdersTable header rendering green.

---

### Task D — Pilne dashboard panel + role-aware dashboard (Adj #1)  **SINGLE-STAGE (combined)**

**Goal:** Two-layer dashboard:
- `me.role == 'OWNER'` → admin view (new layout below).
- otherwise (EMPLOYEE / CRAFTSMAN / OFFICE) → worker view: just Pilne + kind-statistics panel.

**Admin layout (replaces today's bottom 3-col row):**
- Row 1 (unchanged): `KpiTilesRow`
- Row 2 (unchanged): `OrdersWeekChart` + `MixDonut`
- Row 3 (NEW): two columns: **PilnePanel (wide, ~1.5fr)** + **RecentMessagesPanel (~1fr)**.
- Delete `FreshReservationsPanel` import + usage from `admin/page.tsx`. Do NOT delete the component file yet — leave it in case it's reused elsewhere; remove only if grep shows no other usage.
- Delete `ReadyForPickupPanel` from the dashboard row (the panel component file stays — owner did not ask for component deletion; it's still useful in the orders list as a saved filter).

**Worker layout:**
- Top: `PilnePanel` full-width.
- Bottom: a compact `MixDonut` OR a new `KindStatsPanel` (whichever is simplest — recommend reusing `MixDonut` inside an `AdminCard` titled "Statystyki pozycji").
- No KPI row, no week chart, no messages panel. Keep it minimal — worker view is for quickly seeing what needs attention.

**PilnePanel (new component):**
- Path: `apps/web/app/(admin)/admin/_components/PilnePanel.tsx`
- Clone `ReadyForPickupPanel.tsx` pattern (AdminCard wrapper, loading/error/empty states).
- Data source: `listOrdersServer({ urgent: true, limit: 12 }, ...)` — same backend filter as the "Pilne" saved-filter chip (which now means the new 4d/PRZYJETE rule from Task A).
- Show: row per order with `shortCode`, klient, days-in-shop badge. Link target: `/admin/orders/{id}`.
- Polish title: "Pilne" with subtitle "Status przyjęte > 4 dni".

**Acceptance:**
- Logged in as OWNER → admin dashboard with Pilne (wide) + Nowe wiadomości; no "Świeże rezerwacje", no "Gotowe do odbioru" panel on dashboard.
- Logged in as non-OWNER → worker dashboard with only Pilne + statystyki pozycji.
- Empty-Pilne state renders the same empty card pattern as other panels.
- Backend + frontend tests green.

---

### Task E — New-order quick-picks +1/+2/+3 (Adj #5)  **INLINE**

`NewOrderForm.tsx:35-39` — change the `QUICK_PICKS` constant: replace the `+4 tyg.` entry with `{ label: "+3 tyg.", days: 21 }`. Final array: `[{ label: "+1 tydz.", days: 7 }, { label: "+2 tyg.", days: 14 }, { label: "+3 tyg.", days: 21 }]`. Update any vitest that asserts those labels.

---

### Task F — Drawer Zaliczka dark-green (Adj #6)  **INLINE**

`OrderDrawerInfoBlock.tsx:64` — find the "Zaliczka" entry (label, value, accent). Add a new optional prop or className token to make its value text render in dark green. Use an existing token from the design system if present (search `apps/web` for `green-dark`, `text-green-700`, etc.). If no existing token, add a Tailwind class like `text-green-800` (or whatever the project uses — match `OrderDrawerInfoBlock.tsx` className style). The dark green ONLY applies to Zaliczka value, not the label.

Existing visual snapshot tests (Playwright) may need golden update — defer to the verification pass.

---

### Task G — Calendar "!" prefix on pilne items (Adj #7)  **SINGLE-STAGE**

`CalendarMonthGrid.tsx:173-175` — current JSX: `{order.code} · {order.clientName.split(" ")[0]}`. Modify to render `!` prefix conditionally:

```tsx
{order.urgent ? <span className="t-pilne-marker">!</span> : null}{order.code} · {order.clientName.split(" ")[0]}
```

`order.urgent` is already on `CalendarOrderEntry` (backend `CalendarResponseDto`). Style the marker token (`t-pilne-marker`) bold / red / whatever the design system uses for urgency — match existing "pilne" badge color elsewhere in the app for consistency.

Vitest: add a render-test that creates two calendar entries (one with `urgent:true`, one false) and asserts the prefix only on the urgent one.

---

## Dispatch sequencing

```
A (urgency rule, TWO-STAGE)  ──┐
B (enum replacement, TWO-STAGE) ──┐
                                  ├─→ D (dashboard role + Pilne panel + section swap, combined)
                                  ├─→ G (calendar "!" — needs A's new urgent semantics)
C (order list cols, single)  ─────┤  (parallel-safe, no dependency on A/B)
E (week shortcuts, inline)    ────┤  (main session inline)
F (Zaliczka color, inline)    ────┘  (main session inline)
```

Run order (one at a time to keep dispatch logs clean):

1. **Task A** — Sonnet, TWO-STAGE Stage 1 + Stage 2. Commit when GREEN.
2. **Task B** — Sonnet, TWO-STAGE Stage 1 + Stage 2. Commit when GREEN. (Owner approved record destruction.)
3. **Task C** — Sonnet, single-stage. Combined review.
4. **Task D** — Sonnet, single-stage (chunky but UI-only, low risk). Combined review.
5. **Task G** — Sonnet, single-stage.
6. **Task E** — main session inline (2-line change).
7. **Task F** — main session inline (1-line className).
8. **Final** — rebuild + restart + Playwright drive.

---

## Verification (final task)

1. `mvn -pl app -am -DskipTests clean package` then `docker compose build web backend && docker compose up -d`.
2. Wait for healthy on /actuator/health and / for web.
3. Drive via Playwright as OWNER:
   - Admin dashboard: panels = `Pilne` (wide) + `Nowe wiadomości`. No `Świeże rezerwacje`. No `Gotowe do odbioru`. ✓
   - Orders list: headers exactly `NR ZAMÓWIENIA / STATUS / KLIENT / OPIS / PRZYJĘCIE / ODBIÓR / SUMA`; first column shows `0013` style codes; no FOTO, no MIEJSCE. ✓
   - New order modal: kind dropdown starts with Czyszczenie; quick-picks read `+1 / +2 / +3 tyg.`. ✓
   - Order drawer: Zaliczka amount renders dark green. ✓
   - Calendar: drop an order to PRZYJETE + age >4d and confirm `!` prefix on its chip. ✓
4. Switch session role to EMPLOYEE (seed creds or dev shortcut) → worker dashboard shows Pilne + statystyki only.
5. Tail backend logs for any urgent-rule errors; check audit_log for new schema warnings.

## Hygiene to carry forward
- If `FreshReservationsPanel` ends up with zero usages after Task D, remove the file in a follow-up PR (not in this branch — owner asked only for section removal from the dashboard).
- The pre-existing `t-stencil` class on the drawer info — if Tailwind tokens are unclear, ask owner before inventing new color tokens for Zaliczka.
