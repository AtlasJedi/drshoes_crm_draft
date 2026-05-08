package com.drshoes.app.photo.domain;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PhotoRepositoryTest extends AbstractIntegrationTest {

    @Autowired PhotoRepository photos;
    @Autowired OrderRepository orders;
    @Autowired ClientRepository clients;
    @Autowired UserRepository users;

    private UUID testUserId;

    @BeforeEach
    void createUser() {
        // Create a dedicated test user so this test is robust regardless of
        // whether AdminWebTestBase-derived tests ran before (they call users.deleteAll()).
        var u = new User();
        u.setEmail("photo-test-" + UUID.randomUUID() + "@test.pl");
        u.setPasswordHash("{noop}test");
        u.setFullName("Photo Tester");
        u.setRole(UserRole.EMPLOYEE);
        testUserId = users.save(u).getId();
    }

    @AfterEach
    void cleanup() {
        photos.deleteAll();
        orders.deleteAll();
        clients.deleteAll();
        users.deleteById(testUserId);
    }

    @Test
    void findByOrderIdOrderByUploadedAtDesc_returnsNewestFirst() {
        var client = clients.save(newClient());
        var order  = orders.save(newOrder(client.getId()));

        var p1 = save(photos, order.getId(), testUserId, PhotoLabel.BEFORE, Instant.parse("2026-05-09T10:00:00Z"));
        var p2 = save(photos, order.getId(), testUserId, PhotoLabel.AFTER,  Instant.parse("2026-05-09T11:00:00Z"));
        var p3 = save(photos, order.getId(), testUserId, PhotoLabel.OTHER,  Instant.parse("2026-05-09T12:00:00Z"));

        List<Photo> found = photos.findByOrderIdOrderByUploadedAtDesc(order.getId());

        assertThat(found).extracting(Photo::getId).containsExactly(p3.getId(), p2.getId(), p1.getId());
    }

    private Photo save(PhotoRepository repo, java.util.UUID orderId, java.util.UUID actor,
                       PhotoLabel label, Instant when) {
        var p = new Photo();
        p.setId(java.util.UUID.randomUUID());   // required: Photo.Persistable needs manual id
        p.setOrderId(orderId);
        p.setUploadedBy(actor);
        p.setUploadedAt(when);
        p.setS3Key("orders/" + orderId + "/" + java.util.UUID.randomUUID() + "-test.jpg");
        p.setMime("image/jpeg");
        p.setSizeBytes(1234L);
        p.setLabel(label);
        p.setOriginalFilename("test.jpg");
        return repo.save(p);
    }

    private Client newClient() {
        var c = new Client();
        c.setFirstName("Klient");
        c.setLastName("Testowy");
        c.setPhone("+48 600 100 200");
        return c;
    }

    private Order newOrder(java.util.UUID clientId) {
        var o = new Order();
        o.setClientId(clientId);
        o.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        o.setCode("PHOTO-TEST-" + java.util.UUID.randomUUID().toString().substring(0, 8));
        return o;
    }
}
