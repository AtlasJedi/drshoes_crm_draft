package com.drshoes.app.sklep;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * JPA entity for sklep product reservation.
 *
 * productId is a raw UUID with no FK constraint — the Product entity and its
 * table are deferred to M10. status enum is stored as VARCHAR(32) with a DB check
 * constraint (V017 migration). Cancellation records the timestamp in cancelledAt
 * and flips status to CANCELLED (soft delete).
 *
 * NOTE: this class is intentionally under 120 LOC per granular-code directive.
 */
@Entity
@Table(name = "product_reservation")
public class ProductReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    /** Nullable: set when the reservation is linked to a registered client (M10). */
    @Column(name = "client_id")
    private UUID clientId;

    @Column(name = "client_name", nullable = false, length = 255)
    private String clientName;

    @Column(name = "client_phone", length = 64)
    private String clientPhone;

    @Column
    private String note;

    @Column(nullable = false, length = 32)
    private String status = "PENDING";

    @Column(name = "reserved_at", nullable = false)
    private Instant reservedAt = Instant.now();

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    /** JPA no-arg constructor. */
    protected ProductReservation() {}

    public ProductReservation(UUID productId, String clientName, String clientPhone, String note) {
        this.productId = productId;
        this.clientName = clientName;
        this.clientPhone = clientPhone;
        this.note = note;
    }

    // --- getters ---

    public UUID getId()          { return id; }
    public UUID getProductId()   { return productId; }
    public UUID getClientId()    { return clientId; }
    public String getClientName() { return clientName; }
    public String getClientPhone() { return clientPhone; }
    public String getNote()      { return note; }
    public String getStatus()    { return status; }
    public Instant getReservedAt() { return reservedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    // --- mutators ---

    public void cancel() {
        this.status = "CANCELLED";
        this.cancelledAt = Instant.now();
        this.updatedAt = Instant.now();
    }
}
