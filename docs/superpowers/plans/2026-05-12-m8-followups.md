# M8 Follow-ups — Post Live Demo Test (2026-05-12)

**Status:** Owner is mid-test of M8 demo stack. New gaps surfacing from manual exploration. This plan covers the post-test fixups, plus the M8 hygiene items deferred from earlier waves. NOT the same as 8-22 Stage 2 / 8-23 (those still pending and lower priority).

**Source of truth:** Tasks live in `docs/dispatch-log/tasks.json` with ids `m8-fb-*`. Each dispatch writes its own log under `docs/dispatch-log/m8-fb-*-<UTC>.md`. Anti-bloat protocol applies (combined single-stage unless explicitly two-stage).

**HEAD when written:** `0cc1698` (last commit from m8-fb-1b note feature)
**Backend suite at write-time:** 398/0/0/0
**Frontend vitest at write-time:** 203/0/0/0

---

## Already shipped this session (recap)

| Task | What | Commit(s) |
|---|---|---|
| m8-fb-1 | Backend sort allowlist + ChangeStatusRequest.note field | `65d4367` `3efeeb8` |
| m8-fb-1a | Frontend clickable sort headers on `/admin/orders` | `106e245` `35e7d6a` `625d21a` |
| m8-fb-1b | V015 `audit_log.note` + HasAuditNote aspect + dialog + timeline display | `9cc0780` `102f46b` `4e97531` `0cc1698` |

---

## Tasks (prioritized — work top-down)

### m8-fb-2 — Sidebar nav: link `/admin/triggers` + `/admin/templates`

**Why:** Both pages exist (`apps/web/app/(admin)/admin/triggers/page.tsx`, `.../templates/page.tsx`) plus a route under `/admin/triggers/[id]` and `/admin/templates/[id]` / `.../new`. They are NOT linked from `AdminSidebarNav.tsx`, so the owner can only reach them by typing the URL. Owner directive 2026-05-12: "i cant see triggers in admin panel, should be there."

**Spec:**
- Add a new section `Komunikacja` to `AdminSidebarNav.tsx` between `Operacje` and `Sklep` (matches existing section pattern).
- Two `NavLink`s:
  - `/admin/triggers` → label `Trigery`
  - `/admin/templates` → label `Szablony wiadomości`
- Keep the existing `MessagesNavItem` where it is (under `Operacje`).
- Vitest: render test confirming both links appear; both highlight when on their respective routes.

**Dispatch:** combined single-stage. ~15 min. Anti-bloat applies.

---

### m8-fb-3 — Verify trigger/template admin pages actually work

**Why:** Pages exist but were written in earlier milestones. Confirm they:
- list rows from the API without 500s
- the detail page (`/admin/triggers/[id]`) renders edit form
- save → reload → persisted state visible
- no console errors in browser dev tools

**Spec:**
- Boot stack (`docker compose up -d --build` if not already running).
- Visit `/admin/triggers` and `/admin/templates`. Verify list renders, click into a row, edit, save.
- If anything's broken, file under "Discovered bugs" in the dispatch log; fix the trivial ones inline; defer the rest to new `m8-fb-*` tasks.

**Dispatch:** likely manual smoke check by owner OR a single Playwright spec extension. Decision deferred to whoever picks it up — recommendation is a 5-minute owner manual pass first, then a spec if owner finds bugs.

---

### m8-fb-4 — `OrderListRow` projection: add `receivedAt`, `pickedUpAt`, `createdAt`

**Why:** m8-fb-1a added clickable sort headers for `Przyjęto`, `Wydano`, `Utworzono` columns, but the data cells render `—` because backend `OrderListRow` does not include these fields. Sort works server-side; only display is missing.

**Spec:**
- Locate `OrderListRow` (Java DTO returned by `GET /api/admin/orders`).
- Add `receivedAt: Instant`, `pickedUpAt: Instant | null`, `createdAt: Instant` fields.
- Update the JPA projection / mapper that builds it.
- Format in the UI using existing date formatters (probably `lib/format/date.ts` or similar). Polish locale, `dd.MM.yyyy` for date-only columns, `dd.MM.yyyy HH:mm` for createdAt if that level of detail is wanted (owner can decide visual treatment).
- Backend test: assert each field returns non-null where expected.
- Frontend test: assert cells render values when populated, `—` when null (only `pickedUpAt` should ever be null in practice).

**Dispatch:** combined single-stage. ~45 min. Anti-bloat applies.

---

### m8-fb-5 — Spring Session auto-truncate on local profile boot

**Why:** 8-22 Stage 1 flagged this as a FOLLOWUP: Spring Session JDBC stores rows in `SPRING_SESSION` / `SPRING_SESSION_ATTRIBUTES`. On repeated demo-stack restarts, stale rows cause a primary-key collision during fresh logins (500 error). The Stage 1 manual workaround is `docker compose exec postgres psql -U drshoes -c "TRUNCATE SPRING_SESSION CASCADE"`.

**Spec:**
- Add `LocalProfileSessionFlusher` (CommandLineRunner OR `@EventListener(ContextRefreshedEvent.class)`) under `@Profile("local")` that truncates both tables at startup.
- Log: `op=session.truncate profile=local outcome=cleared rowCount=<n>`.
- Test (`*IntegrationTest.java`): boot a local-profile context, assert the flusher fires and clears the tables.

**Dispatch:** combined single-stage. ~30 min. Anti-bloat applies. Pure dev-only helper.

---

### m8-fb-6 — Sidebar nav audit (orphaned admin pages)

**Why:** Triggers + Templates were orphans. There may be others.

**Spec:**
- Grep `apps/web/app/(admin)/` for all `page.tsx` files. Cross-reference against `AdminSidebarNav.tsx`. Surface every page that has no nav link.
- Owner picks which ones get linked (some may be intentionally hidden — e.g. settings, debug pages).

**Dispatch:** thin discovery task — maybe 10 min. Output is a markdown table in the dispatch log + a question to owner. NO code unless owner confirms additions.

---

## Out of scope for this plan

- **8-22 Stage 2** (independent review of demo-flow E2E spec) — deferred to M8 closure. Demo works, Stage 2 is polish.
- **8-23** (README "Run the demo" + milestone close commit + milestone-8 tag) — deferred to M8 closure.
- **M9 hygiene items** carried from earlier waves:
  - UUID regex case-insensitive in `AuditWriteCoordinator.extractEntityType` (Stage 2 of 8-7 follow-up)
  - OTel `propagateTraceHeaderCorsUrls` scope restriction (Stage 2 of 8-15 follow-up)
  - `service.name=drshoes-web-browser` distinct from server (Stage 2 of 8-15 follow-up)
  - Jaeger port `4318` not exposed in Cloudflare Containers prod compose (deploy-time concern)
  - OTel exporter test-log noise suppression
- **Sklep / Aktualności real implementations** — owner-locked as stubs only (memory entry `project_scope_post_m5`).

---

## Anti-bloat reminder (locked 2026-05-11)

- TWO-STAGE only for backend/security/state-machines/migrations with risk. The migrations in this plan (none new) and the sidebar nav (no risk) all collapse to single-stage.
- Dispatch prompts THIN — point at this plan + task id + dispatch log path, don't re-paste task text.
- Each dispatch writes its own log + updates `tasks.json`.

---

## Resume from a fresh session

After `/clear`, paste this:

```
continue project_session_2026_05_12_followups.md
```

If that memory entry doesn't exist yet, paste this instead:

```
Read docs/superpowers/plans/2026-05-12-m8-followups.md.
Verify HEAD with git log --oneline -1.
Confirm task status with:
  python3 -c "import json;d=json.load(open('docs/dispatch-log/tasks.json'));[print(t['id'],t['status']) for t in d['tasks'] if t['id'].startswith('m8-fb-')]"
Then dispatch m8-fb-2 (sidebar nav for triggers + templates) cold per the dispatch template.
```
