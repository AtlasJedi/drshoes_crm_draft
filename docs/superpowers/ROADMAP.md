# Dr Shoes — Forward Roadmap

**Last updated:** 2026-05-11
**Source of truth for milestone scope after the BRIEF.md handoff.**

## Scope rule (locked 2026-05-10 by owner)

> "Sklep / Shop admin and Aktualności / News admin become **minimal stubs only**.
> No fancy functions. Either limited surfaces or `for implementation` placeholders.
> The real focus is **Dashboard + order-processing functionality** — adding,
> processing, history, everything that makes the daily workflow smooth."

This re-prioritizes the BRIEF.md scope. Sklep + Aktualności full implementation
is **deferred to post-launch milestones** (no calendar slot). Order-processing
polish + Dashboard with live data become the next active milestone(s).

## Done

| Milestone | Scope | Tag |
|---|---|---|
| **M0A** | Foundation skeleton — health endpoint, V001, web renders | `milestone-0a` |
| **M0B** | Auth + RBAC + audit log + login UI + admin guard | `milestone-0b` |
| **M1** | Orders — domain, list, drawer, items, status changes, audit timeline | `milestone-1` |
| **M2** | Messaging — outbound providers (logging gateway), templates, manual send, triggers | `milestone-2` |
| **M3** | Photos — upload (R2/MinIO), order_photo, actor resolution | `milestone-3` |
| **M4** | Real providers — Postmark + SmsApi + webhooks + delivery reconciliation + retry | `milestone-4` |
| **M5** | Inbound replies — message_thread, parsing, reply UI, unread badge, /admin/messages page | `milestone-5` |
| **M6** | Order processing polish + Dashboard — KPIs, charts, calendar, kanban (DnD), bulk actions, filter presets, row quick-actions | `milestone-6` |
| **M7** | Clients UI (list, detail, sub-tabs, edit modal) + minimal Sklep/Aktualności stubs + sidebar nav | _(tag deferred to owner)_ |
| **M8** | Demo-Ready Foundation — one-command boot, OTel tracing, Playwright gate, smart-fix scripts | `milestone-8` |
| **M9** | Design Parity — graffiti design system rewrite (tokens + fonts + 12 primitives + icons) + dark-ribbon admin shell + every admin view to design fidelity + full public landing + V017 product_reservation backend slice. Closed 2026-05-16. HEAD at close: `011945b1da331249411bcd6a24933601fd76a1c2`. Backend 409/0/0/0, frontend 521/521 vitest, Playwright 12/12 parity audit. | `milestone-9` (local) |

## In flight

_(none — M9 implementation closed 2026-05-16; awaiting owner sign-off + push)_

## Next — M10 candidate backlog

All items below were deferred from M9 (via 9-41 parity audit + 9-43 closure). Scope for M10 to be refined in brainstorming.

### M10 — Polish, wiring, and real implementations

**Carry-forward from M9 (identified in 9-41 parity audit):**

- **Drag-drop wiring** — `UnscheduledOrdersPanel` drop handler (9-28 stub), kanban "+ dodaj" column button (9-29 stub). UI ships visually; behaviour stubs with `console.warn`. Real DnD wiring deferred.
- **Order drawer add-tag flow** — "+ dodaj tag" chip (9-26 stub). Click handler stubbed with `// TODO M10`.
- **AdminTopbar global search handler** — design shows `Szukaj zlecenia, klienta…` search input + notification bell. Topbar renders the shell; search and notifications are wired to `// TODO M10` stubs.
- **Notifications popover** — bell icon in AdminTopbar with badge count. Popover content and real data feed deferred.
- **FreshReservationsPanel live data** — dashboard panel (9-22) ships with placeholder rows. Endpoint `GET /api/admin/sklep/reservations?limit=3` was not wired (cross-cutting note B from plan). Need a list-across-products controller method + wire the component.
- **MixDonut chart rendering** — donut chart area on dashboard shows empty. Recharts/Chart.js integration for the pie segment visual not yet landed.
- **Light / dark mode toggle** — design system tokens exist but theme switcher UI not implemented.
- **Mobile-responsive layouts** — admin shell and views not mobile-tuned. Desktop-first only through M9.
- **Real `/sklep` + `/aktualności` implementations** — Sklep catalog + reservations management; Aktualności markdown editor + scheduling. Currently minimal stubs (M7 locked scope). No calendar slot until owner directs.
- **Map iframe precise coords** — Contact section on public landing uses placeholder coords. Replace with the workshop's actual address coords.
- **Container rebuild for M9 visual verification** — web Docker image at close predates M9 commits. Rebuild with `docker compose build web && docker compose up -d web` + re-run `m9-parity-audit.spec.ts` to confirm post-M9 parity.

## Decision log

- **2026-05-10** — Sklep + Aktualności deprioritized to stubs by owner directive. Resources reallocated to Dashboard + order-processing polish (M6) and Clients UI (M7). Reasoning: daily Misza workflow is order-processing, not catalog/news authoring.
- **2026-05-11** — M7 closed under owner anti-bloat directive: TWO-STAGE flag on 7-15 (EditClientModal) collapsed to combined single-stage; 7-16 + 7-17 executed inline by main session instead of dispatched. Saves ~3 subagent roundtrips for ~250 LOC of pure-config UI work. Pattern locked: substantial-form modals without security/business logic do not require TWO-STAGE.
