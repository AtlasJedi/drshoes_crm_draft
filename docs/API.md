# Dr Shoes — Proto REST API

**Status:** review draft. After sign-off, this contract drives `springdoc-openapi` annotations on backend controllers, which generate `openapi.yaml` consumed by `packages/api-types` codegen.

## Conventions

- Base: `/api`. Public: `/api/public/*` (open, rate-limited). Admin: `/api/admin/*` (auth required, RBAC enforced).
- Auth: HTTP-only session cookie `dr_session`. Non-GET requests require `X-XSRF-TOKEN` header (value mirrors `XSRF-TOKEN` cookie).
- Content type: `application/json; charset=utf-8` unless noted (multipart for file uploads).
- Datetimes: ISO-8601 with timezone, e.g. `"2026-05-15T09:30:00+02:00"`.
- Money: integer cents — `{ "amountCents": 4250, "currency": "PLN" }`.
- Pagination: `?page=0&size=25&sort=createdAt,desc`. Response envelope:
  ```json
  { "content": [...], "page": 0, "size": 25, "totalPages": 3, "totalElements": 67 }
  ```
- Error envelope:
  ```json
  { "error": { "code": "VALIDATION_FAILED", "message": "...", "details": [{ "field": "phone", "message": "must be E.164" }], "requestId": "..." } }
  ```
- HTTP statuses: `200/201/204` on success; `400` malformed; `401` unauth; `403` RBAC; `404` not found; `409` conflict; `422` validation; `429` rate-limited; `500` server.
- Idempotency: `Idempotency-Key: <uuid>` accepted on `POST /reservations`, `POST /service-requests`, `POST /messages`, `POST /scheduled-messages/{id}/send`.

---

## Auth

### `POST /api/admin/auth/login`

Request:
```json
{ "email": "misza@drshoes.pl", "password": "•••••••••" }
```
Response `204`:
```
Set-Cookie: dr_session=...; HttpOnly; Secure; SameSite=Lax; Path=/
Set-Cookie: XSRF-TOKEN=...; Secure; SameSite=Lax; Path=/
```
Failures: `401 INVALID_CREDENTIALS`, `429 LOGIN_THROTTLED`.

### `GET /api/admin/auth/me`

Response `200`:
```json
{
  "id": "8c12...", "email": "misza@drshoes.pl",
  "fullName": "Misza Doctor", "role": "OWNER",
  "lastLoginAt": "2026-05-07T18:42:11+02:00"
}
```

### `POST /api/admin/auth/logout` → `204`

---

## Public — Sklep

### `GET /api/public/products`

Query: `brand`, `size`, `minPriceCents`, `maxPriceCents`, `status` (`DOSTEPNE`/`ZAREZERWOWANE`/`SPRZEDANE`), `page`, `size`, `sort`.

Response `200`:
```json
{
  "content": [
    {
      "id": "01J...",
      "name": "Nike Air Max 90",
      "brand": "Nike",
      "size": "42",
      "price": { "amountCents": 89900, "currency": "PLN" },
      "status": "DOSTEPNE",
      "thumbnailUrl": "https://drshoes.pl/r2/products/01J.../cover.webp"
    }
  ],
  "page": 0, "size": 25, "totalPages": 1, "totalElements": 6
}
```

### `GET /api/public/products/{id}` → product detail with `photos[]`, `description`.

### `POST /api/public/products/{id}/reservations`

Headers: `Idempotency-Key: <uuid>`, optional `Cf-Turnstile-Token`.

Request:
```json
{
  "name": "Anna Kowalska",
  "phone": "+48512345678",
  "email": "anna@example.com",
  "preferredPickupDate": "2026-05-12",
  "message": "Mogę odebrać po 17:00",
  "rodoConsent": true,
  "honeypot": ""
}
```

Response `201`:
```json
{
  "id": "01J...",
  "productId": "01J...",
  "status": "PENDING",
  "expiresAt": "2026-05-09T18:42:11+02:00",
  "message": "Dziękujemy. Zarezerwowaliśmy buty na 48h. Skontaktujemy się aby potwierdzić."
}
```
Side effects: product flips `DOSTEPNE → ZAREZERWOWANE` atomically; if already reserved → `409 PRODUCT_NOT_AVAILABLE`.

---

## Public — Service intake

### `POST /api/public/service-requests`

Creates a `WSTĘPNIE_PRZYJĘTE` order, optionally creating/matching a client. Photos are pre-uploaded via the public presign endpoint and referenced by `s3_key`.

Request:
```json
{
  "kind": "CUSTOM_BUTY",
  "description": "Tomy Hilfiger białe — chcę logo Misia w kolorze magenta na pięcie.",
  "preferredPickupDate": "2026-06-01",
  "client": {
    "firstName": "Jakub",
    "lastName": "Nowak",
    "phone": "+48600111222",
    "email": "jakub@example.com",
    "preferredChannel": "SMS"
  },
  "photoKeys": ["public/intake/2026/05/abcd.jpg", "public/intake/2026/05/efgh.jpg"],
  "rodoConsent": true,
  "honeypot": ""
}
```

Response `201`:
```json
{
  "orderCode": "DR-2026-0117",
  "orderId": "01J...",
  "status": "WSTEPNIE_PRZYJETE",
  "message": "Dziękujemy. Skontaktujemy się aby potwierdzić zlecenie."
}
```

### `POST /api/public/photos/presign`

Request:
```json
{ "scope": "INTAKE", "count": 3, "mimeTypes": ["image/jpeg","image/jpeg","image/png"] }
```

Response `200`:
```json
{
  "uploads": [
    { "key": "public/intake/2026/05/abcd.jpg",
      "presignedUrl": "https://r2.../?...sig...",
      "expiresAt": "2026-05-07T18:52:00+02:00",
      "maxBytes": 10485760 }
  ]
}
```
Per-IP rate limit: 10 batches/hour. URLs expire 10min.

---

## Public — News + Contact

### `GET /api/public/news?page=0&size=12` → list of `PUBLISHED` posts.
### `GET /api/public/news/{slug}` → full post with `bodyHtml` + `photos[]`.

### `POST /api/public/contact` (multipart or JSON)

Request:
```json
{
  "name": "Anna Kowalska",
  "email": "anna@example.com",
  "phone": "+48512345678",
  "message": "Pytanie o custom...",
  "photoKey": "public/contact/2026/05/zzz.jpg",
  "rodoConsent": true
}
```
Response `201`: `{ "id": "01J...", "message": "Dziękujemy, odpowiemy w ciągu 24h." }`.

---

## Admin — Orders

### `GET /api/admin/orders`

Filters (all optional, AND'd):
- `status` (multi: `?status=PRZYJETE&status=W_REALIZACJI`)
- `kind`
- `craftsmanId`
- `storageId`
- `from`, `to` — applied to `planned_pickup_at` by default; override with `dateField=received_at|created_at|planned_pickup_at`
- `clientId`
- `tag`
- `q` — fuzzy on `code`, `description`, client name/phone/email
- `preset` — `pilne_w_tygodniu | gotowe_do_odbioru | zalegle`

Response `200`:
```json
{
  "content": [
    {
      "id": "01J...",
      "code": "DR-2026-0117",
      "client": { "id": "01J...", "fullName": "Jakub Nowak", "phone": "+48600111222" },
      "status": "W_REALIZACJI",
      "kindSummary": "1× CUSTOM_BUTY",
      "shortDescription": "Tomy Hilfiger białe — logo Misia...",
      "receivedAt": "2026-05-03T11:14:00+02:00",
      "plannedPickupAt": "2026-06-01T17:00:00+02:00",
      "assignedCraftsman": { "id": "01J...", "fullName": "Misza Doctor" },
      "currentStorageLocation": { "id": "01J...", "code": "REGAL_A", "name": "Regał A — naprawy" },
      "thumbnailUrl": "https://drshoes.pl/r2/orders/01J/thumb.webp",
      "tags": ["pilne","klient_powracający"],
      "totalPrice": { "amountCents": 35000, "currency": "PLN" }
    }
  ],
  "page": 0, "size": 25, "totalPages": 1, "totalElements": 12
}
```

### `POST /api/admin/orders`

Request:
```json
{
  "clientId": "01J...",
  "status": "PRZYJETE",
  "receivedAt": "2026-05-07T16:00:00+02:00",
  "plannedPickupAt": "2026-05-14T17:00:00+02:00",
  "assignedCraftsmanId": "01J...",
  "currentStorageLocationId": "01J...",
  "description": "Naprawa zelówek + custom dla córki",
  "tags": ["pilne"],
  "items": [
    { "kind": "NAPRAWA", "description": "Wymiana zelówek", "priceCents": 12000, "workMinutes": 90 },
    { "kind": "CUSTOM_BUTY", "description": "Disney Princess motyw", "priceCents": 25000, "workMinutes": 240 }
  ]
}
```
Response `201`: full order detail (same shape as `GET /orders/{id}`). Server generates `code` via `next_order_code()`.

### `GET /api/admin/orders/{id}`

Response `200` (abridged):
```json
{
  "id": "01J...",
  "code": "DR-2026-0117",
  "status": "W_REALIZACJI",
  "source": "PUBLIC_INTAKE",
  "client": { "id": "01J...", "firstName": "Jakub", "lastName": "Nowak",
              "phone": "+48600111222", "email": "jakub@example.com",
              "preferredChannel": "SMS" },
  "receivedAt": "...", "plannedPickupAt": "...", "pickedUpAt": null,
  "assignedCraftsman": { "id": "01J...", "fullName": "Misza Doctor" },
  "currentStorageLocation": { "id": "01J...", "code": "REGAL_A", "name": "Regał A" },
  "tags": ["pilne"],
  "totalPrice": { "amountCents": 35000, "currency": "PLN" },
  "description": "...",
  "items": [
    { "id": "01J...", "kind": "CUSTOM_BUTY", "description": "...",
      "craftsmanNotes": "...", "priceCents": 25000, "workMinutes": 240,
      "photos": [{ "id": "01J...", "label": "BEFORE", "url": "...", "position": 0 }] }
  ],
  "photos": [ /* all order-level photos, including item photos */ ],
  "internalNotes": [
    { "id": "01J...", "author": { "id": "01J...", "fullName": "Misza" },
      "body": "Klient wybrał kolor magenta", "createdAt": "..." }
  ],
  "events": "GET /api/admin/orders/{id}/events for paginated timeline",
  "messages": [
    { "id": "01J...", "direction": "OUTBOUND", "channel": "SMS",
      "body": "Cześć Jakub, zlecenie DR-2026-0117 przyjęte. Odbiór 1.06.",
      "deliveryStatus": "DELIVERED", "sentAt": "...", "deliveredAt": "..." }
  ],
  "permissions": { "canEdit": true, "canDelete": true, "canChangeStatus": true }
}
```

### `PATCH /api/admin/orders/{id}`

Partial update. Any subset of: `clientId`, `plannedPickupAt`, `assignedCraftsmanId`, `currentStorageLocationId`, `description`, `tags`, `totalPriceCents`. Fields like `status` and `pickedUpAt` go through dedicated endpoints below for proper auditing.

Response `200`: updated order. Side effect: writes `OrderEvent` per changed field.

### `POST /api/admin/orders/{id}/status`

The most important endpoint. Free transitions, audited, returns trigger preview.

Request:
```json
{ "toStatus": "GOTOWE_DO_ODBIORU", "note": "Czeka na klienta na regale A" }
```

Response `200`:
```json
{
  "order": { /* updated full order */ },
  "event": { "id": "01J...", "type": "STATUS_CHANGED",
             "payload": { "from": "W_REALIZACJI", "to": "GOTOWE_DO_ODBIORU" },
             "createdAt": "..." },
  "matchedTrigger": {
    "id": "01J...",
    "name": "Gotowe do odbioru",
    "channels": ["SMS"],
    "requiresManualConfirmation": false,
    "scheduledMessageId": "01J...",
    "preview": {
      "channel": "SMS",
      "recipient": "+48600111222",
      "subject": null,
      "body": "Cześć Jakub! Twoje zlecenie DR-2026-0117 jest gotowe do odbioru w pracowni Dr Shoes. Adres: ...",
      "scheduledFor": "2026-05-07T18:42:30+02:00"
    }
  }
}
```

If no trigger matched: `matchedTrigger: null`. UI shows the confirmation modal **whenever** `matchedTrigger` is present, even with `requiresManualConfirmation=false` — admin can [Wyślij teraz] / [Wyślij później] / [Tylko zmień status].

If `toStatus="ANULOWANE"`, request must include `note` (validation `422 NOTE_REQUIRED_FOR_CANCEL`).
If `order.status="WYDANE"` and `toStatus≠"WYDANE"`, must POST `/restore` instead → `409 USE_RESTORE_ENDPOINT`.

### `POST /api/admin/orders/{id}/restore` (OWNER only)

Request: `{ "toStatus": "PRZYJETE", "reason": "Klient wrócił z reklamacją" }`
Response `200`: full order + event `RESTORED`.

### `POST /api/admin/orders/{id}/storage`

Request: `{ "storageLocationId": "01J...", "note": "Przeniesione na regał B" }`
Response `200`: order + event `STORAGE_MOVED { from, to }`. Pass `null` to unset.

### `POST /api/admin/orders/{id}/schedule`

Request: `{ "plannedPickupAt": "2026-06-03T17:00:00+02:00" }`
Response `200`: order + event `SCHEDULE_CHANGED`.

### `POST /api/admin/orders/{id}/assign`

Request: `{ "craftsmanId": "01J..." }` (or `null` to unassign)
Response `200`: order + event `ASSIGNEE_CHANGED`.

### `POST /api/admin/orders/{id}/items`

Request:
```json
{ "kind": "NAPRAWA", "description": "Wymiana sznurówek", "priceCents": 1500, "workMinutes": 10 }
```
Response `201`: `OrderItem` + event `ITEM_ADDED`. Recomputes order total.

### `PATCH /api/admin/orders/{id}/items/{itemId}` → partial update + event `ITEM_UPDATED`.
### `DELETE /api/admin/orders/{id}/items/{itemId}` → soft archive + event `ITEM_REMOVED`.

### `POST /api/admin/orders/{id}/photos/finalize`

Called after FE PUT-uploaded blobs to presigned URLs.

Request:
```json
{
  "photos": [
    { "key": "orders/2026/05/01J.../before-1.jpg",
      "label": "BEFORE", "mime": "image/jpeg", "width": 3024, "height": 4032,
      "orderItemId": "01J..." }
  ]
}
```
Response `201`: array of `Photo`. Backend HEADs each key against R2; missing keys → `422`.

### `POST /api/admin/photos/presign` (admin variant)

Request: `{ "scope": "ORDER", "orderId": "01J...", "count": 5, "mimeTypes": [...] }`
Response: same shape as public.

### `PATCH /api/admin/orders/{id}/photos/{photoId}` → label + position. Event `PHOTO_LABELED`.
### `DELETE /api/admin/orders/{id}/photos/{photoId}` → delete + R2 deletion + event `PHOTO_REMOVED`.

### `POST /api/admin/orders/{id}/notes`

Request: `{ "body": "Klient prosi o wymianę szczotki na delikatniejszą" }`
Response `201`: `InternalNote` + event `NOTE_ADDED`.

### `GET /api/admin/orders/{id}/events?page=0&size=50`

The order timeline. Response `200`:
```json
{
  "content": [
    { "id": "01J...", "type": "STATUS_CHANGED",
      "actor": { "id": "01J...", "fullName": "Misza" },
      "payload": { "from": "PRZYJETE", "to": "W_REALIZACJI" },
      "message": null,
      "createdAt": "2026-05-05T09:14:11+02:00" },
    { "id": "01J...", "type": "PHOTO_ADDED",
      "actor": { "id": "01J...", "fullName": "Misza" },
      "payload": { "photoId": "01J...", "label": "BEFORE", "key": "orders/.../before-1.jpg" },
      "createdAt": "..." },
    { "id": "01J...", "type": "STORAGE_MOVED",
      "actor": { "id": "01J...", "fullName": "Misza" },
      "payload": { "fromId": null, "toId": "01J...", "toCode": "REGAL_A" },
      "message": "Przyjęte i odłożone",
      "createdAt": "..." }
  ],
  "page": 0, "size": 50, "totalPages": 1, "totalElements": 9
}
```

### `POST /api/admin/orders/{id}/messages`

Sends an outbound message linked to this order. Bypasses the trigger system (manual send).

Request:
```json
{
  "channel": "EMAIL",
  "templateId": "01J...",         // optional; if set, body is rendered server-side
  "subject": "DR-2026-0117 — gotowe",
  "body": "Cześć Jakub, ...",
  "attachments": ["orders/.../after-1.jpg", "orders/.../after-2.jpg"]
}
```
Response `201`: `Message` + event `MESSAGE_SENT`.

### `GET /api/admin/orders/calendar?from=2026-05-01&to=2026-05-31`

Response:
```json
{
  "scheduled": [
    { "id": "01J...", "code": "DR-2026-0117", "plannedPickupAt": "...",
      "status": "W_REALIZACJI", "clientFullName": "Jakub Nowak" }
  ],
  "unscheduled": [ /* same shape, plannedPickupAt=null */ ]
}
```

### `GET /api/admin/orders/kanban`

Response:
```json
{
  "columns": [
    { "status": "WSTEPNIE_PRZYJETE", "items": [...], "totalCount": 3 },
    { "status": "PRZYJETE",           "items": [...], "totalCount": 5 },
    { "status": "W_REALIZACJI",       "items": [...], "totalCount": 7 },
    { "status": "CZEKA_NA_KLIENTA",   "items": [...], "totalCount": 2 },
    { "status": "GOTOWE_DO_ODBIORU",  "items": [...], "totalCount": 4 },
    { "status": "WYDANE",             "items": [...], "totalCount": 12 }
  ]
}
```
Items abbreviated (id, code, clientFullName, kindSummary, plannedPickupAt, thumbnailUrl, urgencyTag).

---

## Admin — Storage Locations

```
GET    /api/admin/storage-locations
POST   /api/admin/storage-locations         OWNER
PATCH  /api/admin/storage-locations/{id}    OWNER
DELETE /api/admin/storage-locations/{id}    OWNER  (409 if any orders reference)
```

Body shape:
```json
{ "code": "REGAL_A", "name": "Regał A — naprawy", "description": "...", "color": "#e6ff3a", "active": true }
```

---

## Admin — Clients

```
GET    /api/admin/clients?q=&page=&size=
POST   /api/admin/clients
GET    /api/admin/clients/{id}     -> includes orders[], totalSpent, messageCount
PATCH  /api/admin/clients/{id}
DELETE /api/admin/clients/{id}     OWNER (soft delete)
```

---

## Admin — Products / Sklep

```
GET    /api/admin/products
POST   /api/admin/products
GET    /api/admin/products/{id}    -> includes reservations[]
PATCH  /api/admin/products/{id}
DELETE /api/admin/products/{id}    OWNER (soft)

POST   /api/admin/products/{id}/photos/finalize
DELETE /api/admin/products/{id}/photos/{photoId}

GET    /api/admin/products/{id}/reservations
PATCH  /api/admin/products/{id}/reservations/{rid}
        body: { "status": "CONFIRMED" | "EXPIRED" | "CANCELLED" | "FULFILLED" }
```

---

## Admin — News

```
GET    /api/admin/news?status=DRAFT|PUBLISHED&page=&size=
POST   /api/admin/news
GET    /api/admin/news/{id}
PATCH  /api/admin/news/{id}
DELETE /api/admin/news/{id}    OWNER
POST   /api/admin/news/{id}/publish     -> sets status=PUBLISHED, publishedAt=now
POST   /api/admin/news/{id}/unpublish
```

---

## Admin — Messaging (unified inbox)

### `GET /api/admin/threads?filter=unread|needs_reply|all&channel=EMAIL|SMS&page=&size=`

Response:
```json
{
  "content": [
    { "id": "01J...", "client": { ... },
      "subject": "Pytanie o custom",
      "lastMessage": { "direction": "INBOUND", "channel": "EMAIL",
                       "preview": "Cześć, czy mogę dorzucić...",
                       "createdAt": "..." },
      "unreadCount": 1, "updatedAt": "..." }
  ],
  "page": 0, "size": 25, "totalPages": 4, "totalElements": 88
}
```

### `GET /api/admin/threads/{id}` → thread + messages.

### `POST /api/admin/threads/{id}/messages` → send. Body identical to `orders/{id}/messages` minus order link (or include `orderId`).

### `POST /api/admin/threads/{id}/mark-read` → `204`.

### `POST /api/admin/messages/preview`

Render a template against context without sending.

Request:
```json
{ "templateId": "01J...", "context": { "orderId": "01J...", "extraVars": {} } }
```
Response:
```json
{ "channel": "SMS", "subject": null, "recipient": "+48600111222",
  "body": "Cześć Jakub! Twoje zlecenie DR-2026-0117 ..." }
```

---

## Admin — Templates

```
GET    /api/admin/message-templates
POST   /api/admin/message-templates       OWNER
GET    /api/admin/message-templates/{id}
PATCH  /api/admin/message-templates/{id}  OWNER
DELETE /api/admin/message-templates/{id}  OWNER
```

Template body:
```json
{
  "name": "Zlecenie przyjęte — SMS",
  "channel": "SMS",
  "subject": null,
  "body": "Cześć {imie_klienta}! Przyjęliśmy zlecenie {numer_zlecenia} ({typ_pracy}). Planowany odbiór: {data_odbioru}. — Dr Shoes",
  "active": true
}
```

---

## Admin — Triggers

```
GET    /api/admin/triggers
POST   /api/admin/triggers                OWNER
GET    /api/admin/triggers/{id}
PATCH  /api/admin/triggers/{id}           OWNER  (incl. enabled toggle)
DELETE /api/admin/triggers/{id}           OWNER
GET    /api/admin/triggers/{id}/stats     -> counts: scheduled, sent, failed, replied (last 90d)
```

Trigger body:
```json
{
  "name": "Przypomnienie o odbiorze (1 dzień przed)",
  "enabled": true,
  "event": "BEFORE_PICKUP_X_DAYS",
  "eventParams": { "days": 1, "hour": 9 },
  "channels": ["SMS"],
  "templateId": "01J...",
  "delayMinutes": 0,
  "requiresManualConfirmation": false
}
```

---

## Admin — Scheduled Messages (manual-confirm queue + upcoming)

```
GET    /api/admin/scheduled-messages?state=AWAITING_CONFIRM|PENDING|FAILED&from=&to=
POST   /api/admin/scheduled-messages/{id}/send             -> dispatch now
POST   /api/admin/scheduled-messages/{id}/discard
POST   /api/admin/scheduled-messages/{id}/edit-and-send
        body: { "channel"?, "subject"?, "body"? }
```

`GET` response:
```json
{
  "content": [
    {
      "id": "01J...",
      "trigger": { "id": "01J...", "name": "Gotowe do odbioru" },
      "order": { "id": "01J...", "code": "DR-2026-0117" },
      "client": { "fullName": "Jakub Nowak", "phone": "+48600111222" },
      "channel": "SMS",
      "renderedSubject": null,
      "renderedBody": "Cześć Jakub! ...",
      "scheduledFor": "2026-05-08T09:00:00+02:00",
      "state": "AWAITING_CONFIRM",
      "requiresManualConfirmation": true,
      "attempts": 0
    }
  ]
}
```

---

## Admin — Saved Filters, Users, Dashboard

```
# Saved filters
GET/POST/PATCH/DELETE /api/admin/saved-filters

# Users (OWNER only)
GET/POST/PATCH /api/admin/users
POST /api/admin/users/{id}/reset-password
POST /api/admin/users/{id}/deactivate

# Dashboard
GET /api/admin/dashboard/summary
GET /api/admin/dashboard/orders-per-week?weeks=12
GET /api/admin/dashboard/type-mix?from=&to=
```

`GET /api/admin/dashboard/summary` response:
```json
{
  "ordersInProgress": 14,
  "readyForPickup": 5,
  "overdue": 2,
  "monthlyRevenue": { "amountCents": 285000, "currency": "PLN" },
  "newReservations": 3,
  "unreadMessages": 8,
  "awaitingConfirmation": 4,
  "intakePending": 2
}
```

---

## Webhooks (inbound)

```
POST /api/webhooks/email/postmark      header: X-Postmark-Signature
POST /api/webhooks/sms/smsapi-pl       header: X-SMSAPI-Signature
POST /api/webhooks/sms/twilio          header: X-Twilio-Signature
```

All return `200` on accept (even on parse failure — log + alert; never 5xx to provider). Idempotent on `provider_message_id`.

---

## Rate limiting (Bucket4j)

| Endpoint group              | Limit                          |
|-----------------------------|--------------------------------|
| `POST /api/public/*`        | 30 req / 15min / IP            |
| `POST /api/admin/auth/login`| 5 req / 15min / IP             |
| `POST /api/admin/*`         | 600 req / min / session        |
| webhooks                    | 6000 req / min / IP            |

429 response includes `Retry-After` seconds.

---

## RBAC matrix (enforced at controller + service)

| Action                                     | OWNER | EMPLOYEE |
|--------------------------------------------|:-----:|:--------:|
| GET any admin route                        |  ✅   |    ✅    |
| Create/edit clients, orders, items, photos, notes, messages | ✅ | ✅ |
| Change order status / storage / schedule / assignee | ✅ | ✅ |
| Send manual messages, send/discard scheduled |  ✅  |    ✅    |
| DELETE clients / orders / products / news  |  ✅   |    ❌    |
| CRUD storage_locations                     |  ✅   |    ❌    |
| CRUD message_templates / triggers          |  ✅   |    ❌    |
| User management                            |  ✅   |    ❌    |
| Restore order from `WYDANE`                |  ✅   |    ❌    |

`403 INSUFFICIENT_ROLE` on EMPLOYEE attempting OWNER actions.

---

## What's not in v1

- Customer self-service portal — out of scope.
- WhatsApp Business API — interface exists, no impl.
- Payment endpoints — every "wystaw paragon" / payment surface stubbed as `501 NOT_IMPLEMENTED` with `{ "error": { "code": "TBD_PAYMENTS" } }`.
- Public unauthenticated read of orders by tracking link — out of scope.
