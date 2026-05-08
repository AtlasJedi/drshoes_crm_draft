package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA entity for the trigger_fire dedup table (composite PK).
 *
 * Design notes:
 *   - Uses @IdClass for composite PK (triggerId + orderId + discriminator).
 *   - firedAt is DB-defaulted (DEFAULT now()); insertable=false so we don't override it.
 *   - No direct FK associations — raw UUIDs only (aggregate boundaries).
 */
@Entity
@Table(name = "trigger_fire")
@IdClass(TriggerFireId.class)
public class TriggerFireEntity {

    @Id
    @Column(name = "trigger_id", columnDefinition = "uuid")
    private UUID triggerId;

    @Id
    @Column(name = "order_id", columnDefinition = "uuid")
    private UUID orderId;

    @Id
    @Column(name = "discriminator", length = 120)
    private String discriminator;

    @Column(name = "fired_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime firedAt;

    protected TriggerFireEntity() {}

    public TriggerFireEntity(UUID triggerId, UUID orderId, String discriminator) {
        this.triggerId = triggerId;
        this.orderId = orderId;
        this.discriminator = discriminator;
    }

    // ---- accessors ----

    public UUID getTriggerId() { return triggerId; }
    public UUID getOrderId() { return orderId; }
    public String getDiscriminator() { return discriminator; }
    public OffsetDateTime getFiredAt() { return firedAt; }
}
