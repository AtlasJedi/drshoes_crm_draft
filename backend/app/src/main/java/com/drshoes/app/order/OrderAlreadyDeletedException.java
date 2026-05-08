package com.drshoes.app.order;

import java.util.UUID;

public class OrderAlreadyDeletedException extends RuntimeException {
    public OrderAlreadyDeletedException(UUID id) {
        super("Order already deleted: " + id);
    }
}
