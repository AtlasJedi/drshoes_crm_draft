package com.drshoes.app.audit;

import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * Composes the admin order timeline from audit_log rows.
 *
 * <h2>ORDER_CREATED synthesis</h2>
 * The POST /api/admin/orders audit row has no orderId in its path, so it cannot
 * be found by the pathPrefix scan. ORDER_CREATED is synthesised from
 * {@code Order.createdAt} directly. The actor is resolved from audit_log rows
 * that do belong to this order; if no actor can be identified, "—" is used.
 * This is M1 debt — documented in dispatch-log 1-10.
 *
 * <h2>RBAC</h2>
 * Both OWNER and EMPLOYEE may call this service. Access is enforced at the controller
 * layer via the admin SecurityConfig filter chain (isAuthenticated()).
 *
 * <h2>Structured logging</h2>
 * INFO: op=timelineForOrder orderId={} rowsRaw={} rowsCurated={} outcome=ok
 */
@Service
@Transactional(readOnly = true)
@Slf4j
@RequiredArgsConstructor
public class AuditTimelineService {

    private final AuditLogRepository auditLogRepo;
    private final OrderRepository orderRepo;
    private final UserRepository userRepo;
    private final TimelineEventCurator curator;

    /**
     * Returns the chronological timeline for the given orderId.
     * Returns an empty list for unknown orderIds (no 404 — UI shows empty state).
     *
     * @param orderId the order to build the timeline for
     * @return sorted list of curated timeline events, oldest first
     */
    public List<TimelineEvent> timelineForOrder(UUID orderId) {
        Optional<Order> orderOpt = orderRepo.findById(orderId);

        String pathPrefix = "/api/admin/orders/" + orderId + "%";
        List<AuditLog> rawRows = auditLogRepo.findOrderTimelineRows(pathPrefix, orderId);

        log.info("op=timelineForOrder orderId={} rowsRaw={}", orderId, rawRows.size());

        // Batch-load actor names for all distinct actor UUIDs
        Set<UUID> actorIds = rawRows.stream()
            .map(AuditLog::getActorId)
            .filter(a -> a != null)
            .collect(Collectors.toSet());

        Map<UUID, String> actorNames = userRepo.findAllById(actorIds).stream()
            .collect(Collectors.toMap(
                u -> u.getId(),
                u -> u.getFullName()
            ));

        // Curate raw rows into timeline events
        List<TimelineEvent> events = new ArrayList<>();
        for (AuditLog row : rawRows) {
            String actorName = row.getActorId() != null
                ? actorNames.getOrDefault(row.getActorId(), "—")
                : "—";
            curator.curate(row, actorName).ifPresent(events::add);
        }

        // Prepend synthetic ORDER_CREATED from Order.createdAt
        if (orderOpt.isPresent()) {
            Order order = orderOpt.get();
            // Determine actor: use first actor found in raw rows (earliest chronologically)
            String creatorName = rawRows.stream()
                .filter(r -> r.getActorId() != null)
                .findFirst()
                .map(r -> actorNames.getOrDefault(r.getActorId(), "—"))
                .orElse("—");

            TimelineEvent created = new TimelineEvent(
                null,
                TimelineEventKind.ORDER_CREATED,
                order.getCreatedAt(),
                creatorName,
                Map.of(),
                null,
                null,
                null
            );
            events.add(0, created);
        }

        // Sort by occurredAt (createdAt from AuditLog / order.createdAt for synthetic)
        events.sort(Comparator.comparing(TimelineEvent::occurredAt));

        log.info("op=timelineForOrder orderId={} rowsRaw={} rowsCurated={} outcome=ok",
            orderId, rawRows.size(), events.size());

        return events;
    }
}
