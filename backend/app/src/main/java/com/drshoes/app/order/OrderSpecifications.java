package com.drshoes.app.order;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItem;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.OrderStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Static factory for JPA Specifications used when listing Orders.
 * Extracted per the granular-code rule — keeps OrderService and OrderQueryService
 * under the 120 LOC ceiling.
 */
public final class OrderSpecifications {

    private OrderSpecifications() {}

    public static Specification<Order> forList(OrderStatus status, UUID assigneeId,
                                               List<OrderItemKind> kinds, String q) {
        return (root, query, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            preds.add(cb.isNull(root.get("deletedAt")));
            if (status != null) preds.add(cb.equal(root.get("status"), status));
            if (assigneeId != null) preds.add(cb.equal(root.get("assignedCraftsmanId"), assigneeId));
            if (kinds != null && !kinds.isEmpty()) {
                var sq = query.subquery(UUID.class);
                var item = sq.from(OrderItem.class);
                sq.select(item.get("orderId")).where(
                    cb.and(cb.equal(item.get("orderId"), root.get("id")),
                           item.get("kind").in(kinds)));
                preds.add(cb.exists(sq));
            }
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase() + "%";
                preds.add(cb.or(
                    cb.like(cb.lower(root.get("code")), like),
                    cb.like(cb.lower(root.get("description")), like)));
            }
            return cb.and(preds.toArray(new Predicate[0]));
        };
    }
}
