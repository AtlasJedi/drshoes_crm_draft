package com.drshoes.app.photo.service;

import java.util.UUID;

public class OrderItemNotInOrderException extends RuntimeException {
    public OrderItemNotInOrderException(UUID itemId, UUID orderId) {
        super("OrderItem " + itemId + " does not belong to order " + orderId);
    }
}
