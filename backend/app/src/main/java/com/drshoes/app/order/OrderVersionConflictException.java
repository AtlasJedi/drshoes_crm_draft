package com.drshoes.app.order;

import java.util.UUID;

public class OrderVersionConflictException extends RuntimeException {
    private final int currentVersion;

    public OrderVersionConflictException(UUID id, int currentVersion) {
        super("Order version conflict for " + id + ": current version is " + currentVersion);
        this.currentVersion = currentVersion;
    }

    public int getCurrentVersion() { return currentVersion; }
}
