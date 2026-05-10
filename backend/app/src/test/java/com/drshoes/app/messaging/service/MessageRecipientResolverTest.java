package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageRecipientResolverTest {

    @Mock private ClientRepository clients;

    private MessageRecipientResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new MessageRecipientResolver(clients);
    }

    @Test
    void emailChannelReturnsClientEmail() {
        UUID clientId = UUID.randomUUID();
        var client = new Client();
        client.setFirstName("Anna");
        client.setLastName("Nowak");
        client.setEmail("anna@example.com");
        client.setPhone("+48600000001");
        when(clients.findById(clientId)).thenReturn(Optional.of(client));

        String recipient = resolver.resolve(clientId, "EMAIL");

        assertThat(recipient).isEqualTo("anna@example.com");
    }

    @Test
    void smsChannelReturnsClientPhone() {
        UUID clientId = UUID.randomUUID();
        var client = new Client();
        client.setFirstName("Jan");
        client.setLastName("Kowalski");
        client.setEmail("jan@example.com");
        client.setPhone("+48600000002");
        when(clients.findById(clientId)).thenReturn(Optional.of(client));

        String recipient = resolver.resolve(clientId, "SMS");

        assertThat(recipient).isEqualTo("+48600000002");
    }

    @Test
    void unknownChannelThrowsIllegalArgument() {
        UUID clientId = UUID.randomUUID();
        // No stub needed — Channel.valueOf("WHATSAPP") is valid but the switch default throws
        // before any repository call is made.
        assertThatThrownBy(() -> resolver.resolve(clientId, "WHATSAPP"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("WHATSAPP");
    }

    @Test
    void completelyUnknownChannelThrowsIllegalArgument() {
        UUID clientId = UUID.randomUUID();
        // "CARRIER_PIGEON" fails Channel.valueOf() itself — also IllegalArgumentException.
        assertThatThrownBy(() -> resolver.resolve(clientId, "CARRIER_PIGEON"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void missingClientReturnsNull() {
        UUID clientId = UUID.randomUUID();
        when(clients.findById(clientId)).thenReturn(Optional.empty());

        String recipient = resolver.resolve(clientId, "EMAIL");

        assertThat(recipient).isNull();
    }

    @Test
    void clientWithNullEmailReturnsNull() {
        UUID clientId = UUID.randomUUID();
        var client = new Client();
        client.setFirstName("X");
        client.setLastName("Y");
        // email is null
        when(clients.findById(clientId)).thenReturn(Optional.of(client));

        String recipient = resolver.resolve(clientId, "EMAIL");

        assertThat(recipient).isNull();
    }
}
