# Task B Stage 2 Review — OrderItemKind v2

**UTC:** 2026-05-19T19:27:22Z
**Commit under review:** `5ac8503`
**Reviewer:** independent (Opus, main session)
**Plan ref:** `docs/superpowers/plans/2026-05-19-client-adjustments.md § Task B`
**Dispatch log:** `docs/dispatch-log/task-b-orderitemkind-20260519T192424Z.md`

---

## Verdict: APPROVED

All 10 checklist items pass. No blocking findings.

---

## Per-item findings

**1. Enum declaration order** — PASS.
`OrderItemKind.java` declares: `CZYSZCZENIE, RENOWACJA, NAPRAWA, SZEWC, CUSTOM`. Exact canonical order per plan.

**2. Migration body (V033)** — PASS with one note.
Migration applies to table `order_item` (singular — correct actual table name; plan used `order_items` with 's', dispatch log documents the correction). Four DDL statements present and correct:
(a) `TRUNCATE TABLE order_item RESTART IDENTITY CASCADE;`
(b) `ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_kind_check;`
(c) `ADD CONSTRAINT order_item_kind_check CHECK (kind IN ('CZYSZCZENIE','RENOWACJA','NAPRAWA','SZEWC','CUSTOM'));`
(d) `ALTER TABLE order_item ALTER COLUMN kind SET DEFAULT 'CZYSZCZENIE';`
No extra DDL.

**3. No old values remain** — PASS.
```
grep USLUGA / CUSTOM_BUTY / CUSTOM_KURTKA in backend/app/src/main: 0 source hits
grep USLUGA / CUSTOM_BUTY / CUSTOM_KURTKA in apps/web: 0 source hits
```
The sole `USLUGA` occurrence in `OrderItemKind.java` is in a Javadoc comment (historical note: "V029 added USLUGA... superseded by V033"). Not active code.

**4. Frontend canonical order** — PASS.
- `OrdersFilters.tsx`: `ALL_KINDS = ["CZYSZCZENIE","RENOWACJA","NAPRAWA","SZEWC","CUSTOM"]` — exact canonical order.
- `ItemEditRow.tsx` and `NewOrderItemRow.tsx`: `KIND_OPTIONS = Object.entries(KIND_LABELS_PL)` — order is derived from `KIND_LABELS_PL` object literal. `KIND_LABELS_PL` is declared in `status.ts` as `CZYSZCZENIE, RENOWACJA, NAPRAWA, SZEWC, CUSTOM` (canonical order). In modern V8/Node.js, string-keyed object iteration preserves insertion order. This is correct.

**5. Polish labels** — PASS.
`KIND_LABELS_PL` in `status.ts` maps: `CZYSZCZENIE→"Czyszczenie"`, `RENOWACJA→"Renowacja"`, `NAPRAWA→"Naprawa"`, `SZEWC→"Szewc"`, `CUSTOM→"Custom"`. No leftover entries. Old entry `USLUGA→"Usługa"` removed; `RENOWACJA` corrected from old "Renowacje" to "Renowacja".

**6. MixDonut + dashboard charts** — PASS.
Backend `DashboardChartsController.java` zero-fills all 5 kinds using `KIND_ORDER = List.of(...)` with LinkedHashMap, ensuring all 5 buckets always appear even when DB is empty. Frontend `MixDonut.tsx` `KIND_COLORS` maps all 5 kinds to project palette tokens:
`CZYSZCZENIE→var(--acid)`, `RENOWACJA→var(--blue)`, `NAPRAWA→var(--orange)`, `SZEWC→var(--green)`, `CUSTOM→var(--pink)`. All 5 tokens confirmed existing in `globals.css` (e.g. `--green: #18b06b`; `--acid`, `--blue`, `--orange`, `--pink` all pre-existing). No new hex invented.

**7. Default for new item** — PASS.
- `NewOrderForm.tsx`: `makeFreshItem()` returns `{ kind: "CZYSZCZENIE", ... }`.
- `OrderDrawerItems.tsx`: `BLANK = { kind: "CZYSZCZENIE", ... }` (add-item blank).
Both initializers set `CZYSZCZENIE`.

**8. FK impact** — PASS.
Grep for `REFERENCES order_item` across all migrations:
```
V001__init.sql:  order_item_id UUID REFERENCES order_item(id) ON DELETE SET NULL
V009__photo.sql: order_item_id UUID REFERENCES order_item(id) ON DELETE SET NULL
V033__order_item_kind_v2.sql: (comment only)
```
Only `photo.order_item_id` FKs into `order_item.id`, with `ON DELETE SET NULL`. TRUNCATE CASCADE correctly nullifies those references. No other FKs. Audit log is JSONB strings, no FK constraint.

**9. Enum-order assertion test** — PASS.
`OrderItemKindTest.java` added with 3 tests:
- `enumValuesAreExactlyFiveInCanonicalOrder` — pins all 5 values + positions.
- `czyszczenieIsOrdinalZero` — confirms default is ordinal 0.
- `enumNamesMatchExpected` — name string assertions.
Solid pin. Suite reported +3 tests (509→512).

**10. Pre-existing FE failures (KanbanBoard)** — PASS.
The 1 reported KanbanBoard failure is actually `KanbanCard.test.tsx`. Reading the test: all 6 assertions test `urgent` badge visibility, `plannedPickupAt` null rendering, `itemSummary` empty, and router navigation. Zero references to `OrderItemKind` values. The failure is entirely unrelated to Task B (likely an inaccessible-role JSDOM issue). Task B did not introduce or worsen it.

---

## Hygiene

1. **`TemplateContextBuilder.polishKindLabel` switch** — exhaustive switch covers all 5 arms. Label values are lowercase (`"czyszczenie"`, `"naprawa"`, etc.) — inconsistent with frontend `KIND_LABELS_PL` title-case (`"Czyszczenie"`). Not a bug (template usage may intentionally lowercase), but worth a follow-up to confirm intent.
2. **Dispatch log commit SHA mismatch** — log records SHA `8ba22ad` but actual commit is `5ac8503`. The two are different SHAs; the log was likely written before the final amend/rebase. Minor bookkeeping issue.
3. **`ItemEditRow`/`NewOrderItemRow` KIND_OPTIONS** — derived from `Object.entries(KIND_LABELS_PL)`. Works correctly in V8, but a future refactor of `KIND_LABELS_PL` to use a Map or reorder keys could silently break dropdown order. Non-blocking; the explicit `ALL_KINDS` pattern in `OrdersFilters.tsx` is slightly more defensive. Consider standardizing in a future cleanup.
