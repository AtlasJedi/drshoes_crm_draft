package com.drshoes.app.order;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItem;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.OrderStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Static factory for JPA Specifications used when listing Orders.
 * Extracted per the granular-code rule — keeps OrderService and OrderQueryService
 * under the 120 LOC ceiling.
 *
 * Tag predicate uses {@code jsonb_contains(tags, jsonb_build_array(tag))} which
 * maps to the Postgres {@code @>} operator. Hibernate passes unknown function names
 * through to the DB verbatim, so no custom dialect registration is required.
 */
public final class OrderSpecifications {

    private OrderSpecifications() {}

    public static Specification<Order> forList(List<OrderStatus> statuses, UUID assigneeId,
                                               List<OrderItemKind> kinds, String q,
                                               String tag, Instant plannedPickupAtFrom,
                                               Instant plannedPickupAtTo) {
        return (root, query, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            preds.add(cb.isNull(root.get("deletedAt")));
            if (statuses != null && !statuses.isEmpty())
                preds.add(root.get("status").in(statuses));
            if (assigneeId != null)
                preds.add(cb.equal(root.get("assignedCraftsmanId"), assigneeId));
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
            if (tag != null && !tag.isBlank()) {
                // jsonb_contains(tags, jsonb_build_array(tag)) ≡ tags @> '["tag"]'
                // Hibernate passes unknown SQL function names through to the DB.
                preds.add(cb.isTrue(
                    cb.function("jsonb_contains", Boolean.class,
                        root.get("tags"),
                        cb.function("jsonb_build_array", Object.class,
                            cb.literal(tag)))));
            }
            if (plannedPickupAtFrom != null)
                preds.add(cb.greaterThanOrEqualTo(root.get("plannedPickupAt"), plannedPickupAtFrom));
            if (plannedPickupAtTo != null)
                preds.add(cb.lessThan(root.get("plannedPickupAt"), plannedPickupAtTo));
            return cb.and(preds.toArray(new Predicate[0]));
        };
    }
}
