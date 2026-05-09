# Milestone 4 — Real Providers (Postmark + SMSAPI) + Delivery Reconciliation

**Status:** approved 2026-05-09 · scope locked through brainstorm
**Predecessor:** Milestone 3 (Photos + Actor) closed at tag `milestone-3`, suite 167/0/0/0
**Successor (parked):** Milestone 5 — Inbound parsing + reply UI

## 1. Objective

Replace the LoggingEmailGateway / LoggingSmsGateway stubs with real provider implementations (Postmark for email, SMSAPI.pl for SMS) and close the delivery feedback loop via HMAC-verified webhook receivers that reconcile `message.delivery_status` from `SENT` to `DELIVERED` or `FAILED`. Add a manual "Wyślij ponownie" retry path for failed sends. Inbound message parsing and reply UI are explicitly out of scope.

By the end of M4, an operator can:

- Send a real email via Postmark and a real SMS via SMSAPI.pl from the OrderDrawer Wiadomości tab (in `prod` profile).
- See live delivery status badges (`Kolejka` → `Wysłane` → `Doręczone` / `Niedoręczone`) updating in the thread within 10s of the provider firing the webhook.
- Click "Wyślij ponownie" on a `Niedoręczone` message and see a new outbound attempt appear in the thread linked to the original.
- See `MESSAGE_DELIVERED` and `MESSAGE_FAILED` events in the Audyt tab.

By the end of M4, a developer can:

- Run `docker compose up` locally and exercise the messaging UI without burning provider quotas (Logging gateways remain default in `dev`/`test`/`local`).
- Run `mvn verify` to exercise the full provider integration via WireMock without network access.

## 2. Locked decisions (from brainstorm)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Outbound + reconciliation only.** Inbound parsing + reply UI parked for M5. | Keeps M4 demoable in ~15 tasks. Inbound is its own large surface (parsing, threading rules, unread state, top-nav inbox) that benefits from being a separate milestone. |
| 2 | **Sync send + manual retry button.** No DB outbox, no `@Scheduled` retry worker. | Single-shop scale; transient provider failures are rare; operator-initiated retry is the simplest UX with the cleanest audit trail. Outbox is a future-milestone concern if volume forces it. |
| 3 | **DELIVERED + FAILED only.** No READ / open-tracking. | Covers the operational need ("did it arrive?"). Open tracking adds privacy footnote (1px pixel) and an email-only code path. The existing `read_at` column stays null — easy to populate in a future milestone. |
| 4 | **Profile-gated provider selection.** Real impls active only when `messaging.{email,sms}.provider=postmark|smsapi`. Logging impls remain the default for `dev`/`test`/`local`. | No provider quota burn locally. No cloudflared in compose. Webhooks tested via Testcontainers + WireMock IT. Real provider testing happens in staging/prod where a public webhook URL exists. |

## 3. Architecture

### 3.1 Component layout

```
backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/
  EmailGateway.java                   (existing)
  LoggingEmailGateway.java            (existing — default in dev/test/local)
  EmailGatewayAutoConfiguration.java  (existing — wires Logging when no provider)
  postmark/                           (NEW)
    PostmarkEmailGateway.java         (~110 LOC) implements EmailGateway
    PostmarkPayloadMapper.java        (~70 LOC)  OutboundMessage → JSON
    PostmarkResponseMapper.java       (~50 LOC)  HTTP response → DeliveryReceipt
    PostmarkProperties.java           (~30 LOC)  @ConfigurationProperties
    PostmarkAutoConfiguration.java    (~40 LOC)  @ConditionalOnProperty(...="postmark")

backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/
  SmsGateway.java                     (existing)
  LoggingSmsGateway.java              (existing — default in dev/test/local)
  SmsGatewayAutoConfiguration.java    (existing — wires Logging when no provider)
  smsapi/                             (NEW)
    SmsApiSmsGateway.java             (~100 LOC) implements SmsGateway
    SmsApiPayloadMapper.java          (~50 LOC)
    SmsApiResponseMapper.java         (~50 LOC)
    SmsApiProperties.java             (~30 LOC)
    SmsApiAutoConfiguration.java      (~40 LOC)  @ConditionalOnProperty(...="smsapi")

backend/libs/messaging-core/src/main/java/com/drshoes/lib/messaging/
  WebhookEvent.java                   (extend with `Provider provider` + `String providerEventId`)
  Provider.java                       (NEW: enum POSTMARK, SMSAPI)
  WebhookSignatureVerifier.java       (NEW: ~60 LOC, provider-agnostic interface)
                                       impls (Postmark/SMSAPI) live in respective microlibs

backend/app/src/main/java/com/drshoes/app/
  webhooks/                           (NEW package)
    PostmarkWebhookController.java    (~80 LOC)  /api/webhooks/postmark
    SmsApiWebhookController.java      (~80 LOC)  /api/webhooks/smsapi
    WebhookEventMapper.java           (~70 LOC)  raw payload → normalized WebhookEvent
  messaging/
    service/
      WebhookStatusReconciler.java    (~70 LOC)  domain logic + @Audited
      MessageRetryService.java        (~60 LOC)  manual retry + @Audited
    api/
      MessagesController.java         (existing, +1 endpoint: POST /retry)
    domain/
      WebhookEventEntity.java         (NEW: JPA entity for webhook_event table)
      WebhookEventRepository.java     (NEW)
  audit/dto/
    TimelineEventKind.java            (existing, +2 kinds: MESSAGE_DELIVERED, MESSAGE_FAILED)

apps/web/lib/messaging/
  api.ts                              (existing, +retryMessage)
  types.ts                            (existing, extend MessageDto)

apps/web/app/(admin)/admin/orders/_components/
  OrderDrawerMessages.tsx             (existing, status badge + retry button + 10s polling)
  MessageStatusBadge.tsx              (NEW: ~30 LOC)
```

### 3.2 Data flow — outbound send (sync; unchanged from M2 except provider impl)

1. `MessageRouter.sendManual` / `sendForTrigger` → `INSERT message (delivery_status='QUEUED')` + audit row inside the request transaction.
2. Calls `EmailGateway.send` / `SmsGateway.send`. In `prod`: PostmarkEmailGateway / SmsApiSmsGateway.
3. Provider returns `DeliveryReceipt`:
   - **Success:** `UPDATE message SET delivery_status='SENT', provider_message_id=?, sent_at=now()`.
   - **Failure (any kind — 4xx / 5xx / network / provider-inline-error / attachment-too-large):** `UPDATE message SET delivery_status='FAILED', error_code=?, error_message=?, sent_at=now()`.
4. Audit row (`MESSAGE_SENT` timeline kind) is written by the existing M2 path regardless of `delivery_status` outcome — the row exists either way.

The send transaction stays atomic. A FAILED row is a successful transaction whose outcome was failure.

### 3.3 Data flow — webhook reconciliation (async)

1. Provider sends a callback:
   - **Postmark** → `POST /api/webhooks/postmark` (JSON body, `Authorization: Basic ...` header).
   - **SMSAPI** → `GET /api/webhooks/smsapi?MsgId=...&status=...&...` (no auth header; identity by source IP).
   Both paths are public + CSRF-exempt (already opened in `SecurityConfig`).
2. Controller authenticates the request:
   - Postmark: constant-time Basic-auth credential compare. Mismatch → **401**, zero DB writes.
   - SMSAPI: source IP must be in `messaging.sms.smsapi.callback-allowlist`. Mismatch → **403**, zero DB writes.
3. Controller parses payload (Postmark JSON / SMSAPI query params) → normalized `WebhookEvent(provider, providerMessageId, providerEventId, mappedStatus, occurredAt, rawPayload)`. `providerEventId` is empty/null for Postmark (no per-event id) and for SMSAPI; dedupe relies on the state-guarded UPDATE for both.
4. Events that don't map to `DELIVERED` / `FAILED` (Postmark `Click`, `Open`, `SubscriptionChange`; SMSAPI `QUEUE`/`ACCEPTD`/`SENT`) are short-circuited inside the reconciler: INSERT `webhook_event` with `applied_outcome='DROPPED'`, return 200.
5. `WebhookStatusReconciler.apply(event)` (`@Audited`):
   1. INSERT `webhook_event`. ON CONFLICT on `UNIQUE(provider, provider_event_id)` → `applied_outcome='DEDUP'`, return.
   2. `SELECT message WHERE provider_message_id=?` filtered by channel (POSTMARK→EMAIL, SMSAPI→SMS). Missing → `applied_outcome='NO_MESSAGE'`, return.
   3. State-guarded UPDATE: `UPDATE message SET delivery_status=?, delivered_at=?, error_code=?, error_message=? WHERE id=? AND delivery_status IN ('SENT','QUEUED')`. Zero rows → `applied_outcome='NO_TRANSITION'`.
   4. One row → `applied_outcome='APPLIED'`. The `@Audited` aspect writes an audit_log row; `TimelineEventCurator` dispatches `MESSAGE_DELIVERED` or `MESSAGE_FAILED` based on the new `delivery_status`.
6. Controller always returns 200 (except for 401 on bad signature and 400 on unparseable JSON). Provider retry policy handles transient receiver failures.

### 3.4 Data flow — manual retry (sync)

1. Operator clicks "Wyślij ponownie" on a FAILED message → `POST /api/admin/messages/{id}/retry`.
2. `MessageRetryService.retry(failedMessageId, AdminPrincipal actor)`:
   1. Loads failed message + RBAC ownership check (operator must be able to see the parent order — same pattern as `OrderController`).
   2. Validates `delivery_status='FAILED'`. Otherwise **409 Conflict** with `code='NOT_RETRYABLE'`.
   3. Computes `retry_attempt = original.retry_attempt + 1`, `idempotency_key = original.idempotency_key + ":retry-" + N`.
   4. Builds new `OutboundMessage` (same channel/recipient/subject/body/attachments).
   5. Delegates to `MessageRouter.sendManual` (or a new internal `sendRetry` entry point) — produces a new `message` row with `retry_of_message_id` FK to the original. `MESSAGE_SENT` timeline event for the new row.
3. Returns the new `MessageDto` (status `SENT`, `QUEUED`, or `FAILED` depending on provider response).

The original FAILED row is preserved as historical record. Thread shows both messages; client UI renders them in chronological order with a visual "↳" linking the retry to its original.

### 3.5 Schema — V010

```sql
-- backend/app/src/main/resources/db/migration/V010__messaging_providers.sql

-- Webhook event log: forensics + dedupe
CREATE TABLE webhook_event (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider             VARCHAR(20) NOT NULL CHECK (provider IN ('POSTMARK','SMSAPI')),
  provider_event_id    VARCHAR(120),
  provider_message_id  VARCHAR(120),
  message_id           UUID REFERENCES message(id) ON DELETE SET NULL,
  event_type           VARCHAR(40) NOT NULL,                  -- raw provider event name (e.g. 'Delivery','Bounce','DELIVERED')
  applied_status       VARCHAR(16) CHECK (applied_status IN ('DELIVERED','FAILED')),  -- NULL when DROPPED
  applied_outcome      VARCHAR(20) NOT NULL CHECK (applied_outcome IN
                         ('APPLIED','DEDUP','NO_MESSAGE','NO_TRANSITION','DROPPED')),
  raw_payload          JSONB NOT NULL,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at           TIMESTAMPTZ
);
CREATE UNIQUE INDEX webhook_event_provider_eventid_uq
  ON webhook_event (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE INDEX webhook_event_provider_msgid_idx
  ON webhook_event (provider, provider_message_id);

-- Note: dedupe is best-effort. Providers that don't supply an event id (e.g. SMSAPI
-- form callbacks where `MsgId` may be the only identifier) cannot be dedup'd at the
-- DB level; their state-guarded UPDATE is the secondary defense (NO_TRANSITION on
-- repeat application). Spec accepts this — webhook replays are rare in practice.

-- Retry chain on message
ALTER TABLE message
  ADD COLUMN retry_of_message_id UUID REFERENCES message(id),
  ADD COLUMN retry_attempt        INTEGER NOT NULL DEFAULT 1;
CREATE INDEX message_retry_chain_idx ON message (retry_of_message_id)
  WHERE retry_of_message_id IS NOT NULL;
```

### 3.6 Webhook authentication (pinned at plan time, 2026-05-09)

**Postmark — HTTP Basic Auth.** Postmark does not ship HMAC signatures for webhooks. Operator embeds credentials in the webhook URL configured in the Postmark dashboard (`https://drshoes:<secret>@api.drshoes.pl/api/webhooks/postmark`), and Postmark sends `Authorization: Basic <base64(drshoes:secret)>` on every callback. `messaging.email.postmark.webhook-username` defaults to `drshoes`; `messaging.email.postmark.webhook-secret` is the password. Verification: constant-time compare of decoded credentials.

**SMSAPI.pl — IP allowlist only.** SMSAPI does NOT sign callbacks. Authentication is by source IP. Fixed allowlist (current as of 2026-05-09):

```
89.174.81.98
91.185.187.219
213.189.53.211
31.186.83.18
212.91.26.253
```

Stored in `messaging.sms.smsapi.callback-allowlist` (comma-separated), read at startup. Per-request: extract client IP (respecting `X-Forwarded-For` set by the reverse proxy in production — which one? our deploy is Cloudflare Containers; the platform sets `Cf-Connecting-Ip`. Read from the configured header property `messaging.sms.smsapi.client-ip-header`, default `X-Forwarded-For` and falls back to `request.remoteAddr`). Reject (403) if IP is not in allowlist.

Both authentication failures fail closed: 401 (Postmark Basic) / 403 (SMSAPI IP). No DB writes on rejection.

### 3.6.1 Webhook HTTP method + response shape (pinned)

| Provider | Method | Path | Content-Type | Required response |
|---|---|---|---|---|
| Postmark | POST | `/api/webhooks/postmark` | `application/json` | 200 with empty body (or any body, ignored) |
| SMSAPI | **GET** | `/api/webhooks/smsapi` | n/a (URL params) | 200 with literal text body `OK` |

SMSAPI requires the response body to be exactly `OK` (case-sensitive) per its docs — otherwise it retries. Spring `@GetMapping` returning `String "OK"` with `text/plain`. **The spec's earlier assumption that both providers POST is corrected here.**

### 3.6.2 SMSAPI callback fields (pinned)

GET query parameters: `MsgId`, `status` (numeric code), `donedate` (UNIX timestamp), `idx` (custom value passed in send), `from`, `to`, `points`, `sent_at`, `username`, `mcc`, `mnc`, `status_name`.

Status code mapping (status_name preferred when present):
- `DELIVERED` (status=404 in legacy, status_name="DELIVERED") → `DELIVERED`.
- `UNDELIVERED`, `EXPIRED`, `FAILED`, `REJECTD`, `UNKNOWN` → `FAILED` with `error_code=status_name`.
- `QUEUE`, `ACCEPTD`, `SENT` → no transition (still in flight on provider side; M4 already wrote SENT inline).

Plan-time research note: status code numerics differ across SMSAPI API versions; the plan MUST use `status_name` text values (preferred) and only fall back to numeric `status` if `status_name` is missing in the callback. Plan task 4-2 will pin the exact mapping table from current SMSAPI docs at implementation time.

### 3.6.3 Postmark webhook records (pinned)

Top-level `RecordType` field discriminates events. Records relevant to delivery_status reconciliation:

| RecordType | Mapped status | Error fields read |
|---|---|---|
| `Delivery` | `DELIVERED` | n/a |
| `Bounce` | `FAILED` | `Type`, `TypeCode`, `Description` (combined into `error_message`) |
| `SpamComplaint` | `FAILED` | `error_code='SPAM_COMPLAINT'` |
| `Open`, `Click`, `SubscriptionChange` | drop (`applied_outcome='DROPPED'`) | n/a |

Common fields across record types: `MessageID` (used for `provider_message_id` lookup), `MessageStream`, `RecordType`, server-assigned timestamp.

Postmark fires a unique webhook payload per event; there is no separate `event_id` field — `provider_event_id` is the empty string for Postmark, so the dedupe UNIQUE index does NOT apply (it's `WHERE provider_event_id IS NOT NULL`). Dedupe falls back to state-guarded UPDATE (already designed). Spec accepts this — Postmark documents at-least-once delivery, but in practice repeat webhooks for the same record are rare; state guard handles them.

### 3.7 Profile activation (config)

```yaml
# backend/app/src/main/resources/application.yaml (no provider configured → Logging defaults active)

# backend/app/src/main/resources/application-prod.yaml (or env-driven)
messaging:
  email:
    provider: postmark
    postmark:
      server-token: ${POSTMARK_SERVER_TOKEN}
      from: noreply@drshoes.pl
      message-stream: outbound
      webhook-username: drshoes
      webhook-secret: ${POSTMARK_WEBHOOK_SECRET}
      api-base-url: https://api.postmarkapp.com   # test-overridable
      timeout-seconds: 10
  sms:
    provider: smsapi
    smsapi:
      token: ${SMSAPI_TOKEN}
      from: DrShoes
      callback-allowlist: 89.174.81.98,91.185.187.219,213.189.53.211,31.186.83.18,212.91.26.253
      client-ip-header: X-Forwarded-For   # behind Cloudflare set this to Cf-Connecting-Ip
      api-base-url: https://api.smsapi.pl
      timeout-seconds: 10
```

`@ConditionalOnProperty(name="messaging.email.provider", havingValue="postmark")` activates `PostmarkEmailGateway` AND `EmailGatewayAutoConfiguration` falls back to Logging only when `postmark` is NOT set (existing `@ConditionalOnMissingBean` already does this).

## 4. Components — interfaces and key signatures

### 4.1 `PostmarkEmailGateway` (microlib)

Uses Spring `RestClient` (Java 21 native, available in Spring Boot 3.4). Targets `https://api.postmarkapp.com/email`. Builds JSON: `From`, `To`, `Subject`, `HtmlBody` or `TextBody`, `MessageStream`, `Attachments[]`. Sets `X-Postmark-Server-Token` header. Maps 200 + `MessageID` → `DeliveryReceipt.accepted`. 4xx/5xx/inline-error/network → `DeliveryReceipt.failed(errorCode, errorMessage)`. Attachments fetched via the existing `BlobStorage.get(BlobKey)` (we own the bytes; Postmark wants base64 inline). Cap at **10 MB total** per Postmark limit; fail fast on `IllegalArgumentException` above that, gateway translates to `DeliveryReceipt.failed("ATTACHMENT_TOO_LARGE", ...)`. The gateway implements **a single retry on `ResourceAccessException` / network IO** (~1s pause between attempts); does NOT retry on 4xx (terminal) or 5xx (operator-initiated retry only).

### 4.2 `SmsApiSmsGateway` (microlib)

Same shape. SMSAPI accepts JSON or form. `Authorization: Bearer <token>` header. Body: `to`, `message`, `from`, `idempotency_key` (provider supports). Handles SMSAPI's two response shapes (success list of message IDs, error envelope) in `SmsApiResponseMapper`.

### 4.3 `WebhookStatusReconciler` (app)

```java
@Service
public class WebhookStatusReconciler {
    @Audited(parent = "#result.messageId")
    public ReconcileResult apply(WebhookEvent event) { ... }
}

public record ReconcileResult(
    @Nullable UUID messageId,           // null when NO_MESSAGE
    AppliedOutcome outcome,
    @Nullable DeliveryStatus appliedStatus
) {}

public enum AppliedOutcome { APPLIED, DEDUP, NO_MESSAGE, NO_TRANSITION, DROPPED }
```

Curator filters on `outcome=APPLIED` — the `@Audited` aspect writes an audit row regardless, but the curator's path-pattern matcher only emits `MESSAGE_DELIVERED` / `MESSAGE_FAILED` timeline events when the row's labels indicate `outcome=APPLIED` (curator reads `appliedOutcome` from the audit row's labels JSONB).

### 4.4 `MessageRetryService` (app)

```java
@Service
public class MessageRetryService {
    @Audited(parent = "#orderId")
    public MessageDto retry(UUID failedMessageId, AdminPrincipal actor) { ... }
}
```

Loads failed message, validates state, computes new idempotency key, delegates to `MessageRouter.sendManual` (or a thin internal entry point that bypasses re-validation since input is from a stored row). Returns the new message's DTO. The `@Audited` aspect produces an audit row tagged with `parent_entity_id=orderId`; the existing `MessageSentTimelineHandler` curator picks it up and emits the `MESSAGE_SENT` timeline event for the retry — no new timeline kind needed.

### 4.5 `MessagesController` extension

```
POST /api/admin/messages/{id}/retry  →  MessageDto (200) | 409 NOT_RETRYABLE | 403 RBAC
```

### 4.6 Frontend changes

- **`apps/web/lib/messaging/types.ts`** extends `MessageDto`:
  ```ts
  deliveryStatus: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "READ";
  retryOfMessageId: string | null;
  retryAttempt: number;
  errorCode: string | null;
  errorMessage: string | null;
  ```
- **`apps/web/lib/messaging/api.ts`** adds `retryMessage(id: string): Promise<MessageDto>`.
- **`apps/web/app/(admin)/admin/orders/_components/MessageStatusBadge.tsx`** (NEW, ~30 LOC): renders Polish label + Tailwind color class per `deliveryStatus`. Mapping:
  | Status | Polish | Color |
  |---|---|---|
  | QUEUED | Kolejka | gray |
  | SENT | Wysłane | blue |
  | DELIVERED | Doręczone | green |
  | FAILED | Niedoręczone | red |
  | READ | Przeczytane | emerald |
- **`apps/web/app/(admin)/admin/orders/_components/OrderDrawerMessages.tsx`** modifications:
  - Render `<MessageStatusBadge>` per outbound message.
  - On `FAILED`: render `errorMessage` inline below the message + `<button>Wyślij ponownie</button>`. Click → `retryMessage(id)` → on success, refresh thread.
  - 10s `setInterval` while drawer is open. Refreshes the thread silently. `clearInterval` on unmount / drawer close.
  - For retry chains, render a `↳` indicator on the new message linking back to its `retryOfMessageId`.

## 5. Error handling

### 5.1 Outbound

| Failure | Behavior | Recovery |
|---|---|---|
| Provider 4xx (bad recipient, malformed body) | FAILED + `error_code` + `error_message` from provider | Operator fixes + manual retry |
| Provider 5xx | FAILED + `error_code='PROVIDER_5XX'` | Manual retry |
| Network timeout / connection refused | Gateway retries once after ~1s; if still failing, FAILED + `error_code='NETWORK'` | Manual retry |
| Provider 200 + inline error (Postmark `ErrorCode!=0`) | FAILED + provider's `ErrorCode` + `Message` | Operator fixes + manual retry |
| Attachments > 10 MB total | Fail-fast in gateway → FAILED + `error_code='ATTACHMENT_TOO_LARGE'` (no provider call) | Operator removes attachments + manual retry |

### 5.2 Webhook

| Failure | Status | Behavior |
|---|---|---|
| Bad signature | 401 | Zero DB writes. INFO log: `op=webhook.verify outcome=denied`. |
| Malformed JSON | 400 | Zero DB writes. WARN log with truncated raw body. |
| Unknown event type | 200 | INSERT `webhook_event` with `applied_outcome='DROPPED'`. |
| `provider_message_id` not found | 200 | INSERT with `applied_outcome='NO_MESSAGE'`. (Provider may legitimately fire before our send transaction commits — provider retries.) |
| Duplicate `provider_event_id` | 200 | UNIQUE conflict → caught → `applied_outcome='DEDUP'`. |
| State-guard blocks UPDATE (already DELIVERED/FAILED) | 200 | `applied_outcome='NO_TRANSITION'`. |
| Reconciler throws (DB down etc.) | 500 | Provider retries. Eventual consistency. |

### 5.3 Retry endpoint

| Failure | Status |
|---|---|
| Message not FAILED | 409 `code='NOT_RETRYABLE'` |
| RBAC ownership fail | 403 |
| Send fails on retry | 200 + new MessageDto with `deliveryStatus='FAILED'` (the row was created; the send was the failure) |
| Retry of a retry | Allowed; chain continues; no hard cap (operator self-limits) |

### 5.4 Frontend

- Polling network blip → swallow + warn log + retry next tick. No toast spam.
- Retry button click failure → inline error below the FAILED message: `Nie udało się ponowić — spróbuj ponownie`. Button stays clickable.
- 10s polling closes status-stale gaps; no manual refresh needed.

## 6. Logging discipline (existing project pattern)

Every new file uses the named-logger pattern with `op=<verb>.<noun> outcome=<result>` and structured fields. New ops:

- `op=postmark.send` / `op=smsapi.send` — actor, recipient (last 4), idempotencyKey, providerMessageId, durationMs, outcome.
- `op=webhook.receive` — provider, providerEventId (where present), eventType, outcome (`verified|denied|malformed`).
- `op=webhook.reconcile` — messageId, providerMessageId, appliedOutcome, appliedStatus.
- `op=message.retry` — actor, originalMessageId, newMessageId, retryAttempt, outcome.

Frontend `MessageStatusBadge` and `OrderDrawerMessages` use `createLogger` from `@/lib/log`. Polling tick ops: `op=poll.thread outcome=ok|stale-error`.

## 7. Testing strategy

### 7.1 Unit

- `PostmarkPayloadMapperTest` / `PostmarkResponseMapperTest`
- `SmsApiPayloadMapperTest` / `SmsApiResponseMapperTest`
- `WebhookSignatureVerifierTest` (per provider impl)
- `WebhookEventMapperTest` (RecordType / status code → DeliveryStatus)
- `MessageRetryServiceTest` (idempotency key suffix, FAILED-only guard, ownership, chain link)

### 7.2 Integration (Testcontainers + WireMock)

- `PostmarkEmailGatewayIT` — WireMock as `https://api.postmarkapp.com`, asserts request shape, parses real-looking responses, exercises 200/4xx/5xx/timeout paths.
- `SmsApiSmsGatewayIT` — same.
- `PostmarkWebhookControllerIT` — full matrix: valid Delivery, valid Bounce, valid SpamComplaint, invalid signature → 401, duplicate event_id → DEDUP, unknown RecordType → DROPPED, unknown providerMessageId → NO_MESSAGE, state-guard NO_TRANSITION.
- `SmsApiWebhookControllerIT` — same matrix.
- `MessageRetryControllerIT` — round-trip: trigger fires + provider returns FAILED (WireMock), operator hits retry endpoint, gateway returns SENT, thread shows two rows linked by `retry_of_message_id`, both audit rows present, timeline has two `MESSAGE_SENT` events.
- **Race test:** webhook arrives before send commits → assert webhook returns 200 with `NO_MESSAGE` and provider retry policy is documented (not implemented — provider does the retry).

### 7.3 Frontend

- `pnpm typecheck` + `pnpm lint` + `pnpm build` per closure smoke (M2/M3 precedent). No Playwright.
- Manual UI smoke skipped at owner direction (consistent with M2/M3).

### 7.4 WireMock fixtures

- `backend/app/src/test/resources/fixtures/postmark/` — `delivery.json`, `bounce.json`, `spam-complaint.json`, `click.json`, `error-422.json`, `success.json`.
- `backend/app/src/test/resources/fixtures/smsapi/` — `delivered-callback.txt`, `undelivered-callback.txt`, `success.json`, `error.json`.
- Pinned from current provider docs at plan time.

### 7.5 Coverage

- 100% on `WebhookStatusReconciler` (state-guarded branches).
- 100% on `WebhookSignatureVerifier` impls (security-critical).
- ≥80% on each provider gateway (RestClient invocation + response mapping).
- ≥70% on `MessageRetryService`.

### 7.6 Suite delta

Closing 167 (M3). M4 adds ~25-30 tests. Closing target: **190-200**.

## 8. Out of scope (parked for later)

- **Inbound parsing** (email reply / SMS inbound → `direction=INBOUND` rows + thread surfacing + unread count) — the entirety of M5.
- **WhatsApp** — no microlib stub yet; not in seeded triggers; deferred indefinitely.
- **SMTP fallback** for email — DECISIONS.md mentions it; deferred until Postmark uptime becomes a real concern.
- **Twilio SMS** — DECISIONS.md mentions it as alternative; SMSAPI is primary; deferred.
- **READ status / open tracking** — schema column stays, populated never (until a future milestone).
- **DB outbox + worker** — deferred until volume forces it.
- **Automatic retry `@Scheduled` job** — operator-initiated retry only; no auto-retry.
- **`/admin/messages` cross-client top-nav inbox** — depends on inbound; deferred to M5.

## 9. Task wave sketch

| Wave | Tasks | Theme | Review |
|---|---|---|---|
| 1 — Schema + microlib scaffolding | 4-1 V010 migration + WebhookEventEntity, 4-2 messaging-core extensions (Provider enum, WebhookEvent fields, WebhookSignatureVerifier interface) | Foundation | combined |
| 2 — Real outbound providers | 4-3 PostmarkPayloadMapper + ResponseMapper + tests, 4-4 PostmarkEmailGateway + properties + autoconfig + WireMock IT, 4-5 SmsApiPayloadMapper + ResponseMapper + tests, 4-6 SmsApiSmsGateway + properties + autoconfig + WireMock IT | Provider impls | two-stage on 4-4, 4-6 (security-sensitive HTTP clients) |
| 3 — Webhook receivers | 4-7 PostmarkWebhookController + signature verifier + IT (full matrix), 4-8 SmsApiWebhookController + signature verifier + IT, 4-9 WebhookStatusReconciler + state-guard SQL + curator wiring (MESSAGE_DELIVERED/FAILED kinds) | Inbound webhooks | two-stage on 4-9 (curator wiring is cross-cutting) |
| 4 — Retry path | 4-10 MessageRetryService + @Audited, 4-11 POST /api/admin/messages/{id}/retry endpoint + IT | Operator retry | combined |
| 5 — Frontend | 4-12 lib/messaging types + retryMessage, 4-13 MessageStatusBadge component, 4-14 OrderDrawerMessages: badge + retry button + 10s polling, 4-15 KIND_LABELS_PL extension for MESSAGE_DELIVERED/FAILED | UI vertical | combined |
| 6 — Closure | 4-16 mvn verify + frontend typecheck/lint/build + milestone-4 tag + CLAUDE.md flip | Closure | combined |

≈ **16 tasks total.** Two two-stage reviews (4-4/4-6 provider HTTP clients, 4-9 reconciler + curator wiring); the rest single-stage combined per dispatch protocol §4.

## 10. Errata — items pinned at plan time (2026-05-09)

The following items were researched against current provider docs and folded into §3.6 / §3.6.1 / §3.6.2 / §3.6.3:

1. **Postmark webhook auth** — pinned to HTTP Basic Auth (URL-embedded credentials → `Authorization: Basic` header). Postmark does not ship HMAC signature support.
2. **SMSAPI callback auth** — pinned to source-IP allowlist (5 fixed IPs). No signature/checksum mechanism; SMSAPI does not provide one.
3. **Webhook HTTP method** — Postmark POSTs JSON to its endpoint; **SMSAPI uses GET with URL query params** and requires the response body to be the literal text `OK`. Spec amended in §3.6.1.
4. **Postmark record types** — Delivery / Bounce / SpamComplaint reconcile; Open / Click / SubscriptionChange drop. Pinned in §3.6.3.
5. **SMSAPI status mapping** — pinned to `status_name` text values (preferred) with numeric `status` fallback. Plan task will verify the current text values against SMSAPI docs at implementation time. See §3.6.2.
6. **Idempotency key on SMSAPI send** — to be confirmed by the gateway implementation against current SMSAPI send-API docs (use whatever the current API exposes; if absent, fall back to `idx` custom field, which SMSAPI echoes back on the callback).

Any further deviations discovered at implementation time get appended to a "Plan errata" section in the M4 plan file (matches M2/M3 precedent).

## 11. Closing definition (ship gates)

- All 16 tasks `completed` in `docs/dispatch-log/tasks.json` with commit SHAs.
- Backend `mvn verify` green, suite ≥190.
- Frontend `pnpm typecheck` + `pnpm lint` + `pnpm build` green.
- Local git tag `milestone-4` created with annotation listing what shipped, suite count, smoke approach (automated only per M2/M3 precedent), and any deferred-debt entries.
- `CLAUDE.md` status row flipped from `[ ] Milestone 4` to `[x] Milestone 4: Real providers + webhooks + retry`.
- A new session memory entry summarizing the milestone with a paste-ready resume prompt.
