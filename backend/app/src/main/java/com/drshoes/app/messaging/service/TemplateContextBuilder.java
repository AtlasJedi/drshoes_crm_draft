package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * Builds a {@link TemplateContext} from order + client data.
 * Extracted from MessageRouter to keep each class under 120 LOC.
 */
@Component
public class TemplateContextBuilder {

    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final ClientRepository clients;

    public TemplateContextBuilder(OrderRepository orders,
                                  OrderItemRepository orderItems,
                                  ClientRepository clients) {
        this.orders = orders;
        this.orderItems = orderItems;
        this.clients = clients;
    }

    /**
     * Loads order + client rows and assembles a template context for rendering.
     *
     * @param orderId  the order UUID
     * @param clientId the client UUID
     * @return fully populated {@link TemplateContext}
     * @throws IllegalArgumentException if order or client row is missing
     */
    public TemplateContext buildContext(UUID orderId, UUID clientId) {
        Order order = orders.findById(orderId).orElseThrow(
                () -> new IllegalArgumentException("Order not found: " + orderId));
        Client client = clients.findById(clientId).orElseThrow(
                () -> new IllegalArgumentException("Client not found: " + clientId));

        List<String> typyPracy = orderItems.findAllByOrderIdOrderByPosition(orderId).stream()
                .map(item -> polishKindLabel(item.getKind()))
                .toList();

        OffsetDateTime dataOdbioru = order.getPlannedPickupAt() == null
                ? null
                : order.getPlannedPickupAt().atOffset(ZoneOffset.UTC);

        return new TemplateContext(
                client.getFirstName(),
                order.getCode(),
                typyPracy,
                dataOdbioru,
                "Dr Shoes"
        );
    }

    private static String polishKindLabel(OrderItemKind kind) {
        return switch (kind) {
            case NAPRAWA       -> "naprawa";
            case CUSTOM_BUTY   -> "custom buty";
            case CUSTOM_KURTKA -> "custom kurtka";
        };
    }
}
