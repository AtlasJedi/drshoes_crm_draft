package com.drshoes.app.order.api;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItem;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderUrgency;
import com.drshoes.app.order.dto.CalendarResponseDto;
import com.drshoes.app.order.dto.CalendarResponseDto.CalendarOrderDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Calendar view endpoint: orders windowed by planned_pickup_at + unscheduled list.
 *
 * GET /api/admin/orders/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   - scheduled: orders with planned_pickup_at in [from, to] window, active statuses
 *   - unscheduled: active orders with no planned_pickup_at, capped at 50
 *   - Range > 92 days or from > to → 400
 *
 * Structured logging: op=calendarQuery from={} to={} scheduledCount={} unscheduledCount={} outcome=ok
 */
@RestController
@RequestMapping("/api/admin/orders")
public class CalendarController {

    private static final Logger log = LoggerFactory.getLogger(CalendarController.class);
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    private final OrderRepository orderRepo;
    private final OrderItemRepository itemRepo;
    private final ClientRepository clientRepo;

    public CalendarController(OrderRepository orderRepo,
                              OrderItemRepository itemRepo,
                              ClientRepository clientRepo) {
        this.orderRepo = orderRepo;
        this.itemRepo = itemRepo;
        this.clientRepo = clientRepo;
    }

    @GetMapping("/calendar")
    public CalendarResponseDto calendar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        if (from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must not be after to");
        }
        long days = ChronoUnit.DAYS.between(from, to);
        if (days > 92) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Calendar range must not exceed 92 days");
        }

        Instant fromInstant = from.atStartOfDay(WARSAW).toInstant();
        Instant toInstant   = to.plusDays(1).atStartOfDay(WARSAW).toInstant();

        // v2-B: all active orders in window — both with and without plannedPickupAt
        List<Order> allOrders = orderRepo.findAllActiveInWindow(fromInstant, toInstant);

        // Pre-fetch client names in one batch
        Set<UUID> clientIds = new HashSet<>();
        allOrders.forEach(o -> clientIds.add(o.getClientId()));
        Map<UUID, String> clientNames = clientRepo.findAllById(clientIds).stream()
            .collect(Collectors.toMap(Client::getId, Client::getFullName));

        // Pre-fetch first items in one batch (for itemSummary)
        Set<UUID> orderIds = new HashSet<>();
        allOrders.forEach(o -> orderIds.add(o.getId()));
        Map<UUID, String> summaries = buildSummaries(orderIds);

        List<CalendarOrderDto> scheduledDtos = allOrders.stream()
            .map(o -> toDto(o, clientNames, summaries))
            .toList();

        long defaultedCount = scheduledDtos.stream().filter(CalendarOrderDto::pickupAtDefaulted).count();
        log.info("op=calendarQuery from={} to={} scheduledCount={} defaultedCount={} outcome=ok",
            from, to, scheduledDtos.size(), defaultedCount);

        // unscheduled is always empty — every order now has an effectivePickupAt
        return new CalendarResponseDto(scheduledDtos, List.of());
    }

    /**
     * Maps an Order to CalendarOrderDto (v2-B contract).
     * effectivePickupAt = plannedPickupAt ?? receivedAt + 14 days.
     * pickupAtDefaulted = true when no explicit plannedPickupAt was set.
     */
    private CalendarOrderDto toDto(Order o, Map<UUID, String> clientNames,
                                   Map<UUID, String> summaries) {
        String clientName = clientNames.getOrDefault(o.getClientId(), "");
        String summary    = summaries.getOrDefault(o.getId(), "");
        boolean urgent    = isUrgent(o);
        boolean defaulted = o.getPlannedPickupAt() == null;
        Instant effective = defaulted
            ? o.getReceivedAt().plus(14, ChronoUnit.DAYS)
            : o.getPlannedPickupAt();
        return new CalendarOrderDto(
            o.getId(), o.getCode(), clientName, o.getStatus(),
            o.getPlannedPickupAt(),
            o.getReceivedAt(),
            effective,
            defaulted,
            summary, urgent);
    }

    /** Delegates to OrderUrgency: status == PRZYJETE AND receivedAt + 4d <= now. */
    private static boolean isUrgent(Order o) {
        return OrderUrgency.isUrgent(o.getReceivedAt(), o.getStatus());
    }

    private Map<UUID, String> buildSummaries(Set<UUID> orderIds) {
        if (orderIds.isEmpty()) return Collections.emptyMap();
        Map<UUID, String> map = new HashMap<>();
        for (UUID oid : orderIds) {
            List<OrderItem> items = itemRepo.findAllByOrderIdOrderByPosition(oid);
            if (items.isEmpty()) {
                map.put(oid, "");
            } else {
                String desc = items.get(0).getDescription();
                if (desc != null && desc.length() > 40) {
                    map.put(oid, desc.substring(0, 40));
                } else {
                    map.put(oid, desc != null ? desc : "");
                }
            }
        }
        return map;
    }
}
