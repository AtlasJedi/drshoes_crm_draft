package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.config.WorkshopProperties;
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
 *
 * v2-E: added 3-arg overload that injects wiadomosc_tresc for the followup
 * email template. Also supports null orderId for client-only context (no order
 * data loaded when the compose action is not associated with a specific order).
 */
@Component
public class TemplateContextBuilder {

    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final ClientRepository clients;
    private final WorkshopProperties workshop;

    public TemplateContextBuilder(OrderRepository orders,
                                  OrderItemRepository orderItems,
                                  ClientRepository clients,
                                  WorkshopProperties workshop) {
        this.orders = orders;
        this.orderItems = orderItems;
        this.clients = clients;
        this.workshop = workshop;
    }

    /**
     * Loads order + client rows and assembles a template context for rendering.
     *
     * @param orderId  the order UUID (must not be null)
     * @param clientId the client UUID
     * @return fully populated {@link TemplateContext}
     * @throws IllegalArgumentException if order or client row is missing
     */
    public TemplateContext buildContext(UUID orderId, UUID clientId) {
        return buildContext(orderId, clientId, null);
    }

    /**
     * Overload that additionally injects {@code wiadomosc_tresc} into the context.
     * Used by {@link MessageRouter} when wrapping a free-form operator message
     * inside the followup HTML template (v2-E). When {@code orderId} is null,
     * order-specific placeholders are omitted (only client + workshop data is loaded).
     *
     * @param orderId     the order UUID, or null for client-only context
     * @param clientId    the client UUID
     * @param userMessage the operator's typed message body; injected as wiadomosc_tresc
     * @return fully populated {@link TemplateContext} with wiadomosc_tresc set
     */
    public TemplateContext buildContext(UUID orderId, UUID clientId, String userMessage) {
        Client client = clients.findById(clientId).orElseThrow(
                () -> new IllegalArgumentException("Client not found: " + clientId));

        String numerZlecenia = null;
        List<String> typyPracy = List.of();
        OffsetDateTime dataOdbioru = null;

        if (orderId != null) {
            Order order = orders.findById(orderId).orElseThrow(
                    () -> new IllegalArgumentException("Order not found: " + orderId));
            numerZlecenia = order.getCode();
            typyPracy = orderItems.findAllByOrderIdOrderByPosition(orderId).stream()
                    .map(item -> polishKindLabel(item.getKind()))
                    .toList();
            dataOdbioru = order.getPlannedPickupAt() == null
                    ? null
                    : order.getPlannedPickupAt().atOffset(ZoneOffset.UTC);
        }

        return new TemplateContext(
                client.getFirstName(),
                numerZlecenia,
                typyPracy,
                dataOdbioru,
                workshop.getName(),
                workshop.getAddress(),
                workshop.getOpeningHours(),
                workshop.getUrl(),
                userMessage,
                workshop.getPhone(),
                workshop.getMapsUrl()
        );
    }

    private static String polishKindLabel(OrderItemKind kind) {
        return switch (kind) {
            case CZYSZCZENIE -> "czyszczenie";
            case RENOWACJA   -> "renowacja";
            case NAPRAWA     -> "naprawa";
            case SZEWC       -> "szewc";
            case CUSTOM      -> "custom";
        };
    }
}
