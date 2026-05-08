package com.drshoes.app.order;

import java.util.UUID;

public class OrderItemNotFoundException extends RuntimeException {
    public OrderItemNotFoundException(UUID itemId) {
        super("OrderItem not found: " + itemId);
    }
}
