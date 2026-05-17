# Dr Shoes — Locked Decisions (post-Q&A)

Frozen on 2026-05-07 from user replies to the consolidated questions message. These override defaults in `BRIEF.md`, `DATA_MODEL.md`, `API_SURFACE.md` where they conflict. Subsequent refinements live in `ARCHITECTURE.md`.

## Stack
- **Backend:** Java 21, Spring Boot 3.4, Maven (multi-module).
- **Maven microlibraries** under `backend/libs/`:
  - `messaging-core` — neutral interfaces, no Spring deps.
  - `email-gateway` — Postmark + SMTP + no-op impls, Spring Boot autoconfig.
  - `sms-gateway` — SMSAPI.pl + Twilio + no-op impls, Spring Boot autoconfig.
  - `storage` — S3-compatible (R2 / MinIO / Hetzner OS), Spring Boot autoconfig.
  - Reusable across future projects. Published to GitHub Packages (private).
- **Frontend:** Next.js 16 App Router + TypeScript + Tailwind. Single app, route groups `(public)` and `(admin)`. **Public layer = minimal viable** (reservations + service intake into `WSTĘPNIE_PRZYJĘTE`). **Admin layer is the product** — engineering focus here.
- **DB:** PostgreSQL 16. **Object storage:** Cloudflare R2 (prod) / MinIO (local).
- **Package manager:** pnpm. **Monorepo orchestration:** Turborepo for FE; Maven for BE.

## Hosting / Ops
- **Cloudflare Containers** for backend, frontend, postgres — three containers.
- **R2** for object storage. **Cloudflare** handles TLS + CDN.
- ⚠️ **Postgres caveat documented in ARCHITECTURE.md §Deployment** — production Postgres in a Container has weaker ops than managed (Neon, Supabase). We accept this for v1, plan a managed swap path in case ops burden becomes real.
- **CI/CD:** GitHub Actions → build images → push to registry → `wrangler containers deploy`.
- **Backups:** nightly `pg_dump` → R2, 30-day retention, weekly restore-test in CI.

## Integrations
- **Email:** Postmark (primary). SMTP fallback. EU region.
- **SMS:** SMSAPI.pl (primary, PL-friendly). Twilio impl available.
- **WhatsApp:** stub interface, no impl in v1.
- **Maps:** Google Maps embed iframe (no API key).
- **Analytics:** none.
- **Payments:** all payment-related UI/logic stubbed as "do zdefiniowania" — no integration in v1.
- **Anti-bot:** honeypot + per-IP rate limit; Turnstile if abuse appears.

## Domain logic
- **Order status enum** (free transitions, no enforced state-machine):
  `WSTEPNIE_PRZYJETE` → `PRZYJETE` → `W_REALIZACJI` → `CZEKA_NA_KLIENTA` → `GOTOWE_DO_ODBIORU` → `WYDANE` → `ANULOWANE`.
  Free transitions between any two; **every transition logged in `OrderEvent`** with actor, timestamp, from/to, optional note.
- **Trigger confirmation:** when a status change matches an enabled trigger, UI shows a **confirmation modal with rendered message preview**; admin can edit/skip/send. Skipped sends are still logged.
- **Order code:** `DR-2025-0042`, year-resetting per-year sequence.
- **`WYDANE` orders:** read-only except photos and notes. Re-open via explicit "Wznów" with reason logged.
- **Single craftsman per order** (`assigned_craftsman_id`). Collaborators in notes.
- **Order types** (canonical, no expansion in v1): `NAPRAWA`, `CUSTOM_BUTY`, `CUSTOM_KURTKA`. (Adding more later = data migration only.)
- **Currency:** PLN, integer cents.
- **Reservation TTL:** 48h, auto-expires, product returns to `DOSTEPNE`, admin notified.
- **Storage locations** (new entity): admin-managed list (`StorageLocation` — code/name/description/active). Each order has optional `current_storage_location_id`. Moves are audited via `OrderEvent`.

## RBAC
- Roles: `OWNER`, `EMPLOYEE`, (`CRAFTSMAN`, `OFFICE` reserved for future split).
- **OWNER** — full access including delete, settings, RBAC, triggers config.
- **EMPLOYEE** — read all; create/edit orders, items, photos, notes, messages; change status; move storage location; **cannot** delete (orders, products, news, clients), cannot edit triggers/templates/settings, cannot manage users.
- All write actions logged with `actor_user_id` in `OrderEvent` (or equivalent audit table per entity).

## Order Event log (new requirement)
Every order has a chronological event feed visible in the drawer. Events include:
- status change (with from/to)
- storage location move
- item added / edited / removed
- photo added / labeled / removed
- internal note added
- message sent / received
- assignment change
- schedule change (planned_pickup_at)
- order created / cancelled / restored

Stored as `OrderEvent` rows; rendered as a vertical timeline.

## Triggers (seeded enabled)
1. `Zlecenie przyjęte` — on `STATUS_CHANGE → PRZYJETE`, immediate.
2. `Gotowe do odbioru` — on `STATUS_CHANGE → GOTOWE_DO_ODBIORU`, immediate.
3. `Przypomnienie o odbiorze` — `BEFORE_PICKUP_X_DAYS=1`, scheduled 09:00 PL.
4. `Prośba o opinię` — `AFTER_HANDOVER_Y_DAYS=3`, scheduled 11:00 PL.

Trigger delays in arbitrary minutes (UI: hours+minutes).

## Auth
- HTTP-only session cookies, Spring Session JDBC store.
- CSRF: double-submit cookie pattern, token via `X-CSRF-Token` header for non-GET.
- Login throttle: 5 attempts / 15min / IP.

## Testing
- Backend: JUnit 5, Testcontainers (Postgres + MinIO), WireMock (Postmark/SMSAPI). 70% on services, 100% on trigger engine + reservation expirator + status state machine + RBAC enforcer.
- Frontend: Playwright smoke (login, create order, status change w/ trigger, kanban drag, send message, public reservation, public service intake).

## i18n
Polish only at launch. `next-intl` scaffolded; copy in `pl.json` dictionaries. Adding EN/DE = drop-in dictionaries.

## Out of scope (v1)
Native mobile, POS, fiscal printer, customer self-service portal, payments, analytics, IG embed.

## Workflow
- **Opus 4.7** (this Claude session) — architecture, planning, review, taste decisions.
- **Sonnet** (dispatched subagents) — implementation, mechanical edits, test scaffolding.
- Atomic commits, conventional commit prefixes (`feat`, `fix`, `refactor`, `test`, `chore`, `docs`).

## Open / deferred
- Production Postgres ops on Cloudflare Containers — revisit if ops burden grows; managed-swap path documented in `ARCHITECTURE.md`.
- Real WhatsApp + payments + fiscal — stubs in v1.
- Data migration from existing systems — needs source from Misza if any exists.
