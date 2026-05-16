package com.drshoes.app.client;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.client.dto.CreateClientRequest;
import com.drshoes.app.client.dto.UpdateClientRequest;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ClientServiceTest {

    private final ClientRepository repo = mock(ClientRepository.class);
    private final ClientService svc = new ClientService(repo);

    @Test
    void createPersistsAndReturnsDto() {
        when(repo.save(any(Client.class))).thenAnswer(inv -> {
            Client c = inv.getArgument(0); c.setId(UUID.randomUUID()); return c;
        });
        var dto = svc.create(new CreateClientRequest("Jan", "Nowak", "+48", "j@n.pl", "vip", null));
        assertThat(dto.firstName()).isEqualTo("Jan");
        assertThat(dto.id()).isNotNull();
        verify(repo).save(any(Client.class));
    }

    @Test
    void createWithDefaultRodoStampsConsentAt() {
        when(repo.save(any(Client.class))).thenAnswer(inv -> {
            Client c = inv.getArgument(0); c.setId(UUID.randomUUID()); return c;
        });
        // null rodoConsent → compact ctor defaults to TRUE → rodoConsentAt stamped
        var req = new CreateClientRequest("Ewa", null, "+48600000002", null, null, null);
        svc.create(req);
        verify(repo).save(argThat((Client c) -> c.getRodoConsentAt() != null));
    }

    @Test
    void createWithRodoFalseLeavesConsentAtNull() {
        when(repo.save(any(Client.class))).thenAnswer(inv -> {
            Client c = inv.getArgument(0); c.setId(UUID.randomUUID()); return c;
        });
        var req = new CreateClientRequest("Ewa", null, "+48600000003", null, null, Boolean.FALSE);
        svc.create(req);
        verify(repo).save(argThat((Client c) -> c.getRodoConsentAt() == null));
    }

    @Test
    void searchTrimsQueryAndDelegates() {
        when(repo.searchTopN(eq("kowal"), any())).thenReturn(List.of(client("Anna", "Kowalska")));
        var results = svc.search("  kowal  ");
        assertThat(results).hasSize(1);
        assertThat(results.get(0).fullName()).isEqualTo("Anna Kowalska");
        verify(repo).searchTopN(eq("kowal"), any());
    }

    @Test
    void softDeleteSetsDeletedAtAndSaves() {
        Client c = client("Stara", "Klientka"); c.setId(UUID.randomUUID());
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));
        svc.softDelete(c.getId());
        assertThat(c.getDeletedAt()).isNotNull();
        verify(repo).save(c);
    }

    @Test
    void softDeleteUnknownIdThrows() {
        UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.softDelete(id))
            .isInstanceOf(ClientNotFoundException.class);
    }

    @Test
    void createWithNeitherPhoneNorEmailThrows() {
        assertThatThrownBy(() -> svc.create(
                new CreateClientRequest("Jan", "Brak", null, null, null, null)))
            .isInstanceOf(ClientContactMissingException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void updateSetsPreferredChannel() {
        Client c = clientWithPhone();
        c.setId(UUID.randomUUID());
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));
        when(repo.save(any(Client.class))).thenAnswer(inv -> inv.getArgument(0));

        var dto = svc.update(c.getId(),
            new UpdateClientRequest(null, null, null, null, "SMS", null, null));

        assertThat(dto.preferredChannel()).isEqualTo("SMS");
        assertThat(c.getPreferredChannel()).isEqualTo("SMS");
    }

    @Test
    void updateRejectsInvalidChannel() {
        Client c = clientWithPhone();
        c.setId(UUID.randomUUID());
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> svc.update(c.getId(),
                new UpdateClientRequest(null, null, null, null, "CARRIER_PIGEON", null, null)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid preferredChannel");
        verify(repo, never()).save(any());
    }

    @Test
    void updateGrantsRodoConsent() {
        Client c = clientWithPhone();
        c.setId(UUID.randomUUID());
        c.setRodoConsentAt(null);
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));
        when(repo.save(any(Client.class))).thenAnswer(inv -> inv.getArgument(0));

        var dto = svc.update(c.getId(),
            new UpdateClientRequest(null, null, null, null, null, true, null));

        assertThat(dto.rodoConsentAt()).isNotNull();
        assertThat(c.getRodoConsentAt()).isNotNull();
    }

    @Test
    void updateRevokesRodoConsent() {
        Client c = clientWithPhone();
        c.setId(UUID.randomUUID());
        c.setRodoConsentAt(Instant.now());
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));
        when(repo.save(any(Client.class))).thenAnswer(inv -> inv.getArgument(0));

        var dto = svc.update(c.getId(),
            new UpdateClientRequest(null, null, null, null, null, false, null));

        assertThat(dto.rodoConsentAt()).isNull();
        assertThat(c.getRodoConsentAt()).isNull();
    }

    @Test
    void updateLeaveRodoAloneWhenNull() {
        Instant original = Instant.parse("2025-01-01T00:00:00Z");
        Client c = clientWithPhone();
        c.setId(UUID.randomUUID());
        c.setRodoConsentAt(original);
        when(repo.findById(c.getId())).thenReturn(Optional.of(c));
        when(repo.save(any(Client.class))).thenAnswer(inv -> inv.getArgument(0));

        svc.update(c.getId(),
            new UpdateClientRequest(null, null, null, null, null, null, null));

        assertThat(c.getRodoConsentAt()).isEqualTo(original);
    }

    private Client client(String f, String l) {
        Client c = new Client(); c.setFirstName(f); c.setLastName(l); return c;
    }

    private Client clientWithPhone() {
        Client c = new Client();
        c.setFirstName("Jan");
        c.setPhone("+48600000001");
        return c;
    }
}
