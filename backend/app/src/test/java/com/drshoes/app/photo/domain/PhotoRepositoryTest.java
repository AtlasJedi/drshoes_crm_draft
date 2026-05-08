package com.drshoes.app.photo.domain;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.auth.domain.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@org.junit.jupiter.api.Disabled("Photo entity arrives in task 3-5; this test enables there")
class PhotoRepositoryTest extends AbstractIntegrationTest {

    @Autowired PhotoRepository photos;
    @Autowired OrderRepository orders;
    @Autowired ClientRepository clients;
    @Autowired UserRepository users;

    @Test
    void findByOrderIdOrderByUploadedAtDesc_returnsNewestFirst() {
        var user = users.findAll().iterator().next();           // seeded admin user
        var client = clients.save(newClient());
        var order  = orders.save(newOrder(client.getId()));

        var p1 = save(photos, order.getId(), user.getId(), PhotoLabel.BEFORE, Instant.parse("2026-05-09T10:00:00Z"));
        var p2 = save(photos, order.getId(), user.getId(), PhotoLabel.AFTER,  Instant.parse("2026-05-09T11:00:00Z"));
        var p3 = save(photos, order.getId(), user.getId(), PhotoLabel.OTHER,  Instant.parse("2026-05-09T12:00:00Z"));

        List<Photo> found = photos.findByOrderIdOrderByUploadedAtDesc(order.getId());

        assertThat(found).extracting(Photo::getId).containsExactly(p3.getId(), p2.getId(), p1.getId());
    }

    private Photo save(PhotoRepository repo, java.util.UUID orderId, java.util.UUID actor,
                       PhotoLabel label, Instant when) {
        var p = new Photo();
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
        return o;
    }
}
