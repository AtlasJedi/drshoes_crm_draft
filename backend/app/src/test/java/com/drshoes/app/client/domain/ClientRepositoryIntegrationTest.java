package com.drshoes.app.client.domain;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ClientRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired ClientRepository repo;

    @Test
    void persistAndFindById() {
        Client c = new Client();
        c.setFirstName("Anna"); c.setLastName("Kowalska");
        c.setPhone("+48 600 100 200"); c.setEmail("anna@example.com");
        repo.save(c);
        assertThat(repo.findById(c.getId())).isPresent();
    }

    @Test
    void softDeletedExcludedFromActiveList() {
        Client active = newClient("Jan", "Nowak");
        Client gone   = newClient("Stara", "Klientka");
        gone.setDeletedAt(Instant.now());
        repo.saveAll(java.util.List.of(active, gone));
        var page = repo.findAllByDeletedAtIsNull(PageRequest.of(0, 10));
        assertThat(page.getContent()).extracting(Client::getId)
            .contains(active.getId())
            .doesNotContain(gone.getId());
    }

    @Test
    void searchByLastNamePartial() {
        repo.save(newClient("Anna", "Kowalska"));
        repo.save(newClient("Adam", "Wiśniewski"));
        var hits = repo.searchTopN("kowal", PageRequest.of(0, 20));
        assertThat(hits).extracting(Client::getLastName).containsExactly("Kowalska");
    }

    private Client newClient(String f, String l) {
        Client c = new Client();
        c.setFirstName(f);
        c.setLastName(l);
        c.setPhone("+48 000 000 000"); // satisfies client_contact_present constraint
        return c;
    }
}
