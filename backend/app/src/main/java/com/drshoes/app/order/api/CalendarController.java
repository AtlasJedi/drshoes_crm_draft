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
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@RestController
@RequestMapping("/api/admin/orders")
@Slf4j
@RequiredArgsConstructor
public class CalendarController {
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    private final OrderRepository orderRepo;
    private final OrderItemRepository itemRepo;
    private final ClientRepository clientRepo;

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
        List<Order> allOrders = orderRepo.findAllActiveInWindow(fromInstant, toInstant);
        Set<UUID> clientIds = new HashSet<>();
        allOrders.forEach(o -> clientIds.add(o.getClientId()));
        Map<UUID, String> clientNames = clientRepo.findAllById(clientIds).stream()
            .collect(Collectors.toMap(Client::getId, Client::getFullName));
        Set<UUID> orderIds = new HashSet<>();
        allOrders.forEach(o -> orderIds.add(o.getId()));
        Map<UUID, String> summaries = buildSummaries(orderIds);

        List<CalendarOrderDto> scheduledDtos = allOrders.stream()
            .map(o -> toDto(o, clientNames, summaries))
            .toList();

        long defaultedCount = scheduledDtos.stream().filter(CalendarOrderDto::pickupAtDefaulted).count();
        log.info("op=calendarQuery from={} to={} scheduledCount={} defaultedCount={} outcome=ok",
            from, to, scheduledDtos.size(), defaultedCount);
        return new CalendarResponseDto(scheduledDtos, List.of());
    }
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
