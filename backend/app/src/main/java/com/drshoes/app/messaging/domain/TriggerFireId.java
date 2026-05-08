package com.drshoes.app.messaging.domain;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/**
 * Composite PK class for TriggerFireEntity.
 * Field names must match the @Id field names in TriggerFireEntity exactly.
 */
public class TriggerFireId implements Serializable {

    private UUID triggerId;
    private UUID orderId;
    private String discriminator;

    public TriggerFireId() {}

    public TriggerFireId(UUID triggerId, UUID orderId, String discriminator) {
        this.triggerId = triggerId;
        this.orderId = orderId;
        this.discriminator = discriminator;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TriggerFireId that)) return false;
        return Objects.equals(triggerId, that.triggerId)
                && Objects.equals(orderId, that.orderId)
                && Objects.equals(discriminator, that.discriminator);
    }

    @Override
    public int hashCode() {
        return Objects.hash(triggerId, orderId, discriminator);
    }
}
