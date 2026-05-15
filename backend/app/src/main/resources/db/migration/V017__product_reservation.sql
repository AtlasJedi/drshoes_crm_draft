-- V017: Sklep product reservations queue
-- product_reservation holds client contact + note + status for shoe shop product reservations.
-- No FK to a products table (Product entity deferred to M10). productId is an unvalidated UUID.
-- Reservations with status='CANCELLED' are soft-deleted (cancellation timestamp also recorded).

CREATE TABLE product_reservation (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL,
    client_id       UUID        NULL,        -- nullable: pre-registration from public site (M10)
    client_name     VARCHAR(255) NOT NULL,
    client_phone    VARCHAR(64) NULL,
    note            TEXT        NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'PENDING'
                        CONSTRAINT chk_product_reservation_status
                        CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
    reserved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at    TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_reservation_product
    ON product_reservation(product_id)
    WHERE status <> 'CANCELLED';

CREATE INDEX idx_product_reservation_created
    ON product_reservation(created_at DESC);
