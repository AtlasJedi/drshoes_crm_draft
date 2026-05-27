package com.drshoes.app.order;

import com.drshoes.app.order.domain.OrderItem;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.dto.CreateOrderItemRequest;
import com.drshoes.app.order.dto.OrderItemDto;
import com.drshoes.app.order.dto.UpdateOrderItemRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * Manages OrderItem mutations and keeps totalPriceCents in sync on the parent Order.
 *
 * Structured logging: op={} orderId={} itemId={} outcome=ok|not-found
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OrderItemService {

    private final OrderItemRepository itemRepo;
    private final OrderRepository orderRepo;

    @Transactional
    public OrderItemDto addItem(UUID orderId, CreateOrderItemRequest req) {
        OrderItem item = new OrderItem();
        item.setOrderId(orderId);
        item.setKind(req.kind());
        item.setDescription(req.description());
        item.setCraftsmanNotes(req.craftsmanNotes());
        item.setPriceCents(req.priceCents());
        List<OrderItem> existing = itemRepo.findAllByOrderIdOrderByPosition(orderId);
        item.setPosition(existing.size());
        OrderItem saved = itemRepo.save(item);
        recomputeTotal(orderId);
        log.info("op=addOrderItem orderId={} itemId={} outcome=ok", orderId, saved.getId());
        return OrderItemDto.of(saved);
    }

    @Transactional
    public OrderItemDto updateItem(UUID orderId, UUID itemId, UpdateOrderItemRequest req) {
        OrderItem item = itemRepo.findById(itemId)
            .filter(i -> orderId.equals(i.getOrderId()))
            .orElseThrow(() -> new OrderItemNotFoundException(itemId));
        if (req.kind() != null)           item.setKind(req.kind());
        if (req.description() != null)    item.setDescription(req.description());
        if (req.craftsmanNotes() != null) item.setCraftsmanNotes(req.craftsmanNotes());
        if (req.priceCents() != null)     item.setPriceCents(req.priceCents());
        OrderItem saved = itemRepo.save(item);
        recomputeTotal(orderId);
        log.info("op=updateOrderItem orderId={} itemId={} outcome=ok", orderId, itemId);
        return OrderItemDto.of(saved);
    }

    @Transactional
    public void removeItem(UUID orderId, UUID itemId) {
        OrderItem item = itemRepo.findById(itemId)
            .filter(i -> orderId.equals(i.getOrderId()))
            .orElseThrow(() -> new OrderItemNotFoundException(itemId));
        itemRepo.delete(item);
        recomputeTotal(orderId);
        log.info("op=removeOrderItem orderId={} itemId={} outcome=ok", orderId, itemId);
    }

    /** Sums item priceCents and writes it to the parent order (both totalPriceCents and quotedPriceCents). */
    void recomputeTotal(UUID orderId) {
        int total = itemRepo.findAllByOrderIdOrderByPosition(orderId)
            .stream().mapToInt(OrderItem::getPriceCents).sum();
        orderRepo.findById(orderId).ifPresent(o -> {
            o.setTotalPriceCents(total);
            o.setQuotedPriceCents(total);
            orderRepo.save(o);
        });
    }
}
