package com.drshoes.app.order.domain;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for OrderRepository and OrderItemRepository.
 *
 * Covers:
 *   1. Persist Order with required fields → id, code, version=0, createdAt populated, status round-trips.
 *   2. findByCode returns the correct order.
 *   3. Persist Order + 2 OrderItems → findAllByOrderIdOrderByPosition returns them in order.
 *   4. findAllByDeletedAtIsNull(Pageable) excludes a soft-deleted row.
 */
class OrderRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired private OrderRepository orderRepository;
    @Autowired private OrderItemRepository orderItemRepository;
    @Autowired private ClientRepository clientRepository;

    private UUID existingClientId;

    @BeforeEach
    void createClient() {
        // order_.client_id has a FK to client, so we need a real client row.
        Client c = new Client();
        c.setFirstName("Test");
        c.setPhone("+48600000" + System.nanoTime() % 1000);
        existingClientId = clientRepository.save(c).getId();
    }

    @AfterEach
    void cleanup() {
        // Delete orders (and items) before the client to satisfy FK order__client_id_fkey.
        // This prevents bleeding into AdminWebTestBase.seedUsers() which calls clients.deleteAll().
        orderItemRepository.deleteAll();
        orderRepository.deleteAll();
        if (existingClientId != null) {
            clientRepository.deleteById(existingClientId);
        }
    }

    // ---- helpers ----

    private Order buildOrder(String code) {
        Order o = new Order();
        o.setCode(code);
        o.setClientId(existingClientId);
        o.setStatus(OrderStatus.PRZYJETE);
        return o;
    }

    private OrderItem buildItem(UUID orderId, int position, OrderItemKind kind) {
        OrderItem item = new OrderItem();
        item.setOrderId(orderId);
        item.setPosition(position);
        item.setKind(kind);
        item.setDescription("item " + position);
        return item;
    }

    // ---- 1. basic persist ----

    @Test
    void persistOrder_requiredFieldsPopulated() {
        Order saved = orderRepository.save(buildOrder("ORD-T-001-" + unique()));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCode()).startsWith("ORD-T-001-");
        assertThat(saved.getVersion()).isEqualTo(0);
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.PRZYJETE);
    }

    // ---- 2. findByCode ----

    @Test
    void findByCode_returnsOrder() {
        String code = "ORD-T-002-" + unique();
        orderRepository.save(buildOrder(code));

        Optional<Order> found = orderRepository.findByCode(code);
        assertThat(found).isPresent();
        assertThat(found.get().getStatus()).isEqualTo(OrderStatus.PRZYJETE);
    }

    // ---- 3. order items persisted and returned in position order ----

    @Test
    void orderItems_returnedInPositionOrder() {
        Order order = orderRepository.save(buildOrder("ORD-T-003-" + unique()));
        UUID orderId = order.getId();

        // Save in reverse position order to prove sorting is by position, not insert order
        orderItemRepository.save(buildItem(orderId, 1, OrderItemKind.CUSTOM));
        orderItemRepository.save(buildItem(orderId, 0, OrderItemKind.NAPRAWA));

        List<OrderItem> items = orderItemRepository.findAllByOrderIdOrderByPosition(orderId);

        assertThat(items).hasSize(2);
        assertThat(items.get(0).getPosition()).isEqualTo(0);
        assertThat(items.get(0).getKind()).isEqualTo(OrderItemKind.NAPRAWA);
        assertThat(items.get(1).getPosition()).isEqualTo(1);
        assertThat(items.get(1).getKind()).isEqualTo(OrderItemKind.CUSTOM);
    }

    // ---- 4. soft-delete exclusion ----

    @Test
    void findAllByDeletedAtIsNull_excludesSoftDeleted() {
        String activeCode  = "ORD-T-004A-" + unique();
        String deletedCode = "ORD-T-004D-" + unique();

        orderRepository.save(buildOrder(activeCode));

        Order deleted = buildOrder(deletedCode);
        deleted.setDeletedAt(Instant.now());
        orderRepository.save(deleted);

        Page<Order> page = orderRepository.findAllByDeletedAtIsNull(
                PageRequest.of(0, 100, Sort.by("createdAt")));

        List<String> codes = page.getContent().stream().map(Order::getCode).toList();
        assertThat(codes).contains(activeCode);
        assertThat(codes).doesNotContain(deletedCode);
    }

    // ---- utility ----

    private static String unique() {
        return String.valueOf(System.nanoTime()).substring(8);
    }
}
