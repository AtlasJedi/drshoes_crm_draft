package com.drshoes.app.order;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the OrderSpecifications.forList SQL generation against a real
 * Testcontainers Postgres instance.
 *
 * Covers the default-mode OR-branch:
 *   (status IN (active)) OR (status='WYDANE' AND picked_up_at >= cutoff)
 *
 * Independent of the controller stack — catches regressions where someone
 * "simplifies" the predicate into something subtly wrong.
 *
 * Naming: *IntegrationTest.java is the convention that runs in Surefire
 * (see memory: feedback_subagent_output_token_budget / *IT.java was never
 * wired into Failsafe).
 */
class OrderRepositoryListIntegrationTest extends AbstractIntegrationTest {

    @Autowired private OrderRepository orders;
    @Autowired private ClientRepository clients;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        Client c = new Client();
        c.setFirstName("Test");
        c.setPhone("+48 600 000 001");
        clientId = clients.save(c).getId();
    }

    private UUID createOrder(OrderStatus status, Instant pickedUpAt) {
        Order o = new Order();
        o.setCode("T-" + System.nanoTime());
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        o.setPickedUpAt(pickedUpAt);
        return orders.saveAndFlush(o).getId();
    }

    @Test
    void defaultPolicy_returnsActiveAndRecentWydane_excludesOldWydaneAndAnulowane() {
        UUID active = createOrder(OrderStatus.PRZYJETE, null);
        UUID wydaneRecent = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(5, ChronoUnit.DAYS));
        UUID wydaneOld = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(60, ChronoUnit.DAYS));
        UUID anul = createOrder(OrderStatus.ANULOWANE, null);

        OrderListPolicy.EffectiveFilter effective = OrderListPolicy.resolve(null);

        Page<Order> page = orders.findAll(
            OrderSpecifications.forList(
                effective.statuses(), null, null, null, null, null, null, null, null,
                effective.wydaneCutoff()),
            PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt")));

        assertThat(page.getContent()).extracting(Order::getId)
            .contains(active, wydaneRecent)
            .doesNotContain(wydaneOld, anul);
    }

    @Test
    void explicitWydaneEscapeHatch_returnsAllWydaneIgnoringAge() {
        UUID wydaneRecent = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(5, ChronoUnit.DAYS));
        UUID wydaneOld = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(180, ChronoUnit.DAYS));
        UUID anul = createOrder(OrderStatus.ANULOWANE, null);

        OrderListPolicy.EffectiveFilter effective = OrderListPolicy.resolve(
            java.util.List.of(OrderStatus.WYDANE));

        Page<Order> page = orders.findAll(
            OrderSpecifications.forList(
                effective.statuses(), null, null, null, null, null, null, null, null,
                effective.wydaneCutoff()),
            PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt")));

        assertThat(page.getContent()).extracting(Order::getId)
            .contains(wydaneRecent, wydaneOld)
            .doesNotContain(anul);
    }

    @Test
    void explicitActiveStatusPick_doesNotImplicitlyAddWydane() {
        UUID active = createOrder(OrderStatus.PRZYJETE, null);
        UUID wydaneRecent = createOrder(OrderStatus.WYDANE,
            Instant.now().minus(5, ChronoUnit.DAYS));

        OrderListPolicy.EffectiveFilter effective = OrderListPolicy.resolve(
            java.util.List.of(OrderStatus.PRZYJETE));

        Page<Order> page = orders.findAll(
            OrderSpecifications.forList(
                effective.statuses(), null, null, null, null, null, null, null, null,
                effective.wydaneCutoff()),
            PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt")));

        assertThat(page.getContent()).extracting(Order::getId)
            .contains(active)
            .doesNotContain(wydaneRecent);
    }
}
