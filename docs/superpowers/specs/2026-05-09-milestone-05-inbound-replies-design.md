# Milestone 5 — Inbound parsing, replies, and the cross-client inbox

**Authored:** 2026-05-09 (sonnet/opus brainstorm).
**Predecessor:** Milestone 4 (Real providers + webhooks + retry) closed at tag `milestone-4`, suite 201/0/0/0.
**Successor (parked):** TBD — likely M5b for archive + attachments + cross-thread "Nowa wiadomość" polish.

## 1. Objective

Close the two-way messaging loop. M4 made outbound real (Postmark + SMSAPI) and reconciled delivery status. M5 makes inbound real: parse incoming email replies (Postmark inbound stream) and SMS MO callbacks (SMSAPI), persist them as `direction=INBOUND` rows, route them to a per-client `MessageThread`, surface them in a new cross-client `/admin/messages` inbox, expose unread state in the sidebar nav and inside the OrderDrawer, and let the operator reply from either surface. Unmatched senders (no client match) go to a quarantine bucket where the operator can claim, create-new, or discard.

By the end of M5, the workshop owner can:

1. Receive an email reply from a known client → see it appear within seconds in `/admin/messages` and (if the client also appears on an open order) see an unread banner inside that order's drawer.
2. Receive an SMS reply from a known client → same flow, SMS channel.
3. Receive an inbound from an unknown sender → see it in the "Niesparowane" filter, click "Przypisz do klienta" to attach it to an existing client (rows move under that client's thread; audit row fires), OR "Utwórz nowego klienta" to spin up a stub, OR "Odrzuć" to discard.
4. Reply from `/admin/messages` thread view (channel-aware composer) — message goes through the existing M4 outbound stack and re-uses the existing `MessageStatusBadge` + retry button.
5. See unread count in the left sidebar; clicking the nav item lands on `/admin/messages`.
6. From the OrderDrawer Wiadomości tab, see an amber banner "Klient ma N nieprzeczytanych wiadomości" linking to the relevant thread; the drawer itself stays order-scoped (only `order_id == this_order` rows render inline).

## 2. Out of scope (deferred to later milestones)

- **Archive** — design shows an archive icon in the thread header; deferred. Component will render a disabled "Wkrótce" tooltip OR be omitted in M5; archive endpoint + schema column come in M5b.
- **Attachments** — design shows a paperclip in the composer; deferred. R2 upload, MIME limits, signed URLs, schema population of `message.attachments jsonb` is its own substantial sub-feature.
- **WhatsApp inbound** — no provider stub yet, parked.
- **Per-message read state** — we keep thread-level `unread_count` only; per-row read timestamps are not introduced.
- **Auto-archive after N days of inactivity** — not in scope.
- **Search ranking / FTS** — search uses ILIKE only; if performance bites, a future migration can add `pg_trgm` GIN indexes.
- **`/admin/messages/{thread_id}` sub-routes** — selection is in-page state, not a URL parameter (except for the `?thread=xxx` deep-link from the OrderDrawer banner — supported as a query string, not a route).
- **Pricing column on Order** — the design's right-rail "Razem (spent total)" stat needs a money column on `order_` that doesn't exist. M5 stubs this as `—`. Pricing is a separate milestone.

## 3. Locked decisions (from owner-led brainstorm)

| # | Decision | Why |
|---|---|---|
| 1 | **Full M5 envelope:** inbound + reply UI in drawer + thread surfacing + unread badge + dedicated `/admin/messages` page | Owner picked the parked plan over narrower alternatives; delivers visible value end-to-end. |
| 2 | **Sender-only threading.** Email: client lookup by from-address → most-recent thread. SMS: client lookup by from-phone → most-recent thread. No `In-Reply-To` parsing. | Single-shop volume; owner can read the thread to disambiguate. Simpler than header-based matching, no Reply-To token DNS work. |
| 3 | **Unmatched inbound → quarantine bucket.** Surfaces in `/admin/messages` "Niesparowane" filter; operator action: assign-to-client, create-new-client, or discard. | Catches typos / wrong numbers without polluting the client table. |
| 4 | **Unread reset on thread open** (auto, but client-fired). Frontend issues `POST /api/admin/threads/{id}/mark-read` on render. Icon button does the same. | REST-pure. Explicit operator action audit trail. |
| 5 | **OrderDrawer = order-scoped; `/admin/messages` = client-scoped.** Drawer Wiadomości shows only `message.order_id == this_order` rows. Client-thread cross-order messages live only on the inbox page. Drawer shows an amber banner pointing at the inbox if client has unread elsewhere. | Clean concern split. Operator workflow is order-driven; comms is communication-driven. |
| 6 | **Schema: nullable `client_id` + `raw_sender VARCHAR(255)` on `message_thread` and `message`.** Unmatched: `client_id IS NULL, raw_sender = '+48 506 220 119'`. Assign-to-client = single transaction updating thread + messages. | Single source of truth for inbound. FK-decisive query for unmatched. Simplest of four options considered. |
| 7 | **Layout = owner-provided design pack.** `handoff/design/m5-messages/` is canonical. M5 implementation translates JSX mockups → TSX modules per the file paths annotated in `index.html`. | Owner runs design via Claude.ai design tool; Claude does not invent layouts. |
| 8 | **Scope-creep bundle from design audit:** include search, "Nowa wiadomość" cross-thread composer, explicit mark-read endpoint, template picker, SMS char counter, ⌘+Enter shortcut, date dividers. Stub `spent` total as `—`. Defer archive + attachments — render those design icons as disabled "Wkrótce" tooltips OR omit. | Bundled what's cheap; deferred what implies multi-milestone backend work. |
| 9 | **Polling cadence:** `/admin/messages` page polls thread list at 30s, selected thread messages at 10s. OrderDrawer banner unread count at 30s. (M4 OrderDrawer-internal poll stays at 10s.) | Operator sits longer on the inbox page; less aggressive cadence is fine. |
| 10 | **Provider inbound webhook routes:** `POST /api/webhooks/postmark/inbound` (HTTP Basic Auth, same env credentials as M4 outbound) and `POST /api/webhooks/smsapi/inbound` (IP allowlist, same 5 IPs as M4 outbound). | Reuses M4 auth wiring. No new secret rotation. Owner configures URLs in Postmark + SMSAPI panels in `prod` profile only. |

## 4. Architecture

### 4.1 Backend modules touched

| Layer | File | Change |
|---|---|---|
| **Schema** | `V012__inbound_messaging.sql` | DROP NOT NULL on `message_thread.client_id` + `message.client_id`. Add `raw_sender VARCHAR(255) NULL` to both. Add `discarded_at TIMESTAMPTZ NULL` to `message_thread` (for §4.7 soft-delete). CHECK: exactly one of (`client_id`, `raw_sender`) non-null per row. Add partial index on `message_thread (client_id) WHERE client_id IS NULL` (unmatched-bucket queries). UNIQUE partial `(provider_message_id, channel) WHERE provider_message_id IS NOT NULL` on `message` (idempotency). |
| **Domain** | `MessageThreadEntity`, `MessageEntity` | Add `rawSender: String?` field. Allow null `clientId`. |
| **Service** | `MessageThreadService` | New: `findOrCreateForClient(clientId, channel)`, `findOrCreateForRawSender(rawSender, channel)`, `assignUnmatched(threadId, targetClientId, actor)`, `discardUnmatched(threadId, actor)`, `markRead(threadId, actor)`. |
| **Service** | `InboundMessageService` (NEW) | `recordEmailInbound(PostmarkInboundPayload, actor=SYSTEM)`, `recordSmsInbound(SmsApiInboundPayload, actor=SYSTEM)`. Idempotent on `provider_message_id`. Looks up client by from-address/from-phone; routes to thread; `raw_sender` populated on unmatched. Emits `MESSAGE_RECEIVED` audit row + `MESSAGE_RECEIVED` timeline kind. |
| **Service** | `MessageRouter.sendReply(threadId, channel, subject, body, orderId?, actor)` | Sends a reply on an existing thread. Does NOT use templates (free-form body). Reuses M4 outbound path (gateway dispatch + status reconciliation lifecycle). |
| **Service** | `MessageRouter.sendNewToClient(clientId, channel, subject, body, actor)` | "Nowa wiadomość" cross-thread composer. Auto-finds-or-creates the per-channel thread for client. Free-form body (not template). |
| **Controller** | `PostmarkInboundController` (NEW) | `POST /api/webhooks/postmark/inbound`, Basic Auth, parses Postmark inbound JSON, delegates to `InboundMessageService`. |
| **Controller** | `SmsApiInboundController` (NEW) | `POST /api/webhooks/smsapi/inbound`, IP allowlist, parses SMSAPI MO form-encoded payload, delegates to `InboundMessageService`. |
| **Controller** | `ThreadController` (NEW) | `GET /api/admin/threads?filter=&channel=&q=`, `GET /api/admin/threads/{id}`, `POST /api/admin/threads/{id}/messages` (reply), `POST /api/admin/threads/{id}/mark-read`, `POST /api/admin/threads/{id}/assign` (unmatched → client), `POST /api/admin/threads/{id}/discard` (unmatched). |
| **Controller** | `MessagesController` extension | `POST /api/admin/clients/{clientId}/messages` (cross-thread compose: auto-finds-or-creates thread). |
| **DTO** | `MessageThreadDto` | Adds `rawSender`, `unmatched: boolean` (computed: clientId == null), `lastMessagePreview`, `lastMessageAt`, `unreadCount`, `clientName?`, `channel`. |
| **Audit** | `TimelineEventKind.java` (backend) + `lib/timeline/types.ts` (frontend) | Add `MESSAGE_RECEIVED`, `THREAD_MARKED_READ`, `THREAD_ASSIGNED`, `THREAD_DISCARDED`. |
| **Curator** | `TimelineEventCurator` | New `Path → Kind` mappings for the four new audit kinds. |

### 4.2 Frontend modules

| File | Source |
|---|---|
| `apps/web/app/(admin)/admin/messages/page.tsx` | composes the page; reads `?thread=...` query param for OrderDrawer deep-link |
| `apps/web/app/(admin)/admin/messages/_components/MessagesHeader.tsx` | per design |
| `apps/web/app/(admin)/admin/messages/_components/ThreadList.tsx` | search + filter chips + scrollable list |
| `apps/web/app/(admin)/admin/messages/_components/ThreadListRow.tsx` | per design (client name OR raw sender, channel chip, preview, unread bullet) |
| `apps/web/app/(admin)/admin/messages/_components/ThreadHeader.tsx` | per design (mark-read button, more-actions menu) |
| `apps/web/app/(admin)/admin/messages/_components/MessageBubble.tsx` | per design (INBOUND left, OUTBOUND right + status badge + inline retry) |
| `apps/web/app/(admin)/admin/messages/_components/ReplyComposer.tsx` | channel toggle, EMAIL subject, SMS counter, ⌘+Enter, send |
| `apps/web/app/(admin)/admin/messages/_components/ThreadClientPanel.tsx` | per design (client info; `spent` stubbed `—`; orderTotal computed; recent order link) |
| `apps/web/app/(admin)/admin/messages/_components/UnmatchedThreadPanel.tsx` | per design (assign / create-new / discard CTAs) |
| `apps/web/app/(admin)/admin/messages/_components/EmptyStates.tsx` | per design (cold-start / no-selection / no-unread / send-error) |
| `apps/web/app/(admin)/admin/messages/_components/NewMessageDialog.tsx` | "Nowa wiadomość" — Radix Dialog + ClientPicker (reuse M1) + channel + body |
| `apps/web/app/(admin)/admin/orders/_components/OrderDrawer/UnreadElsewhereBanner.tsx` | per design (amber banner, pluralization) |
| `apps/web/app/(admin)/admin/_components/Sidebar/MessagesNavItem.tsx` | per design (red badge w/ count, 99+ cap) |
| `apps/web/lib/messaging/api.ts` extension | `listThreads`, `getThread`, `sendReply`, `markThreadRead`, `assignUnmatched`, `discardUnmatched`, `sendNewToClient` |
| `apps/web/lib/messaging/types.ts` extension | `ThreadDto`, `ThreadFilter`, etc. |
| `apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx` | + `UnreadElsewhereBanner` rendered at top when `client.unreadElsewhere > 0` |

### 4.3 Data flow — inbound email

1. Postmark inbound stream POSTs JSON to `/api/webhooks/postmark/inbound` (Basic Auth verified).
2. `PostmarkInboundController` → `InboundMessageService.recordEmailInbound(payload, SYSTEM_ACTOR)`.
3. Service:
   - Idempotency check: lookup `message WHERE provider_message_id = payload.MessageID AND channel = 'EMAIL'`. If found, return; emit `INFO op=inbound.email outcome=duplicate`.
   - Lookup client by `email = payload.From` (case-insensitive, citext column).
   - If client found: `findOrCreateForClient(client.id, 'EMAIL')` — gets the most-recent EMAIL thread for that client, or creates a new one with `client_id = X, raw_sender = NULL, subject = payload.Subject`.
   - If client NOT found: `findOrCreateForRawSender(payload.From, 'EMAIL')` — gets unmatched thread keyed on (raw_sender, channel), or creates one with `client_id = NULL, raw_sender = payload.From, subject = payload.Subject`.
   - Insert `message` row: `direction=INBOUND, channel=EMAIL, body=payload.StrippedTextReply OR payload.TextBody, subject=payload.Subject, provider_message_id=payload.MessageID, sent_at=payload.Date, thread_id, client_id, raw_sender (mirror thread)`.
   - Update thread: `unread_count = unread_count + 1, last_message_at = NOW(), subject = payload.Subject (carried)`.
   - `@Audited(parent="#thread.id")` writes `MESSAGE_RECEIVED` audit row → curator emits `MESSAGE_RECEIVED` timeline kind.
4. Sidebar polling picks up the new unread count on next 30s tick.

### 4.4 Data flow — inbound SMS

Same as above, but:
- Endpoint: `POST /api/webhooks/smsapi/inbound`, IP allowlist on `Cf-Connecting-Ip` header.
- Payload: form-encoded `from`, `to`, `text`, `MsgId`, `sms_date`.
- Lookup: `client WHERE phone = normalizedFrom`.
- Channel: `'SMS'`. Subject is null.
- `provider_message_id = MsgId`.

### 4.5 Reply send flow

1. Operator types in composer; presses Send (or ⌘+Enter).
2. Frontend: `POST /api/admin/threads/{id}/messages` body `{channel, subject?, body, orderId?}` (orderId always null when sent from `/admin/messages`; the cross-thread "Nowa wiadomość" composer — also shipping in M5 — uses the separate `POST /api/admin/clients/{id}/messages` endpoint, see §4.2).
3. `ThreadController.sendReply` → `MessageRouter.sendReply(threadId, ...)` → existing M4 outbound stack (creates row, dispatches gateway, sets QUEUED→SENT, audit `MESSAGE_SENT`).
4. Webhook reconciliation later flips to DELIVERED/FAILED via M4 path.
5. Frontend updates local list + scrolls to bottom + clears composer.

### 4.6 Mark-read flow

1. On thread open (selection change): frontend calls `POST /api/admin/threads/{id}/mark-read`.
2. Service: `UPDATE message_thread SET unread_count = 0 WHERE id = ?`. Returns `ThreadDto`.
3. `@Audited(parent="#threadId")` writes `THREAD_MARKED_READ` audit row.
4. Frontend updates local thread state and the sidebar badge (subtracts the previous unread count).

### 4.7 Assign / discard unmatched flow

**Assign:**
1. Operator opens unmatched thread, clicks "Przypisz do klienta".
2. ClientPicker dialog (reused from M1).
3. `POST /api/admin/threads/{id}/assign` body `{clientId}`.
4. Service: in one transaction — `UPDATE message_thread SET client_id = ?, raw_sender = NULL WHERE id = ?` AND `UPDATE message SET client_id = ?, raw_sender = NULL WHERE thread_id = ?`. Audit `THREAD_ASSIGNED`.

**Discard:**
1. Operator clicks "Odrzuć".
2. Confirm dialog.
3. `POST /api/admin/threads/{id}/discard` — soft delete via a new `discarded_at TIMESTAMPTZ` column on `message_thread`. Audit `THREAD_DISCARDED`.
4. Discarded threads excluded from `/admin/messages` listings by default.

## 5. Threat model / security notes

- **Inbound webhook auth** is the new attack surface. Postmark uses Basic Auth (creds in env, same as M4 outbound). SMSAPI uses IP allowlist (5 IPs, same as M4 outbound). NEITHER endpoint requires admin session — they are public except for the auth check.
- **Idempotency:** `provider_message_id` is the dedup key. UNIQUE partial index. Replays are no-ops.
- **Spam pollution:** unmatched bucket is the safety valve. Operator can `Odrzuć` to soft-delete. No auto-cleanup in M5.
- **CSRF:** new admin endpoints (`/api/admin/threads/...`) inherit the existing CSRF wiring from M0B (cookie-based, double-submit). Webhook endpoints opt out via the existing matcher in `SecurityConfig` (already covers `/api/webhooks/...`).
- **RBAC:** all `/api/admin/threads/...` and `/api/admin/clients/{id}/messages` endpoints require `hasAnyRole('OWNER','EMPLOYEE')` — same as existing messaging surface.

## 6. Test strategy

- **Migration test:** `V012` applies cleanly on top of M4's V011 schema; existing data preserved (all current threads have `raw_sender = NULL`); CHECK constraints pass.
- **Repository tests:** `MessageThreadRepository.findUnmatched()`, `findByRawSender(channel, sender)`, partial index works.
- **Service tests:** `InboundMessageService` with mocked `clientRepo`. Covers: matched email, matched SMS, unmatched email, unmatched SMS, duplicate (idempotency).
- **Integration tests:** `PostmarkInboundControllerIntegrationTest` (4-7 cases): Basic-Auth required, valid payload → INBOUND row + thread + audit + timeline event, duplicate idempotent, unmatched bucket lookup. `SmsApiInboundControllerIntegrationTest` (mirror). `ThreadControllerIntegrationTest`: list/filter/search, get-thread, reply send, mark-read, assign, discard.
- **Frontend:** typecheck + lint + build green. No new component-level tests (consistent with M2/M3/M4).
- **Manual smoke:** automated only (matches M2/M3/M4 precedent).

**IT naming:** `*IntegrationTest.java` only (per M3-hygiene-debt-now-fixed).

## 7. Wave sketch (will be detailed by `superpowers:writing-plans`)

| Wave | Tasks (preliminary) | Theme | Review |
|---|---|---|---|
| 1 — Schema + domain | 5-1 V012 migration (nullable client_id, raw_sender, discarded_at, idempotency unique), 5-2 entity updates + repos + repo IT | Foundation | combined |
| 2 — Inbound services | 5-3 `InboundMessageService` (email + SMS, with idempotency), 5-4 `PostmarkInboundController` + IT (Basic Auth, payload parsing), 5-5 `SmsApiInboundController` + IT (IP allowlist, MO payload), 5-6 timeline kinds + curator wiring | Inbound rail | two-stage on 5-3 (security-sensitive) and 5-6 (cross-cutting) |
| 3 — Threads API | 5-7 `MessageThreadService` extensions (find-or-create, mark-read, assign, discard) + tests, 5-8 `ThreadController` + IT (list/filter/search/get/mark-read/assign/discard), 5-9 reply send (`POST /threads/{id}/messages`) + IT, 5-10 cross-thread compose (`POST /clients/{id}/messages`) + IT | Operator API | two-stage on 5-8 (large surface + RBAC) |
| 4 — Frontend lib + sidebar | 5-11 `lib/messaging` extensions (ThreadDto, listThreads, getThread, sendReply, markThreadRead, assignUnmatched, discardUnmatched, sendNewToClient), 5-12 `MessagesNavItem` (sidebar) + unread polling, 5-13 `OrderDrawer/UnreadElsewhereBanner` integration | UI plumbing | combined |
| 5 — Inbox page | 5-14 page shell + ThreadList + filter chips + search, 5-15 ThreadHeader + MessageBubble + 10s polling on selected thread, 5-16 ReplyComposer (channel toggle, subject, SMS counter, ⌘+Enter, send), 5-17 ThreadClientPanel (`spent` stubbed), 5-18 EmptyStates + UnmatchedThreadPanel + assign/discard wiring, 5-19 NewMessageDialog (cross-thread composer w/ ClientPicker) | Inbox vertical | two-stage on 5-14 (multi-component composition) and 5-16 (composer state model) |
| 6 — Closure | 5-20 mvn verify + frontend gates + milestone-5 tag + CLAUDE.md flip | Closure | combined |

Estimated 20 tasks across 6 waves. Concrete plan written by `superpowers:writing-plans`.

## 8. Success criteria (M5 ship gates)

1. All M5 tasks marked `completed` in `docs/dispatch-log/tasks.json` with commit SHAs.
2. `mvn -B -f backend/pom.xml verify` — BUILD SUCCESS, suite ≥ 220, 0 failures, 0 errors, 0 skipped (M4 close was 201; M5 adds inbound ITs + thread controller ITs).
3. `cd apps/web && pnpm typecheck && pnpm lint && pnpm build` — all three green.
4. Local git tag `milestone-5` annotated with what shipped, suite count, smoke approach, deferred items.
5. `CLAUDE.md` status row appended: `- [x] Milestone 5: Inbound parsing + reply UI + cross-client inbox`.
6. Session memory entry summarizing M5 with a paste-ready resume prompt.

## 9. Open errata candidates (to be filled by writing-plans / dispatch)

- **Postmark inbound payload field names** — `From`, `To`, `Subject`, `TextBody`, `HtmlBody`, `StrippedTextReply`, `MessageID`, `Date`. Verify against current Postmark inbound stream docs at plan-write time.
- **SMSAPI MO payload format** — Verify whether SMSAPI sends `application/x-www-form-urlencoded` OR JSON. Field set: `MsgId`, `from`, `to`, `text`, `sms_date`. Verify in SMSAPI documentation; we may need both parsers.
- **Phone normalization** — inbound SMS `from` can be `+48506220119`, `48506220119`, or `00 48 506 220 119`. Need a normalizer matching the format we store in `client.phone`. Reuse / extract from M1 ClientService validation if one exists.
- **`order_.code` on right-rail "Aktywne zlecenie"** — design references "DR-1042". The recent-order lookup picks the client's most-recent order with status NOT IN (WYDANE, ANULOWANE); if none, the right rail collapses that section.
- **Cross-thread compose endpoint reuse vs new** — `POST /api/admin/clients/{id}/messages` is new. Could alternatively reuse `POST /api/admin/orders/{orderId}/messages` if we add `orderId=null` semantics — but that changes the M2-locked contract. Sticking with a new endpoint.

## 10. Carry-forward debt to address in or after M5

- **`MessageRouter` ≥293 LOC + `sendRetry`/`send` duplication** (from M4 review). M5 adds `sendReply` and `sendNewToClient` — duplication risk grows. Recommended: extract `MessageGatewayDispatcher` (gateway dispatch + status update + thread bump) BEFORE adding new methods, OR right after M5-3 finishes the 3rd method-clone. Flag it during `writing-plans` so a hygiene step lands in Wave 2.
- **`OrderDrawerMessages` (M4) NITs:** generic Polish error string (404 vs 409 indistinguishable), no race-cancel guard on `orderId` switch. Both worth fixing if we touch the file in M5-13 anyway.

---

<!-- Spec coverage: §1-§10 inform the implementation plan. Layout source-of-truth: handoff/design/m5-messages/. -->
