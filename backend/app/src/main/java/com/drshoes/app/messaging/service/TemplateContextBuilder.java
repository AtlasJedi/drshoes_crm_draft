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
import lombok.RequiredArgsConstructor;
@Component
@RequiredArgsConstructor
public class TemplateContextBuilder {

    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final ClientRepository clients;
    private final WorkshopProperties workshop;
    public TemplateContext buildContext(UUID orderId, UUID clientId) {
        return buildContext(orderId, clientId, null);
    }
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
