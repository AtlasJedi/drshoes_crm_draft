# Dispatch log — Task C: Order list columns reorder + uppercase headers

**UTC timestamp:** 2026-05-19T21:29:40Z
**Branch:** client-adjustments-2026-05-19
**Commit SHA:** db9351a

---

## Files touched

| File | Change |
|---|---|
| `apps/web/app/(admin)/admin/orders/_components/OrdersTable.tsx` | New column set, import `shortCode`, drop `LocationChip`/`PhImg` imports, use `shortCode(row.code)` in code cell, remove MIEJSCE+FOTO `<td>` rows, UPPERCASE `className` on all `<th>` |
| `apps/web/lib/orders/format.ts` | New file — exports `shortCode(code: string): string` (strips `DR-\d{4}-` prefix) |
| `apps/web/lib/orders/__tests__/format.test.ts` | New file — vitest for `shortCode` (5 cases) |
| `apps/web/app/(admin)/admin/orders/_components/__tests__/OrdersTable.test.tsx` | Rewritten — adds header-order, uppercase, shortCode, no-FOTO/MIEJSCE assertions; keeps urgent-highlight test |

---

## Before → After column list

**Before:** Kod, Status, Klient, Pozycje, Przyjęto, Termin odbioru, Miejsce, Foto, Suma

**After:** NR ZAMÓWIENIA, STATUS, KLIENT, OPIS, PRZYJĘCIE, ODBIÓR, SUMA

---

## Test results

**Task C specific tests (2 files):** 7 passed / 0 failed

- `lib/orders/__tests__/format.test.ts` — 5 tests (shortCode prefix strip + legacy fallback)
- `orders/_components/__tests__/OrdersTable.test.tsx` — 7 tests (header order, uppercase, shortCode cell, no MIEJSCE/FOTO, urgent highlight)

**Full suite:** 580 passed / 15 failed — the 15 failures are pre-existing from Task B's enum replacement (KanbanBoard 5-column assertion, NewOrderForm kind/label tests). Not introduced by Task C.

---

## Decisions

- `shortCode` placed in new `apps/web/lib/orders/format.ts` (no existing `format.ts` was present).
- `PhImg` and `LocationChip` imports removed entirely since no other columns use them.
- `uppercase` Tailwind class applied to all labeled `<th>` elements for consistency. `SortableColumnHeader` renders the label text, so the parent `<th className="uppercase">` applies `text-transform: uppercase` via CSS inheritance.
