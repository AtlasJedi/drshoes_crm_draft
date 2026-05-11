package com.drshoes.app.demo;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test: verifies DemoSeedRunner populates min rows and is idempotent.
 *
 * @ActiveProfiles must include "local" to activate @Profile("local") demo beans.
 * @TestPropertySource enables the @ConditionalOnProperty guard.
 * Testcontainers Postgres wired via AbstractIntegrationTest.
 */
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = "drshoes.demo.seed.enabled=true")
class DemoSeedDataIntegrationTest extends AbstractIntegrationTest {

    @Autowired private ClientRepository clients;
    @Autowired private OrderRepository orders;
    @Autowired private DemoSeedRunner runner;

    @Test
    void seedCreatesMinimumClients() {
        assertThat(clients.count()).isGreaterThanOrEqualTo(6);
    }

    @Test
    void seedCreatesMinimumOrders() {
        assertThat(orders.count()).isGreaterThanOrEqualTo(12);
    }

    @Test
    void ordersSpanAtLeastFourStatuses() {
        var statuses = orders.findAll().stream()
            .map(o -> o.getStatus())
            .collect(Collectors.toSet());
        assertThat(statuses.size()).isGreaterThanOrEqualTo(4);
    }

    @Test
    void seedIsIdempotent() {
        long beforeClients = clients.count();
        long beforeOrders  = orders.count();
        runner.run();
        assertThat(clients.count()).isEqualTo(beforeClients);
        assertThat(orders.count()).isEqualTo(beforeOrders);
    }
}
