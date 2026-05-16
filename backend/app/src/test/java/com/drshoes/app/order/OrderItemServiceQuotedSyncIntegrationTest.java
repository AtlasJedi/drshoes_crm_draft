package com.drshoes.app.order;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.dto.CreateOrderItemRequest;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.Order;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that OrderItemService.recomputeTotal keeps quotedPriceCents in sync
 * with the item sum (Feature 3 of M11 fix batch).
 */
class OrderItemServiceQuotedSyncIntegrationTest extends AbstractIntegrationTest {

    @Autowired OrderItemService itemService;
    @Autowired OrderRepository orders;
    @Autowired OrderItemRepository itemRepo;
    @Autowired ClientRepository clientRepo;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        Client c = new Client();
        c.setFirstName("Sync");
        c.setPhone("+48600000002");
        clientId = clientRepo.save(c).getId();
    }

    @AfterEach
    void cleanup() {
        itemRepo.deleteAll();
        orders.deleteAll();
        clientRepo.deleteById(clientId);
    }

    private UUID createOrderWithNoItems() {
        Order o = new Order();
        o.setCode("IT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        o.setClientId(clientId);
        o.setStatus(OrderStatus.PRZYJETE);
        return orders.save(o).getId();
    }

    @Test
    void addItem_setsQuotedPriceCentsToItemsSum() {
        UUID orderId = createOrderWithNoItems();
        itemService.addItem(orderId, new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "buty", null, 50000));
        itemService.addItem(orderId, new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "kurtka", null, 40000));

        var order = orders.findById(orderId).orElseThrow();
        assertThat(order.getTotalPriceCents()).isEqualTo(90000);
        assertThat(order.getQuotedPriceCents())
                .as("quotedPriceCents must equal totalPriceCents after addItem")
                .isEqualTo(90000);
    }

    @Test
    void removeItem_recomputesQuotedPriceCents() {
        UUID orderId = createOrderWithNoItems();
        var itemA = itemService.addItem(orderId, new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "a", null, 50000));
        itemService.addItem(orderId, new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "b", null, 40000));
        itemService.removeItem(orderId, itemA.id());

        var order = orders.findById(orderId).orElseThrow();
        assertThat(order.getQuotedPriceCents())
                .as("quotedPriceCents must recompute to remaining item sum after removeItem")
                .isEqualTo(40000);
    }
}
