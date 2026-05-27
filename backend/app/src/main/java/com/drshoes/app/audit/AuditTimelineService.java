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
@Service
@Transactional(readOnly = true)
@Slf4j
@RequiredArgsConstructor
public class AuditTimelineService {

    private final AuditLogRepository auditLogRepo;
    private final OrderRepository orderRepo;
    private final UserRepository userRepo;
    private final TimelineEventCurator curator;
    public List<TimelineEvent> timelineForOrder(UUID orderId) {
        Optional<Order> orderOpt = orderRepo.findById(orderId);

        String pathPrefix = "/api/admin/orders/" + orderId + "%";
        List<AuditLog> rawRows = auditLogRepo.findOrderTimelineRows(pathPrefix, orderId);

        log.info("op=timelineForOrder orderId={} rowsRaw={}", orderId, rawRows.size());
        Set<UUID> actorIds = rawRows.stream()
            .map(AuditLog::getActorId)
            .filter(a -> a != null)
            .collect(Collectors.toSet());

        Map<UUID, String> actorNames = userRepo.findAllById(actorIds).stream()
            .collect(Collectors.toMap(
                u -> u.getId(),
                u -> u.getFullName()
            ));
        List<TimelineEvent> events = new ArrayList<>();
        for (AuditLog row : rawRows) {
            String actorName = row.getActorId() != null
                ? actorNames.getOrDefault(row.getActorId(), "—")
                : "—";
            curator.curate(row, actorName).ifPresent(events::add);
        }
        if (orderOpt.isPresent()) {
            Order order = orderOpt.get();
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
        events.sort(Comparator.comparing(TimelineEvent::occurredAt));

        log.info("op=timelineForOrder orderId={} rowsRaw={} rowsCurated={} outcome=ok",
            orderId, rawRows.size(), events.size());

        return events;
    }
}
