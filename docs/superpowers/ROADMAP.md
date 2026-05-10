# Dr Shoes — Forward Roadmap

**Last updated:** 2026-05-10
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

## In flight

| Milestone | Scope | Status | Plan |
|---|---|---|---|
| **M6** | Order processing polish + Dashboard — Calendar + Kanban + bulk + presets + W0 hygiene | **0/23** (planning complete; W0 ready to dispatch) | `docs/superpowers/plans/2026-05-10-milestone-06-orders-dashboard.md` |

## Next — locked priority

### M6 — Order Processing Polish + Dashboard

**Theme:** Make the daily Misza-flow smooth. Orders + Dashboard.

**Likely scope (will be refined in `superpowers:brainstorming` next session):**
- **Dashboard:** real KPI tiles wired to backend
  - Zlecenia w realizacji (in-progress count by status)
  - Gotowe do odbioru (ready-for-pickup count + age distribution)
  - Zaległe (overdue per due_at)
  - Nowe rezerwacje (last 24h orders, possibly by source)
  - Recent activity feed (last N audit events curator-projected)
  - Optional: today/this-week revenue if pricing is in scope
- **Orders processing polish:**
  - Three switchable list views (BRIEF spec) — table / cards / calendar (or kanban)
  - Bulk status changes
  - Filtering + sorting beyond what M1 shipped (date range, customer, item type, technician)
  - Quick actions from list rows (status bump, photo add, message)
  - History view per order (audit timeline already exists; surface as a tab)
  - Export / print (probably defer)
- **Operational ergonomics:**
  - Keyboard shortcuts on common actions
  - Empty/loading/error state polish
  - Inline edit for items + status without opening drawer
- **Carry-forward hygiene from M4/M5 closure:**
  - `MessageRouter` 293 LOC split
  - `sendRetry/send` duplication dedup
  - `MessagesControllerIntegrationTest` cross-test flake (`AdminWebTestBase.seedUsers` FK ordering)

### M7 — Clients UI + minimal Sklep/News stubs

**Theme:** Round out admin nav with the surfaces still missing UI.

**Likely scope:**
- **Clients UI** — `/admin/clients`
  - List (search, filter by channel preference, RODO consent state)
  - Detail page — profile + order history + message thread links + photos referenced
  - Inline edit (contact, channel, RODO toggle)
  - Probably no separate "create client" flow — clients are created via order intake
- **Sklep — minimal stub** — `/admin/sklep`
  - Single page with "do implementacji w przyszłości" / coming-soon placeholder
  - Optional: shell of a reservation list (read-only) if intake from public site already exists
- **Aktualności — minimal stub** — `/admin/aktualnosci`
  - Single page with the same stub pattern
  - Optional: trivial CRUD if we want owner to be able to post one news item

### M8+ — Deferred, no commitment

- Sklep real implementation (catalog, reservations management, inventory)
- Aktualności real implementation (markdown editor, schedule, public site rendering)
- Public landing page (BRIEF Layer 1) beyond minimal-viable
- Reports / advanced analytics
- Multi-user RBAC nuances beyond OWNER/EMPLOYEE
- Mobile-tuned admin layout

## Decision log

- **2026-05-10** — Sklep + Aktualności deprioritized to stubs by owner directive. Resources reallocated to Dashboard + order-processing polish (M6) and Clients UI (M7). Reasoning: daily Misza workflow is order-processing, not catalog/news authoring.
