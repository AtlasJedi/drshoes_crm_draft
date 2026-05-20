package com.drshoes.app.order.api;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.*;
import com.drshoes.app.order.dto.KanbanResponseDto;
import com.drshoes.app.order.dto.KanbanResponseDto.KanbanCardDto;
import com.drshoes.app.order.dto.KanbanResponseDto.KanbanColumnDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Kanban board endpoint — returns all 4 active columns in one round-trip.
 *
 * GET /api/admin/orders/kanban?limitPerColumn=N
 *   - columns: PRZYJETE → W_REALIZACJI → CZEKA_NA_KLIENTA → GOTOWE_DO_ODBIORU
 *   - all columns capped at limitPerColumn (1–200); 400 if out of range
 *   - total = unfiltered badge count; hasMore = total > effective cap
 *   - soft-deleted excluded
 *
 * Structured logging: op=kanbanBoard limitPerColumn={} outcome=ok
 */
@RestController
@RequestMapping("/api/admin/orders")
public class KanbanController {

    private static final Logger log = LoggerFactory.getLogger(KanbanController.class);
    private static final List<OrderStatus> COLUMN_ORDER = List.of(
        OrderStatus.PRZYJETE,
        OrderStatus.W_REALIZACJI,
        OrderStatus.CZEKA_NA_KLIENTA,
        OrderStatus.GOTOWE_DO_ODBIORU
    );

    private final OrderRepository orderRepo;
    private final OrderItemRepository itemRepo;
    private final ClientRepository clientRepo;

    public KanbanController(OrderRepository orderRepo,
                            OrderItemRepository itemRepo,
                            ClientRepository clientRepo) {
        this.orderRepo = orderRepo;
        this.itemRepo = itemRepo;
        this.clientRepo = clientRepo;
    }

    @GetMapping("/kanban")
    public KanbanResponseDto kanban(
            @RequestParam(defaultValue = "50") int limitPerColumn) {

        if (limitPerColumn < 1 || limitPerColumn > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "limitPerColumn must be between 1 and 200");
        }

        // First pass: fetch counts + paged cards per column.
        Map<OrderStatus, List<Order>> columnOrders = new LinkedHashMap<>();
        Map<OrderStatus, Long> columnTotals = new LinkedHashMap<>();
        Map<UUID, Order> allOrders = new LinkedHashMap<>();

        for (OrderStatus status : COLUMN_ORDER) {
            long total = orderRepo.countByStatusNotDeleted(status);
            columnTotals.put(status, total);

            List<Order> cards = orderRepo.findTopByStatusOrderByReceivedAtDesc(status.name(), limitPerColumn);
            columnOrders.put(status, cards);
            cards.forEach(o -> allOrders.put(o.getId(), o));
        }

        // Batch fetch client names.
        Set<UUID> clientIds = allOrders.values().stream()
            .map(Order::getClientId)
            .collect(Collectors.toSet());
        Map<UUID, String> clientNames = clientRepo.findAllById(clientIds).stream()
            .collect(Collectors.toMap(Client::getId, Client::getFullName));

        // Batch fetch item summaries.
        Map<UUID, String> summaries = buildSummaries(allOrders.keySet());

        // Build column DTOs.
        List<KanbanColumnDto> columns = new ArrayList<>();
        for (OrderStatus status : COLUMN_ORDER) {
            long total  = columnTotals.get(status);
            List<Order> orders = columnOrders.get(status);
            boolean hasMore = total > limitPerColumn;

            List<KanbanCardDto> cards = orders.stream().map(o -> new KanbanCardDto(
                o.getId(),
                o.getCode(),
                clientNames.getOrDefault(o.getClientId(), ""),
                summaries.getOrDefault(o.getId(), ""),
                o.getPlannedPickupAt(),
                o.getReceivedAt(),
                isUrgent(o),
                o.getVersion()
            )).toList();

            columns.add(new KanbanColumnDto(status, total, cards, hasMore));
        }

        log.info("op=kanbanBoard limitPerColumn={} outcome=ok", limitPerColumn);
        return new KanbanResponseDto(columns);
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
                map.put(oid, desc != null && desc.length() > 40
                    ? desc.substring(0, 40)
                    : desc != null ? desc : "");
            }
        }
        return map;
    }
}
