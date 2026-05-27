package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.lib.messaging.Channel;
import org.springframework.stereotype.Component;

import java.util.UUID;
import lombok.RequiredArgsConstructor;

/**
 * Resolves the send-to address for a known client + channel.
 *
 * Returns null when the client has no address for the requested channel
 * (e.g. email is blank). Callers must guard against null before dispatch.
 * Throws {@link IllegalArgumentException} for unsupported channels.
 */
@Component
@RequiredArgsConstructor
public class MessageRecipientResolver {

    private final ClientRepository clients;

    /**
     * @param clientId the client whose address to look up
     * @param channel  "EMAIL" | "SMS" (case-sensitive, must match Channel enum)
     * @return the resolved address, or null if the client has none
     * @throws IllegalArgumentException if channel is not EMAIL or SMS
     */
    public String resolve(UUID clientId, String channel) {
        Channel ch = Channel.valueOf(channel);
        return switch (ch) {
            case EMAIL -> clients.findById(clientId).map(Client::getEmail).orElse(null);
            case SMS   -> clients.findById(clientId).map(Client::getPhone).orElse(null);
            default    -> throw new IllegalArgumentException("Unsupported channel: " + channel);
        };
    }
}
