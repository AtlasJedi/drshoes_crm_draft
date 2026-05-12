package com.drshoes.app.demo;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.order.OrderService;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.dto.ChangeStatusRequest;
import com.drshoes.app.order.dto.CreateOrderItemRequest;
import com.drshoes.app.order.dto.CreateOrderRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Creates ~12 sample orders spread across all OrderStatus values.
 *
 * received_at spans the last 21 days; in-progress orders have planned_pickup_at
 * in the next 14 days; terminal orders (WYDANE, ANULOWANE) get picked_up_at set
 * automatically by OrderService.changeStatus.
 *
 * CreateOrderItemRequest arity (4 fields verified against codebase):
 *   (kind, description, craftsmanNotes, priceCents)
 *
 * ChangeStatusRequest arity (3 fields verified):
 *   (targetStatus, expectedVersion [int], sendTriggers [Boolean])
 *   sendTriggers=FALSE for seed data — no SMS/email triggers during seeding.
 *
 * WSTEPNIE_PRZYJETE: OrderService.create always starts at PRZYJETE.
 * changeStatus has no guard on valid transitions, so PRZYJETE→WSTEPNIE_PRZYJETE
 * is allowed directly. Verified in OrderService.changeStatus (no state machine check).
 */
@Component
@Profile("local")
public class DemoOrderFactory {

    private static final Logger log = LoggerFactory.getLogger(DemoOrderFactory.class);

    private final OrderService orderService;
    private final OrderRepository orderRepository;

    public DemoOrderFactory(OrderService orderService, OrderRepository orderRepository) {
        this.orderService = orderService;
        this.orderRepository = orderRepository;
    }

    public List<Order> createAll(List<Client> clients) {
        var now = Instant.now();
        var result = new ArrayList<Order>();

        result.add(seed(clients, 0, now, 21, OrderStatus.WSTEPNIE_PRZYJETE,
            OrderItemKind.NAPRAWA,       "Naprawa zelówek — buty skórzane",     10));
        result.add(seed(clients, 1, now, 18, OrderStatus.PRZYJETE,
            OrderItemKind.NAPRAWA,       "Wymiana podeszwy — trampki",           7));
        result.add(seed(clients, 2, now, 15, OrderStatus.W_REALIZACJI,
            OrderItemKind.CUSTOM_BUTY,   "Custom painting — Air Force 1",        5));
        result.add(seed(clients, 3, now, 14, OrderStatus.W_REALIZACJI,
            OrderItemKind.CUSTOM_KURTKA, "Custom painting — kurtka bomber",      3));
        result.add(seed(clients, 4, now, 12, OrderStatus.CZEKA_NA_KLIENTA,
            OrderItemKind.NAPRAWA,       "Wymiana zamka — kozaki",               2));
        result.add(seed(clients, 5, now, 10, OrderStatus.GOTOWE_DO_ODBIORU,
            OrderItemKind.NAPRAWA,       "Renowacja skóry — buty wizytowe",      1));
        result.add(seed(clients, 0, now,  9, OrderStatus.GOTOWE_DO_ODBIORU,
            OrderItemKind.CUSTOM_BUTY,   "Hand-painted florals — sneakers",      1));
        result.add(seed(clients, 1, now,  7, OrderStatus.WYDANE,
            OrderItemKind.NAPRAWA,       "Uzupełnienie obcasa",                 -1));
        result.add(seed(clients, 2, now,  6, OrderStatus.WYDANE,
            OrderItemKind.CUSTOM_KURTKA, "Malowanie logo na kurtce",            -1));
        result.add(seed(clients, 3, now,  5, OrderStatus.WYDANE,
            OrderItemKind.NAPRAWA,       "Przyklejenie zelówki",                -1));
        result.add(seed(clients, 4, now,  4, OrderStatus.ANULOWANE,
            OrderItemKind.NAPRAWA,       "Zbyt uszkodzone — rezygnacja",        -1));
        result.add(seed(clients, 5, now,  2, OrderStatus.PRZYJETE,
            OrderItemKind.CUSTOM_BUTY,   "Custom design — konsultacja",         14));

        return result;
    }

    private Order seed(List<Client> clients, int clientIdx, Instant now, int daysAgo,
                       OrderStatus targetStatus, OrderItemKind kind,
                       String description, int daysUntilPickup) {
        var client = clients.get(clientIdx % clients.size());
        var receivedAt = now.minus(daysAgo, ChronoUnit.DAYS);
        Instant plannedPickup = daysUntilPickup > 0
            ? now.plus(daysUntilPickup, ChronoUnit.DAYS)
            : null;

        var item = new CreateOrderItemRequest(kind, description, null, 0);
        var req  = new CreateOrderRequest(
            client.getId(), description, receivedAt, plannedPickup, null, null, List.of(item),
            null, null  // quotedPriceCents, advancePaidCents — default to 0 in service
        );
        var dto = orderService.create(req);

        if (targetStatus != OrderStatus.PRZYJETE) {
            advanceTo(dto.id(), dto.version(), targetStatus);
        }

        var saved = orderRepository.findById(dto.id()).orElseThrow();
        log.info("op=demo.seed.order orderId={} status={} clientId={}",
            saved.getId(), saved.getStatus(), client.getId());
        return saved;
    }

    private void advanceTo(UUID orderId, int version, OrderStatus target) {
        int v = version;
        for (var step : progressionTo(target)) {
            var req = new ChangeStatusRequest(step, v, Boolean.FALSE);
            var result = orderService.changeStatus(orderId, req);
            v = result.order().version();
        }
    }

    /**
     * Returns the list of status transitions required to reach {@code target}
     * starting from PRZYJETE (the initial status set by OrderService.create).
     *
     * WSTEPNIE_PRZYJETE: allowed as a direct transition from PRZYJETE because
     * OrderService.changeStatus has no state machine guard — it accepts any
     * target status. Documented deviation from natural flow.
     */
    private List<OrderStatus> progressionTo(OrderStatus target) {
        return switch (target) {
            case WSTEPNIE_PRZYJETE -> List.of(OrderStatus.WSTEPNIE_PRZYJETE);
            case PRZYJETE          -> List.of();
            case W_REALIZACJI      -> List.of(OrderStatus.W_REALIZACJI);
            case CZEKA_NA_KLIENTA  -> List.of(OrderStatus.W_REALIZACJI, OrderStatus.CZEKA_NA_KLIENTA);
            case GOTOWE_DO_ODBIORU -> List.of(OrderStatus.W_REALIZACJI, OrderStatus.GOTOWE_DO_ODBIORU);
            case WYDANE            -> List.of(OrderStatus.W_REALIZACJI, OrderStatus.GOTOWE_DO_ODBIORU,
                                              OrderStatus.WYDANE);
            case ANULOWANE         -> List.of(OrderStatus.ANULOWANE);
        };
    }
}
