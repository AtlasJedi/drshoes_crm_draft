# API Surface — Starting Point

REST + JSON. Refine in `ARCHITECTURE.md`. All admin routes under `/api/admin/**` require auth. Public routes under `/api/public/**` are open (rate-limited).

## Auth
- `POST /api/admin/auth/login` → JWT or session cookie (recommend HTTP-only cookie session for admin SPA; justify your choice)
- `POST /api/admin/auth/logout`
- `GET  /api/admin/auth/me`

## Public

### Shop
- `GET  /api/public/products?brand=&size=&minPrice=&maxPrice=&status=` → list
- `GET  /api/public/products/{id}` → detail
- `POST /api/public/products/{id}/reservations` → create reservation (rate-limited, captcha)

### News
- `GET  /api/public/news?page=&size=` → published posts
- `GET  /api/public/news/{slug}` → single post

### Contact
- `POST /api/public/contact` → contact inquiry (multipart for optional photo)

## Admin

### Orders
- `GET  /api/admin/orders?status=&type=&craftsmanId=&from=&to=&clientId=&tag=&q=&preset=` → list
- `POST /api/admin/orders` → create
- `GET  /api/admin/orders/{id}` → detail (with items, photos, notes, messages)
- `PATCH /api/admin/orders/{id}` → update (status, dates, assignee, tags)
- `DELETE /api/admin/orders/{id}` → soft delete / cancel
- `POST /api/admin/orders/{id}/items` → add item
- `PATCH /api/admin/orders/{id}/items/{itemId}`
- `DELETE /api/admin/orders/{id}/items/{itemId}`
- `POST /api/admin/orders/{id}/photos` → multipart upload (returns presigned url alternative also OK)
- `PATCH /api/admin/orders/{id}/photos/{photoId}` → label, position
- `DELETE /api/admin/orders/{id}/photos/{photoId}`
- `POST /api/admin/orders/{id}/notes` → add internal note
- `POST /api/admin/orders/{id}/messages` → send message (uses messaging service)
- `POST /api/admin/orders/{id}/status` → change status (returns trigger suggestion if applicable)

### Calendar
- `GET  /api/admin/orders/calendar?from=&to=` → orders bucketed by planned_pickup_at + unscheduled list
- `PATCH /api/admin/orders/{id}/schedule` → reschedule (drag)

### Kanban
- `GET  /api/admin/orders/kanban` → grouped by status

### Clients
- `GET  /api/admin/clients?q=` → list / search
- `POST /api/admin/clients` → create
- `GET  /api/admin/clients/{id}` → detail (orders, total value, notes)
- `PATCH /api/admin/clients/{id}`

### Products (Sklep admin)
- `GET    /api/admin/products`
- `POST   /api/admin/products`
- `GET    /api/admin/products/{id}` (incl. reservations)
- `PATCH  /api/admin/products/{id}`
- `DELETE /api/admin/products/{id}`
- `POST   /api/admin/products/{id}/photos`
- `DELETE /api/admin/products/{id}/photos/{photoId}`
- `GET    /api/admin/products/{id}/reservations`
- `PATCH  /api/admin/products/{id}/reservations/{rid}` → confirm/expire/fulfill

### News (admin)
- `GET    /api/admin/news`
- `POST   /api/admin/news`
- `GET    /api/admin/news/{id}`
- `PATCH  /api/admin/news/{id}`
- `DELETE /api/admin/news/{id}`
- `POST   /api/admin/news/{id}/publish`

### Messaging
- `GET  /api/admin/threads?filter=unread|needs_reply|all&channel=` → conversation list
- `GET  /api/admin/threads/{id}` → messages in thread
- `POST /api/admin/threads/{id}/messages` → send (channel, template, attachments, orderId)
- `POST /api/admin/messages/{id}/preview` → render placeholders, return preview
- inbound webhooks: `POST /api/webhooks/email`, `POST /api/webhooks/sms` (Twilio), `POST /api/webhooks/whatsapp`

### Templates
- CRUD under `/api/admin/message-templates`

### Triggers
- `GET    /api/admin/triggers`
- `POST   /api/admin/triggers`
- `PATCH  /api/admin/triggers/{id}` (incl. enable/disable)
- `DELETE /api/admin/triggers/{id}`
- `GET    /api/admin/triggers/{id}/stats`
- `GET    /api/admin/triggers/queue` → manual-confirmation inbox
- `POST   /api/admin/triggers/queue/{messageId}/send`
- `POST   /api/admin/triggers/queue/{messageId}/discard`

### Saved filters
- CRUD under `/api/admin/saved-filters`

### Dashboard
- `GET /api/admin/dashboard/summary` → tile counts
- `GET /api/admin/dashboard/orders-per-week?weeks=12`
- `GET /api/admin/dashboard/type-mix?from=&to=`

## Conventions
- Pagination: `?page=0&size=25`. Responses: `{ content, page, size, total }`.
- Errors: `{ error: { code, message, details? } }` with appropriate HTTP status. Validation errors return 422 with field list.
- File uploads: multipart for simple cases; presigned S3 URLs for large uploads (recommend in `ARCHITECTURE.md`).
- Idempotency keys for `POST /reservations` and `POST /messages`.
- All datetimes ISO-8601 with timezone.
