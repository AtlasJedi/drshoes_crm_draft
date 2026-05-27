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
public final class OrderSpecifications {

    private OrderSpecifications() {}
    public static Specification<Order> forList(List<OrderStatus> statuses, UUID assigneeId,
                                               List<OrderItemKind> kinds, String q,
                                               String tag, Instant plannedPickupAtFrom,
                                               Instant plannedPickupAtTo, UUID clientId,
                                               Boolean urgent, Instant wydaneCutoff) {
        return (root, query, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            preds.add(cb.isNull(root.get("deletedAt")));
            if (statuses != null && !statuses.isEmpty()) {
                if (wydaneCutoff != null) {
                    preds.add(cb.or(
                        root.get("status").in(statuses),
                        cb.and(
                            cb.equal(root.get("status"), OrderStatus.WYDANE),
                            cb.greaterThanOrEqualTo(root.get("pickedUpAt"), wydaneCutoff))));
                } else {
                    preds.add(root.get("status").in(statuses));
                }
            }
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
                Instant cutoff = Instant.now().minusSeconds(4L * 86400L);
                preds.add(cb.isNotNull(root.get("receivedAt")));
                preds.add(cb.lessThanOrEqualTo(root.get("receivedAt"), cutoff));
                preds.add(cb.equal(root.get("status"), OrderStatus.PRZYJETE));
            }
            return cb.and(preds.toArray(new Predicate[0]));
        };
    }
}
