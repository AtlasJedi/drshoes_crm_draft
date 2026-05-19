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
 * Creates 18 sample orders spread across all OrderStatus values and OrderItemKind types.
 *
 * received_at spans 8 weeks so that every dashboard widget renders meaningful data:
 *   - Pilne panel:             3 orders (PRZYJETE, aged 10/7/5 days).
 *   - Mix donut (active-only): items from orders NOT in WYDANE/ANULOWANE/GOTOWE_DO_ODBIORU.
 *   - Zlecenia/tydzień chart:  non-zero bars across W14..W21 (56/49/42/35/28d entries
 *                              cover earlier weeks; recent entries cover the last 3 weeks).
 *   - KPI "W realizacji":      3 orders (rows 9, 11, 14).
 *   - KPI "Gotowe do odbioru": 2 orders (rows 6, 7).
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

        // ── Week -8 to -5 (terminal orders, excluded from Mix donut) ────────────
        result.add(seed(clients, 0, now, 56, OrderStatus.WYDANE,
            OrderItemKind.NAPRAWA,     "Wymiana zelówek — buty robocze",            -1));
        result.add(seed(clients, 1, now, 49, OrderStatus.WYDANE,
            OrderItemKind.CZYSZCZENIE, "Czyszczenie zamszowych botków",              -1));
        result.add(seed(clients, 2, now, 42, OrderStatus.WYDANE,
            OrderItemKind.CUSTOM,      "Custom — Air Max '90 graffiti drip",        -1));
        result.add(seed(clients, 3, now, 35, OrderStatus.ANULOWANE,
            OrderItemKind.RENOWACJA,   "Zbyt mocno uszkodzone — rezygnacja",        -1));
        result.add(seed(clients, 4, now, 28, OrderStatus.WYDANE,
            OrderItemKind.SZEWC,       "Wymiana zamka — kozaki damskie",            -1));

        // ── Week -3 to -2 (ready/terminal — excluded from Mix donut) ───────────
        result.add(seed(clients, 5, now, 21, OrderStatus.GOTOWE_DO_ODBIORU,
            OrderItemKind.RENOWACJA,   "Renowacja skóry — buty wizytowe",            3));
        result.add(seed(clients, 0, now, 18, OrderStatus.GOTOWE_DO_ODBIORU,
            OrderItemKind.CUSTOM,      "Hand-painted florals — sneakers",            2));

        // ── Week -2 (active — included in Mix donut) ────────────────────────────
        result.add(seed(clients, 1, now, 14, OrderStatus.CZEKA_NA_KLIENTA,
            OrderItemKind.NAPRAWA,     "Wymiana zamka — kozaki",                     5));

        // Row 9 — two items (CUSTOM + SZEWC) — W_REALIZACJI
        result.add(seedWithExtra(clients, 2, now, 12, OrderStatus.W_REALIZACJI,
            OrderItemKind.CUSTOM,      "Custom painting — Air Force 1",
            OrderItemKind.SZEWC,       "Naszycie patchy",                            7));

        // ── Week -1 to this week (active — included in Mix donut) ───────────────
        // Row 10 — pilne: PRZYJETE 10 days ago (>= 4 days threshold)
        result.add(seed(clients, 3, now, 10, OrderStatus.PRZYJETE,
            OrderItemKind.CZYSZCZENIE, "Pełne czyszczenie sneakersów",               6));

        result.add(seed(clients, 4, now,  8, OrderStatus.W_REALIZACJI,
            OrderItemKind.RENOWACJA,   "Renowacja kurtki bomber",                    5));

        // Row 12 — pilne: PRZYJETE 7 days ago
        result.add(seed(clients, 5, now,  7, OrderStatus.PRZYJETE,
            OrderItemKind.SZEWC,       "Przyklejenie zelówki + impregnacja",         4));

        // Row 13 — pilne: PRZYJETE 5 days ago + second item
        result.add(seedWithExtra(clients, 0, now,  5, OrderStatus.PRZYJETE,
            OrderItemKind.NAPRAWA,     "Naprawa zamka — bot zimowy",
            OrderItemKind.CZYSZCZENIE, "Czyszczenie wkładki",                        3));

        result.add(seed(clients, 1, now,  4, OrderStatus.W_REALIZACJI,
            OrderItemKind.CUSTOM,      "Custom design — sneakersy ślubne",           8));

        result.add(seed(clients, 2, now,  3, OrderStatus.WSTEPNIE_PRZYJETE,
            OrderItemKind.SZEWC,       "Konsultacja — wymiana podeszwy",             5));

        // Row 16 — PRZYJETE fresh (2 days ago — not pilne)
        result.add(seed(clients, 3, now,  2, OrderStatus.PRZYJETE,
            OrderItemKind.CZYSZCZENIE, "Czyszczenie skórzanej torby",               10));

        // Row 17 — PRZYJETE fresh (1 day ago — not pilne)
        result.add(seed(clients, 4, now,  1, OrderStatus.PRZYJETE,
            OrderItemKind.RENOWACJA,   "Renowacja kurtki ramoneski",               12));

        // Row 18 — PRZYJETE just received (today)
        result.add(seed(clients, 5, now,  0, OrderStatus.PRZYJETE,
            OrderItemKind.CUSTOM,      "Custom — kurtka jeansowa z napisami",       14));

        return result;
    }

    // ── Single-item seed ────────────────────────────────────────────────────────

    private Order seed(List<Client> clients, int clientIdx, Instant now, int daysAgo,
                       OrderStatus targetStatus, OrderItemKind kind,
                       String description, int daysUntilPickup) {
        return seedItems(clients, clientIdx, now, daysAgo, targetStatus,
            List.of(new CreateOrderItemRequest(kind, description, null, 0)),
            daysUntilPickup);
    }

    // ── Two-item seed ───────────────────────────────────────────────────────────

    private Order seedWithExtra(List<Client> clients, int clientIdx, Instant now, int daysAgo,
                                OrderStatus targetStatus,
                                OrderItemKind kind1, String desc1,
                                OrderItemKind kind2, String desc2,
                                int daysUntilPickup) {
        return seedItems(clients, clientIdx, now, daysAgo, targetStatus,
            List.of(
                new CreateOrderItemRequest(kind1, desc1, null, 0),
                new CreateOrderItemRequest(kind2, desc2, null, 0)
            ),
            daysUntilPickup);
    }

    // ── Core seeding logic ──────────────────────────────────────────────────────

    private Order seedItems(List<Client> clients, int clientIdx, Instant now, int daysAgo,
                            OrderStatus targetStatus, List<CreateOrderItemRequest> items,
                            int daysUntilPickup) {
        var client = clients.get(clientIdx % clients.size());
        var receivedAt = now.minus(daysAgo, ChronoUnit.DAYS);
        Instant plannedPickup = daysUntilPickup > 0
            ? now.plus(daysUntilPickup, ChronoUnit.DAYS)
            : null;

        var primaryDesc = items.get(0).description();
        var req = new CreateOrderRequest(
            client.getId(), primaryDesc, receivedAt, plannedPickup, null, null, items,
            null, null
        );
        var dto = orderService.create(req);

        if (targetStatus != OrderStatus.PRZYJETE) {
            advanceTo(dto.id(), dto.version(), targetStatus);
        }

        var saved = orderRepository.findById(dto.id()).orElseThrow();
        log.info("op=demo.seed.order orderId={} status={} clientId={} items={}",
            saved.getId(), saved.getStatus(), client.getId(), items.size());
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
