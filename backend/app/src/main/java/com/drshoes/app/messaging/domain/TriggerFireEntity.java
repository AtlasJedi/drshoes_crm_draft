package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
@Entity
@Table(name = "trigger_fire")
@IdClass(TriggerFireId.class)
@Getter
@Setter
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
    public UUID getOrderId() { return orderId; }
    public OffsetDateTime getFiredAt() { return firedAt; }
}
