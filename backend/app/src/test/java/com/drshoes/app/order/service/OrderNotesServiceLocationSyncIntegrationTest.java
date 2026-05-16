package com.drshoes.app.order.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.storage.domain.StorageLocation;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test: OrderNotesService.addNote syncs both the location string
 * AND currentStorageLocationId (Long → stored in the UUID column when available).
 *
 * NOTE: storage_location.id is BIGSERIAL (Long); order_.current_storage_location_id
 * is a legacy UUID column (FK dropped in V018). The two types are incompatible, so
 * only the location string sync is verified here. See dispatch log b1-* for details.
 */
class OrderNotesServiceLocationSyncIntegrationTest extends AbstractIntegrationTest {

    @Autowired OrderNotesService service;
    @Autowired OrderRepository orders;
    @Autowired StorageLocationRepository locations;
    @Autowired JdbcTemplate jdbc;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        clientId = UUID.randomUUID();
        jdbc.update("INSERT INTO client (id, first_name, phone) VALUES (?::uuid, ?, ?)",
                clientId.toString(), "Klient", "+48600000001");
    }

    @AfterEach
    void cleanup() {
        orders.deleteAll();
        locations.deleteAll();
        jdbc.update("DELETE FROM client WHERE id = ?::uuid", clientId.toString());
    }

    @Test
    void addNote_withNewLocation_setsLocationString() {
        // Seed a location
        StorageLocation loc = new StorageLocation();
        loc.setName("szafa-A");
        loc.setActive(true);
        locations.save(loc);

        // Seed an order
        Order o = new Order();
        o.setCode("TST-SYNC-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        o.setClientId(clientId);
        o.setStatus(OrderStatus.PRZYJETE);
        o.setLocation(null);
        UUID orderId = orders.save(o).getId();

        service.addNote(orderId, null, "szafa-A");

        Order reread = orders.findById(orderId).orElseThrow();
        assertThat(reread.getLocation())
                .as("location string must be updated to the new location name")
                .isEqualTo("szafa-A");
    }

    @Test
    void addNote_noteOnly_doesNotChangeLocation() {
        Order o = new Order();
        o.setCode("TST-SYNC-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        o.setClientId(clientId);
        o.setStatus(OrderStatus.PRZYJETE);
        o.setLocation("szafa-B");
        UUID orderId = orders.save(o).getId();

        service.addNote(orderId, "only a note", null);

        Order reread = orders.findById(orderId).orElseThrow();
        assertThat(reread.getLocation())
                .as("note-only addNote must not mutate location")
                .isEqualTo("szafa-B");
    }
}
