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
        var dto = svc.create(new CreateClientRequest("Jan", "Nowak", "+48", "j@n.pl", "vip"));
        assertThat(dto.firstName()).isEqualTo("Jan");
        assertThat(dto.id()).isNotNull();
        verify(repo).save(any(Client.class));
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
                new CreateClientRequest("Jan", "Brak", null, null, null)))
            .isInstanceOf(ClientContactMissingException.class);
        verify(repo, never()).save(any());
    }

    private Client client(String f, String l) {
        Client c = new Client(); c.setFirstName(f); c.setLastName(l); return c;
    }
}
