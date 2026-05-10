package com.drshoes.app;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression test for AdminWebTestBase FK ordering fix (task 6-1).
 *
 * Proves that seedUsers() / cleanupUsers() survive when orders + threads
 * referencing the base-class clients exist at teardown time.
 *
 * Before the fix this test throws DataIntegrityViolationException in @BeforeEach
 * of the second iteration (JUnit reruns are simulated by the two @Test methods
 * both seeding and relying on a clean base re-seed between them).
 */
class AdminWebTestBaseFkOrderingIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepository;
    @Autowired private ClientRepository clientRepository;
    @Autowired private MessageThreadRepository threadRepository;

    private UUID extraClientId;
    private UUID extraOrderId;
    private UUID extraThreadId;

    @BeforeEach
    void seedOrderAndThread() {
        // Seed a client + order + thread on top of the base-class users.
        var client = new Client();
        client.setFirstName("FK");
        client.setLastName("OrderingTest");
        client.setPhone("+48 600 000 099");
        extraClientId = clientRepository.save(client).getId();

        var order = new Order();
        order.setCode("FK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setClientId(extraClientId);
        order.setStatus(OrderStatus.PRZYJETE);
        extraOrderId = orderRepository.save(order).getId();

        var thread = new MessageThreadEntity();
        thread.setClientId(extraClientId);
        thread.setChannel("EMAIL");
        thread.setUnreadCount(0);
        extraThreadId = threadRepository.save(thread).getId();
    }

    @AfterEach
    void cleanupOrderAndThread() {
        // Do NOT delete order or thread here — intentionally leave them
        // so that AdminWebTestBase.cleanupUsers() must handle them.
        // Before the fix, the second test's @BeforeEach seedUsers() would
        // throw DataIntegrityViolationException trying clients.deleteAll().
    }

    @Test
    void firstTestLeavesOrderAndThreadForBaseCleanup() {
        assertThat(orderRepository.findById(extraOrderId)).isPresent();
        assertThat(threadRepository.findById(extraThreadId)).isPresent();
    }

    @Test
    void secondTestAlsoRunsWithoutFkViolation() {
        // If AdminWebTestBase.seedUsers() FK-ordering fix is not in place,
        // this test never reaches this line — the @BeforeEach seedUsers() of
        // the base class will have thrown DataIntegrityViolationException.
        assertThat(clientRepository.findById(extraClientId)).isPresent();
    }
}
