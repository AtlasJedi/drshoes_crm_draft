# Data Model — Starting Point

Refine in `ARCHITECTURE.md` after follow-ups. Use UUID primary keys. All timestamps `TIMESTAMPTZ`. Soft-delete (`deleted_at`) where it matters (Order, Product, Client).

## Core entities

### Client
- `id`, `created_at`, `updated_at`
- `first_name`, `last_name`, `phone`, `email`
- `preferred_channel` enum(EMAIL, SMS, WHATSAPP)
- `notes` text
- one-to-many → Order, Reservation, MessageThread

### Order
- `id`, `code` (human-readable "DR-2025-0042"), `created_at`, `updated_at`
- `client_id` → Client
- `status` enum(PRZYJETE, W_REALIZACJI, CZEKA_NA_KLIENTA, GOTOWE_DO_ODBIORU, WYDANE, ANULOWANE)
- `received_at`, `planned_pickup_at`, `picked_up_at`
- `assigned_craftsman_id` → User (nullable)
- `tags` jsonb array
- `total_price_cents`, `currency`
- one-to-many → OrderItem, Photo, InternalNote, Message

### OrderItem
- `id`, `order_id`
- `kind` enum(NAPRAWA, CUSTOM_BUTY, CUSTOM_KURTKA)
- `description` text
- `craftsman_notes` text
- `price_cents`, `work_minutes`
- one-to-many → Photo (filtered by item)

### Photo
- `id`, `order_id`, `order_item_id` (nullable), `uploaded_by`, `uploaded_at`
- `s3_key`, `mime`, `width`, `height`
- `label` enum(BEFORE, IN_PROGRESS, AFTER, OTHER)
- `position` int (for reorder)

### InternalNote
- `id`, `order_id`, `author_id`, `created_at`, `body` text

### MessageThread
- `id`, `client_id`, `last_message_at`, `unread_count`
- one-to-many → Message

### Message
- `id`, `thread_id`, `order_id` (nullable, link to a specific order)
- `direction` enum(OUTBOUND, INBOUND)
- `channel` enum(EMAIL, SMS, WHATSAPP)
- `template_id` (nullable) → MessageTemplate
- `trigger_id` (nullable) → Trigger
- `subject` (email only), `body`, `attachments` jsonb (s3_keys)
- `delivery_status` enum(QUEUED, SENT, DELIVERED, FAILED, READ)
- `provider_message_id`, `sent_at`, `delivered_at`, `read_at`

### MessageTemplate
- `id`, `name`, `channel`, `subject`, `body_with_placeholders`, `created_at`, `updated_at`
- placeholders documented: `{imie_klienta}`, `{numer_zlecenia}`, `{typ_pracy}`, `{data_odbioru}`, `{link_do_zdjec}`

### Trigger
- `id`, `name`, `enabled` boolean
- `event` enum(STATUS_CHANGE, ORDER_RECEIVED, BEFORE_PICKUP_X_DAYS, AFTER_HANDOVER_Y_DAYS, ...)
- `event_params` jsonb (e.g. `{ "to_status": "GOTOWE_DO_ODBIORU" }`, `{ "days": 1 }`)
- `channels` jsonb array of EMAIL/SMS
- `template_id` → MessageTemplate
- `delay_hours` int
- `requires_manual_confirmation` boolean
- stats columns or aggregated via Message: `sent_count`, `opened_count`, `replied_count`

### Product (Sklep)
- `id`, `created_at`, `updated_at`
- `name`, `brand`, `size`, `price_cents`, `description`
- `status` enum(DOSTEPNE, ZAREZERWOWANE, SPRZEDANE)
- one-to-many → ProductPhoto, Reservation

### ProductPhoto
- `id`, `product_id`, `s3_key`, `position`

### Reservation
- `id`, `product_id`, `client_id` (nullable — anonymous reservations allowed)
- `name`, `phone`, `email`, `preferred_pickup_date`, `message`
- `status` enum(PENDING, CONFIRMED, EXPIRED, CANCELLED, FULFILLED)
- `created_at`, `expires_at` (default created_at + 48h)

### NewsPost
- `id`, `slug`, `title`, `excerpt`, `body_html` (or markdown), `cover_s3_key`
- `status` enum(DRAFT, PUBLISHED), `published_at`
- one-to-many → NewsPhoto

### ContactInquiry
- `id`, `name`, `email`, `message`, `photo_s3_key` (nullable), `created_at`, `handled` boolean

### User (admin)
- `id`, `email`, `password_hash`, `full_name`, `role` enum(ADMIN, CRAFTSMAN, OFFICE)
- `created_at`, `last_login_at`

### SavedFilter
- `id`, `user_id`, `scope` ("orders"), `name`, `query` jsonb

## Indexes (suggested)
- `order(status, planned_pickup_at)`
- `order(client_id, created_at desc)`
- `message(thread_id, created_at)`
- `reservation(product_id, status)`
- `product(status)`
- full-text on `client(first_name, last_name, phone, email)` and `order(code, description)`

## Relationships diagram (text)
```
Client 1 ── n Order 1 ── n OrderItem
                     1 ── n Photo
                     1 ── n InternalNote
                     1 ── n Message
Client 1 ── n MessageThread 1 ── n Message
Client 1 ── n Reservation n ── 1 Product 1 ── n ProductPhoto
Trigger n ── 1 MessageTemplate
Message n ── 1 MessageTemplate (optional)
Message n ── 1 Trigger (optional)
User 1 ── n Order (assigned_craftsman)
```
