package com.drshoes.app.messaging.domain;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
@EqualsAndHashCode
@Getter
@Setter
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
}
