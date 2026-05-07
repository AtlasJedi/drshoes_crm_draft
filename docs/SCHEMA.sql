-- =============================================================================
-- Dr Shoes — V001__init.sql
-- Single Flyway baseline migration. All tables, enums (as CHECK), FKs, indexes.
-- Status: PROTO for review. Will land at backend/app/src/main/resources/db/migration/V001__init.sql
-- =============================================================================

-- Extensions ------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy search on names/codes
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive email

-- Generic helper: updated_at touch trigger ------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- =============================================================================
-- USERS (admin)
-- =============================================================================
CREATE TABLE user_ (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           CITEXT NOT NULL UNIQUE,
  password_hash   VARCHAR(100) NOT NULL,
  full_name       VARCHAR(120) NOT NULL,
  role            VARCHAR(16) NOT NULL
                  CHECK (role IN ('OWNER','EMPLOYEE','CRAFTSMAN','OFFICE')),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER user_touch BEFORE UPDATE ON user_
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- CLIENTS
-- =============================================================================
CREATE TABLE client (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name         VARCHAR(80) NOT NULL,
  last_name          VARCHAR(80),
  phone              VARCHAR(32),       -- E.164 preferred, validated in app
  email              CITEXT,
  preferred_channel  VARCHAR(16) NOT NULL DEFAULT 'EMAIL'
                     CHECK (preferred_channel IN ('EMAIL','SMS','WHATSAPP')),
  notes              TEXT,
  rodo_consent_at    TIMESTAMPTZ,        -- timestamp of GDPR consent
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_contact_present CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX client_phone_idx        ON client (phone)         WHERE deleted_at IS NULL;
CREATE INDEX client_email_idx        ON client (email)         WHERE deleted_at IS NULL;
CREATE INDEX client_search_idx       ON client USING gin (
  (first_name || ' ' || coalesce(last_name,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(email,'')) gin_trgm_ops
);
CREATE TRIGGER client_touch BEFORE UPDATE ON client
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- STORAGE LOCATIONS
-- =============================================================================
CREATE TABLE storage_location (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         VARCHAR(32) NOT NULL UNIQUE,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  color        VARCHAR(16),         -- e.g. "#e6ff3a" for chip
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER storage_location_touch BEFORE UPDATE ON storage_location
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- MESSAGE TEMPLATES (referenced by triggers and messages)
-- =============================================================================
CREATE TABLE message_template (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(120) NOT NULL UNIQUE,
  channel     VARCHAR(16) NOT NULL CHECK (channel IN ('EMAIL','SMS','WHATSAPP')),
  subject     TEXT,                     -- nullable for SMS
  body        TEXT NOT NULL,            -- with {placeholders}
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER message_template_touch BEFORE UPDATE ON message_template
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- TRIGGERS (the messaging automation, not DB triggers)
-- =============================================================================
CREATE TABLE trigger_ (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                          VARCHAR(120) NOT NULL UNIQUE,
  enabled                       BOOLEAN NOT NULL DEFAULT TRUE,
  event                         VARCHAR(40) NOT NULL
                                CHECK (event IN (
                                  'STATUS_CHANGE','STATUS_CHANGE_FROM','ORDER_RECEIVED',
                                  'BEFORE_PICKUP_X_DAYS','AFTER_HANDOVER_Y_DAYS',
                                  'RESERVATION_EXPIRING'
                                )),
  event_params                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels                      JSONB NOT NULL DEFAULT '["EMAIL"]'::jsonb,  -- array of EMAIL/SMS
  template_id                   UUID NOT NULL REFERENCES message_template(id),
  delay_minutes                 INT NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  requires_manual_confirmation  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trigger_event_idx ON trigger_ (event) WHERE enabled = TRUE;
CREATE TRIGGER trigger_touch BEFORE UPDATE ON trigger_
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- ORDER CODE SEQUENCE — yearly resetting "DR-2025-0042"
-- =============================================================================
CREATE TABLE order_code_counter (
  year         INT PRIMARY KEY,
  last_number  INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_order_code(p_year INT) RETURNS VARCHAR AS $$
DECLARE
  v_next INT;
BEGIN
  INSERT INTO order_code_counter (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = order_code_counter.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN 'DR-' || p_year || '-' || lpad(v_next::text, 4, '0');
END
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ORDERS
-- =============================================================================
CREATE TABLE order_ (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                            VARCHAR(20) NOT NULL UNIQUE,
  client_id                       UUID NOT NULL REFERENCES client(id),
  status                          VARCHAR(32) NOT NULL DEFAULT 'WSTEPNIE_PRZYJETE'
                                  CHECK (status IN (
                                    'WSTEPNIE_PRZYJETE','PRZYJETE','W_REALIZACJI',
                                    'CZEKA_NA_KLIENTA','GOTOWE_DO_ODBIORU','WYDANE',
                                    'ANULOWANE'
                                  )),
  source                          VARCHAR(20) NOT NULL DEFAULT 'ADMIN'
                                  CHECK (source IN ('ADMIN','PUBLIC_INTAKE','IMPORT')),
  received_at                     TIMESTAMPTZ,
  planned_pickup_at               TIMESTAMPTZ,
  picked_up_at                    TIMESTAMPTZ,
  assigned_craftsman_id           UUID REFERENCES user_(id),
  current_storage_location_id     UUID REFERENCES storage_location(id),
  tags                            JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_price_cents               INT NOT NULL DEFAULT 0,
  currency                        VARCHAR(3) NOT NULL DEFAULT 'PLN',
  description                     TEXT,
  cancelled_reason                TEXT,
  deleted_at                      TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_status_pickup_idx ON order_ (status, planned_pickup_at)
  WHERE deleted_at IS NULL;
CREATE INDEX order_client_idx        ON order_ (client_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX order_craftsman_idx     ON order_ (assigned_craftsman_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX order_storage_idx       ON order_ (current_storage_location_id)
  WHERE deleted_at IS NULL;
CREATE INDEX order_search_idx        ON order_ USING gin (
  (code || ' ' || coalesce(description,'')) gin_trgm_ops
) WHERE deleted_at IS NULL;
CREATE TRIGGER order_touch BEFORE UPDATE ON order_
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- ORDER ITEMS
-- =============================================================================
CREATE TABLE order_item (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  position          INT NOT NULL DEFAULT 0,
  kind              VARCHAR(20) NOT NULL
                    CHECK (kind IN ('NAPRAWA','CUSTOM_BUTY','CUSTOM_KURTKA')),
  description       TEXT NOT NULL,
  craftsman_notes   TEXT,
  price_cents       INT NOT NULL DEFAULT 0,
  work_minutes      INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_item_order_idx ON order_item (order_id, position);
CREATE TRIGGER order_item_touch BEFORE UPDATE ON order_item
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- PHOTOS (orders + items)
-- =============================================================================
CREATE TABLE photo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  order_item_id   UUID REFERENCES order_item(id) ON DELETE SET NULL,
  s3_key          VARCHAR(255) NOT NULL UNIQUE,
  mime            VARCHAR(60) NOT NULL,
  width           INT,
  height          INT,
  bytes           INT,
  label           VARCHAR(20) NOT NULL DEFAULT 'OTHER'
                  CHECK (label IN ('BEFORE','IN_PROGRESS','AFTER','OTHER')),
  position        INT NOT NULL DEFAULT 0,
  uploaded_by     UUID REFERENCES user_(id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX photo_order_idx ON photo (order_id, label, position);

-- =============================================================================
-- INTERNAL NOTES
-- =============================================================================
CREATE TABLE internal_note (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES user_(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX internal_note_order_idx ON internal_note (order_id, created_at DESC);

-- =============================================================================
-- MESSAGE THREADS / MESSAGES
-- =============================================================================
CREATE TABLE message_thread (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES client(id),
  subject         TEXT,                          -- carried from latest email subject
  last_message_at TIMESTAMPTZ,
  unread_count    INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX message_thread_client_idx ON message_thread (client_id, last_message_at DESC);
CREATE TRIGGER message_thread_touch BEFORE UPDATE ON message_thread
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE message (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id             UUID NOT NULL REFERENCES message_thread(id) ON DELETE CASCADE,
  order_id              UUID REFERENCES order_(id) ON DELETE SET NULL,
  client_id             UUID NOT NULL REFERENCES client(id),
  direction             VARCHAR(10) NOT NULL CHECK (direction IN ('OUTBOUND','INBOUND')),
  channel               VARCHAR(16) NOT NULL CHECK (channel IN ('EMAIL','SMS','WHATSAPP')),
  template_id           UUID REFERENCES message_template(id),
  trigger_id            UUID REFERENCES trigger_(id),
  scheduled_message_id  UUID,                              -- soft FK; FK added after table created
  subject               TEXT,
  body                  TEXT NOT NULL,
  attachments           JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of s3_keys
  delivery_status       VARCHAR(16) NOT NULL DEFAULT 'QUEUED'
                        CHECK (delivery_status IN ('QUEUED','SENT','DELIVERED','FAILED','READ')),
  provider_message_id   VARCHAR(120),
  error_code            VARCHAR(60),
  error_message         TEXT,
  sent_at               TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  read_at               TIMESTAMPTZ,
  sent_by               UUID REFERENCES user_(id),         -- null for inbound and trigger-fired
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX message_thread_idx     ON message (thread_id, created_at);
CREATE INDEX message_order_idx      ON message (order_id, created_at)
  WHERE order_id IS NOT NULL;
CREATE INDEX message_provider_idx   ON message (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- =============================================================================
-- ORDER EVENT (audit timeline, append-only)
-- =============================================================================
CREATE TABLE order_event (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES user_(id),
  type        VARCHAR(40) NOT NULL CHECK (type IN (
                'ORDER_CREATED','STATUS_CHANGED','STORAGE_MOVED','ASSIGNEE_CHANGED',
                'SCHEDULE_CHANGED','ITEM_ADDED','ITEM_UPDATED','ITEM_REMOVED',
                'PHOTO_ADDED','PHOTO_LABELED','PHOTO_REMOVED','NOTE_ADDED',
                'MESSAGE_SENT','MESSAGE_RECEIVED','TAG_ADDED','TAG_REMOVED',
                'CANCELLED','RESTORED','PRICE_CHANGED','TOTAL_RECOMPUTED'
              )),
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_event_order_idx ON order_event (order_id, created_at DESC);
CREATE INDEX order_event_type_idx  ON order_event (type, created_at DESC);

-- Enforce append-only at DB level (defense-in-depth; service layer enforces too)
CREATE OR REPLACE FUNCTION order_event_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'order_event is append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER order_event_no_update BEFORE UPDATE ON order_event
  FOR EACH ROW EXECUTE FUNCTION order_event_append_only();
CREATE TRIGGER order_event_no_delete BEFORE DELETE ON order_event
  FOR EACH ROW EXECUTE FUNCTION order_event_append_only();

-- =============================================================================
-- PRODUCTS (sklep)
-- =============================================================================
CREATE TABLE product (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(160) NOT NULL,
  brand         VARCHAR(80),
  size          VARCHAR(20),
  price_cents   INT NOT NULL DEFAULT 0,
  currency      VARCHAR(3) NOT NULL DEFAULT 'PLN',
  description   TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'DOSTEPNE'
                CHECK (status IN ('DOSTEPNE','ZAREZERWOWANE','SPRZEDANE')),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_status_idx ON product (status) WHERE deleted_at IS NULL;
CREATE INDEX product_brand_idx  ON product (brand)  WHERE deleted_at IS NULL;
CREATE TRIGGER product_touch BEFORE UPDATE ON product
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE product_photo (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  s3_key      VARCHAR(255) NOT NULL UNIQUE,
  mime        VARCHAR(60) NOT NULL,
  width       INT,
  height      INT,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_photo_product_idx ON product_photo (product_id, position);

-- =============================================================================
-- RESERVATIONS
-- =============================================================================
CREATE TABLE reservation (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id               UUID NOT NULL REFERENCES product(id),
  client_id                UUID REFERENCES client(id),     -- nullable: anonymous allowed
  name                     VARCHAR(120) NOT NULL,
  phone                    VARCHAR(32),
  email                    CITEXT,
  preferred_pickup_date    DATE,
  message                  TEXT,
  status                   VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING','CONFIRMED','EXPIRED','CANCELLED','FULFILLED')),
  expires_at               TIMESTAMPTZ NOT NULL,
  source_ip                INET,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reservation_contact_present CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX reservation_product_status_idx ON reservation (product_id, status);
CREATE INDEX reservation_expires_idx        ON reservation (expires_at)
  WHERE status = 'PENDING';
CREATE TRIGGER reservation_touch BEFORE UPDATE ON reservation
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- NEWS POSTS
-- =============================================================================
CREATE TABLE news_post (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          VARCHAR(160) NOT NULL UNIQUE,
  title         VARCHAR(220) NOT NULL,
  excerpt       VARCHAR(500),
  body_html     TEXT NOT NULL,
  cover_s3_key  VARCHAR(255),
  status        VARCHAR(12) NOT NULL DEFAULT 'DRAFT'
                CHECK (status IN ('DRAFT','PUBLISHED')),
  published_at  TIMESTAMPTZ,
  author_id     UUID REFERENCES user_(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX news_post_status_published_idx ON news_post (status, published_at DESC);
CREATE TRIGGER news_post_touch BEFORE UPDATE ON news_post
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE news_photo (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  news_post_id  UUID NOT NULL REFERENCES news_post(id) ON DELETE CASCADE,
  s3_key        VARCHAR(255) NOT NULL UNIQUE,
  position      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX news_photo_post_idx ON news_photo (news_post_id, position);

-- =============================================================================
-- CONTACT INQUIRIES
-- =============================================================================
CREATE TABLE contact_inquiry (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(120) NOT NULL,
  email        CITEXT,
  phone        VARCHAR(32),
  message      TEXT NOT NULL,
  photo_s3_key VARCHAR(255),
  source_ip    INET,
  handled      BOOLEAN NOT NULL DEFAULT FALSE,
  handled_by   UUID REFERENCES user_(id),
  handled_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contact_contact_present CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX contact_inquiry_handled_idx ON contact_inquiry (handled, created_at DESC);

-- =============================================================================
-- SAVED FILTERS (per user, per scope)
-- =============================================================================
CREATE TABLE saved_filter (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES user_(id) ON DELETE CASCADE,
  scope       VARCHAR(40) NOT NULL,         -- e.g. 'orders'
  name        VARCHAR(120) NOT NULL,
  query       JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, name)
);

-- =============================================================================
-- SCHEDULED MESSAGES (durable trigger queue)
-- =============================================================================
CREATE TABLE scheduled_message (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_id                    UUID REFERENCES trigger_(id),
  order_id                      UUID REFERENCES order_(id),
  reservation_id                UUID REFERENCES reservation(id),
  client_id                     UUID NOT NULL REFERENCES client(id),
  channel                       VARCHAR(16) NOT NULL CHECK (channel IN ('EMAIL','SMS','WHATSAPP')),
  template_id                   UUID NOT NULL REFERENCES message_template(id),
  rendered_subject              TEXT,
  rendered_body                 TEXT NOT NULL,
  scheduled_for                 TIMESTAMPTZ NOT NULL,
  state                         VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                CHECK (state IN ('PENDING','AWAITING_CONFIRM','IN_PROGRESS',
                                                 'SENT','DISCARDED','FAILED')),
  requires_manual_confirmation  BOOLEAN NOT NULL DEFAULT FALSE,
  attempts                      INT NOT NULL DEFAULT 0,
  last_error                    TEXT,
  message_id                    UUID REFERENCES message(id),  -- set when SENT
  acted_by                      UUID REFERENCES user_(id),    -- who confirmed/discarded
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scheduled_message_due_idx ON scheduled_message (state, scheduled_for)
  WHERE state IN ('PENDING','AWAITING_CONFIRM');
CREATE INDEX scheduled_message_order_idx ON scheduled_message (order_id);
-- Idempotency for daily-tick triggers: prevent duplicate scheduling per (trigger,order,date)
CREATE UNIQUE INDEX scheduled_message_dedup_idx ON scheduled_message
  (trigger_id, order_id, (scheduled_for::date))
  WHERE state IN ('PENDING','AWAITING_CONFIRM','SENT');
CREATE TRIGGER scheduled_message_touch BEFORE UPDATE ON scheduled_message
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Now wire message.scheduled_message_id FK
ALTER TABLE message
  ADD CONSTRAINT message_scheduled_msg_fk
  FOREIGN KEY (scheduled_message_id) REFERENCES scheduled_message(id) ON DELETE SET NULL;

-- =============================================================================
-- AUDIT LOG (cross-cutting admin write log; OrderEvent stays domain-specific)
-- =============================================================================
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id        UUID REFERENCES user_(id),
  method          VARCHAR(10) NOT NULL,
  path            VARCHAR(255) NOT NULL,
  status          INT NOT NULL,
  ip              INET,
  user_agent      TEXT,
  request_id      UUID,
  body_hash       VARCHAR(64),    -- sha256 of request body for tamper detection
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_actor_idx  ON audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_path_idx   ON audit_log (path, created_at DESC);

-- =============================================================================
-- IDEMPOTENCY KEYS (24h TTL, stores response hash)
-- =============================================================================
CREATE TABLE idempotency_key (
  key             VARCHAR(120) PRIMARY KEY,
  endpoint        VARCHAR(120) NOT NULL,    -- e.g. 'POST /api/public/products/:id/reservations'
  request_hash    VARCHAR(64) NOT NULL,
  response_status INT NOT NULL,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idempotency_key_created_idx ON idempotency_key (created_at);

-- =============================================================================
-- SPRING SESSION JDBC tables (verbatim from Spring 6 / Boot 3)
-- =============================================================================
CREATE TABLE spring_session (
  primary_id            CHAR(36) NOT NULL,
  session_id            CHAR(36) NOT NULL,
  creation_time         BIGINT NOT NULL,
  last_access_time      BIGINT NOT NULL,
  max_inactive_interval INT NOT NULL,
  expiry_time           BIGINT NOT NULL,
  principal_name        VARCHAR(100),
  CONSTRAINT spring_session_pk PRIMARY KEY (primary_id)
);
CREATE UNIQUE INDEX spring_session_ix1 ON spring_session (session_id);
CREATE INDEX        spring_session_ix2 ON spring_session (expiry_time);
CREATE INDEX        spring_session_ix3 ON spring_session (principal_name);

CREATE TABLE spring_session_attributes (
  session_primary_id CHAR(36)     NOT NULL,
  attribute_name     VARCHAR(200) NOT NULL,
  attribute_bytes    BYTEA        NOT NULL,
  CONSTRAINT spring_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name),
  CONSTRAINT spring_session_attributes_fk FOREIGN KEY (session_primary_id)
    REFERENCES spring_session(primary_id) ON DELETE CASCADE
);

-- =============================================================================
-- COMMENTS for documentation generators
-- =============================================================================
COMMENT ON TABLE order_           IS 'Customer orders (intake → handover lifecycle).';
COMMENT ON TABLE order_event      IS 'Append-only audit timeline per order.';
COMMENT ON TABLE scheduled_message IS 'Durable queue for trigger-fired and manually-confirmed outbound messages.';
COMMENT ON TABLE storage_location IS 'Physical workshop locations (shelves, racks) where order items reside.';
COMMENT ON COLUMN order_.code     IS 'Human-readable, year-resetting (DR-2025-0042). Generated by next_order_code(year).';
