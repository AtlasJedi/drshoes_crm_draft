package com.drshoes.app.order.domain;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests verifying the location field on the order_ table (V019).
 */
class OrderLocationFieldIntegrationTest extends AbstractIntegrationTest {

    @Autowired OrderRepository orderRepo;
    @Autowired ClientRepository clientRepository;

    private java.util.UUID clientId;

    @BeforeEach
    void seedClient() {
        Client c = new Client();
        c.setFirstName("Test");
        c.setPhone("+48600000" + System.nanoTime() % 1000);
        clientId = clientRepository.save(c).getId();
    }

    @AfterEach
    void cleanup() {
        orderRepo.deleteAll();
        clientRepository.deleteById(clientId);
    }

    @Test
    void order_location_field_persists_and_reads_back() {
        Order o = newMinimalOrder();
        o.setLocation("półka 1");
        orderRepo.save(o);

        Order reread = orderRepo.findById(o.getId()).orElseThrow();
        assertThat(reread.getLocation()).isEqualTo("półka 1");
    }

    @Test
    void order_location_field_nullable() {
        Order o = newMinimalOrder();
        o.setLocation(null);
        orderRepo.save(o);

        Order reread = orderRepo.findById(o.getId()).orElseThrow();
        assertThat(reread.getLocation()).isNull();
    }

    private Order newMinimalOrder() {
        Order o = new Order();
        o.setCode("LOC-T-" + System.nanoTime() % 100000);
        o.setClientId(clientId);
        o.setStatus(OrderStatus.PRZYJETE);
        return o;
    }
}
