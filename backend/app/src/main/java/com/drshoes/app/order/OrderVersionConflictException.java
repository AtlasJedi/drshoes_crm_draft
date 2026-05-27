package com.drshoes.app.order;

import java.util.UUID;
import lombok.Getter;

@Getter
public class OrderVersionConflictException extends RuntimeException {
    private final int currentVersion;

    public OrderVersionConflictException(UUID orderId, int currentVersion) {
        super("Order " + orderId + " version conflict, current version: " + currentVersion);
        this.currentVersion = currentVersion;
    }
}
