package com.drshoes.app.order;

import com.drshoes.app.client.domain.Client;
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
 * Extracted per the granular-code rule — keeps OrderService and OrderController
 * under the 120 LOC ceiling.
 *
 * Tag predicate uses {@code jsonb_contains(tags, jsonb_build_array(tag))} which
 * maps to the Postgres {@code @>} operator. Hibernate passes unknown function names
 * through to the DB verbatim, so no custom dialect registration is required.
 */
public final class OrderSpecifications {

    private OrderSpecifications() {}

    /**
     * Builds a Specification that combines all optional filter predicates.
     *
     * @param clientId when non-null, restricts results to orders for that client (M7)
     */
    public static Specification<Order> forList(List<OrderStatus> statuses, UUID assigneeId,
                                               List<OrderItemKind> kinds, String q,
                                               String tag, Instant plannedPickupAtFrom,
                                               Instant plannedPickupAtTo, UUID clientId,
                                               Boolean urgent) {
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
                var clientSq = query.subquery(UUID.class);
                var client = clientSq.from(Client.class);
                clientSq.select(client.get("id")).where(cb.and(
                    cb.equal(client.get("id"), root.get("clientId")),
                    cb.or(
                        cb.like(cb.lower(client.get("firstName")), like),
                        cb.like(cb.lower(cb.coalesce(client.get("lastName"), "")), like),
                        cb.like(
                            cb.lower(cb.concat(
                                cb.concat(client.get("firstName"), " "),
                                cb.coalesce(client.get("lastName"), ""))),
                            like))));
                preds.add(cb.or(
                    cb.like(cb.lower(root.get("code")), like),
                    cb.like(cb.lower(root.get("description")), like),
                    cb.exists(clientSq)));
            }
            if (tag != null && !tag.isBlank()) {
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
            if (clientId != null)
                preds.add(cb.equal(root.get("clientId"), clientId));
            if (Boolean.TRUE.equals(urgent)) {
                Instant cutoff = Instant.now().minusSeconds(14L * 86400L);
                preds.add(cb.isNotNull(root.get("receivedAt")));
                preds.add(cb.lessThanOrEqualTo(root.get("receivedAt"), cutoff));
                preds.add(root.get("status").in(
                    OrderStatus.PRZYJETE, OrderStatus.W_REALIZACJI,
                    OrderStatus.CZEKA_NA_KLIENTA, OrderStatus.GOTOWE_DO_ODBIORU));
            }
            return cb.and(preds.toArray(new Predicate[0]));
        };
    }
}
