package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItem;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemplateContextBuilderTest {

    @Mock OrderRepository orders;
    @Mock OrderItemRepository orderItems;
    @Mock ClientRepository clients;

    private TemplateContextBuilder builder;

    @BeforeEach
    void setUp() {
        builder = new TemplateContextBuilder(orders, orderItems, clients);
    }

    @Test
    @DisplayName("buildContext maps NAPRAWA kind to 'naprawa' label")
    void buildContext_naprawaKind_mapsToLabel() {
        UUID orderId  = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();

        stubOrder(orderId, "ZL-001", null);
        stubClient(clientId, "Tomasz");
        stubItems(orderId, OrderItemKind.NAPRAWA);

        TemplateContext ctx = builder.buildContext(orderId, clientId);

        assertThat(ctx.typyPracy()).containsExactly("naprawa");
        assertThat(ctx.imieKlienta()).isEqualTo("Tomasz");
        assertThat(ctx.numerZlecenia()).isEqualTo("ZL-001");
        assertThat(ctx.nazwaWarsztatu()).isEqualTo("Dr Shoes");
        assertThat(ctx.dataOdbioru()).isNull();
    }

    @Test
    @DisplayName("buildContext maps CUSTOM_BUTY kind to 'custom buty' label")
    void buildContext_customButyKind_mapsToLabel() {
        UUID orderId  = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();

        stubOrder(orderId, "ZL-002", null);
        stubClient(clientId, "Ewa");
        stubItems(orderId, OrderItemKind.CUSTOM_BUTY);

        TemplateContext ctx = builder.buildContext(orderId, clientId);

        assertThat(ctx.typyPracy()).containsExactly("custom buty");
    }

    @Test
    @DisplayName("buildContext maps CUSTOM_KURTKA kind to 'custom kurtka' label")
    void buildContext_customKurtkaKind_mapsToLabel() {
        UUID orderId  = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();

        stubOrder(orderId, "ZL-003", null);
        stubClient(clientId, "Marek");
        stubItems(orderId, OrderItemKind.CUSTOM_KURTKA);

        TemplateContext ctx = builder.buildContext(orderId, clientId);

        assertThat(ctx.typyPracy()).containsExactly("custom kurtka");
    }

    @Test
    @DisplayName("buildContext populates dataOdbioru when plannedPickupAt is set")
    void buildContext_withPlannedPickupAt_populatesDataOdbioru() {
        UUID orderId  = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();

        Instant pickup = Instant.parse("2026-06-15T10:00:00Z");
        stubOrder(orderId, "ZL-004", pickup);
        stubClient(clientId, "Kasia");
        stubItems(orderId);

        TemplateContext ctx = builder.buildContext(orderId, clientId);

        assertThat(ctx.dataOdbioru()).isNotNull();
        assertThat(ctx.dataOdbioru()).isEqualTo(pickup.atOffset(ZoneOffset.UTC));
    }

    @Test
    @DisplayName("buildContext throws when order not found")
    void buildContext_orderNotFound_throws() {
        UUID orderId  = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();

        when(orders.findById(orderId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> builder.buildContext(orderId, clientId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Order not found");
    }

    @Test
    @DisplayName("buildContext throws when client not found")
    void buildContext_clientNotFound_throws() {
        UUID orderId  = UUID.randomUUID();
        UUID clientId = UUID.randomUUID();

        stubOrder(orderId, "ZL-005", null);
        when(clients.findById(clientId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> builder.buildContext(orderId, clientId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Client not found");
    }

    // ---- helpers ----

    private void stubOrder(UUID orderId, String code, Instant plannedPickupAt) {
        Order order = new Order();
        order.setId(orderId);
        order.setCode(code);
        order.setPlannedPickupAt(plannedPickupAt);
        when(orders.findById(orderId)).thenReturn(Optional.of(order));
    }

    private void stubClient(UUID clientId, String firstName) {
        Client client = new Client();
        client.setId(clientId);
        client.setFirstName(firstName);
        when(clients.findById(clientId)).thenReturn(Optional.of(client));
    }

    private void stubItems(UUID orderId, OrderItemKind... kinds) {
        List<OrderItem> items = Arrays.stream(kinds).map(k -> {
            OrderItem item = new OrderItem();
            item.setKind(k);
            return item;
        }).toList();
        when(orderItems.findAllByOrderIdOrderByPosition(orderId)).thenReturn(items);
    }
}
