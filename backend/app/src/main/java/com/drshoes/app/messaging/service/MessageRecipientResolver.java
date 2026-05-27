package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.lib.messaging.Channel;
import org.springframework.stereotype.Component;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
@Component
@RequiredArgsConstructor
public class MessageRecipientResolver {

    private final ClientRepository clients;
    public String resolve(UUID clientId, String channel) {
        Channel ch = Channel.valueOf(channel);
        return switch (ch) {
            case EMAIL -> clients.findById(clientId).map(Client::getEmail).orElse(null);
            case SMS   -> clients.findById(clientId).map(Client::getPhone).orElse(null);
            default    -> throw new IllegalArgumentException("Unsupported channel: " + channel);
        };
    }
}
