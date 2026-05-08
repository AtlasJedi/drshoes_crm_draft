package com.drshoes.app.order.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {
    List<OrderItem> findAllByOrderIdOrderByPosition(UUID orderId);
    void deleteAllByOrderId(UUID orderId);
}
