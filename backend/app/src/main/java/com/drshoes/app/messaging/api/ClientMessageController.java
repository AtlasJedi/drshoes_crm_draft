package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.dto.SendNewMessageRequest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.service.MessageRouter;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * POST /api/admin/clients/{id}/messages — cross-thread "Nowa wiadomość" composer.
 * Separate controller for clean RBAC surface; keeps MessagesController unchanged (M2 contract).
 * LOC target: < 70.
 */
@RestController
@RequestMapping("/api/admin/clients")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
@Slf4j
@RequiredArgsConstructor
public class ClientMessageController {

    private final ClientRepository clients;
    private final MessageRepository messages;
    private final MessageRouter router;

    @PostMapping("/{clientId}/messages")
    public MessageDto sendNew(@PathVariable UUID clientId,
                              @RequestBody SendNewMessageRequest req,
                              @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=client.sendNew actor={} clientId={} channel={}", actor.email(), clientId, req.channel());

        Client client = clients.findById(clientId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found"));

        String channel = req.channel() == null ? null : req.channel().toUpperCase();
        validateChannelAvailability(client, channel);

        UUID messageId = router.sendNewToClient(clientId, channel, req.subject(), req.body(), actor);

        MessageEntity msg = messages.findById(messageId)
            .orElseThrow(() -> new IllegalStateException("Message not found after send: " + messageId));

        log.info("op=client.sendNew actor={} clientId={} messageId={} outcome=ok",
            actor.email(), clientId, messageId);

        return toDto(msg);
    }

    // ---- private ----

    private void validateChannelAvailability(Client client, String channel) {
        if ("EMAIL".equals(channel) && (client.getEmail() == null || client.getEmail().isBlank())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Client has no email address");
        }
        if ("SMS".equals(channel) && (client.getPhone() == null || client.getPhone().isBlank())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Client has no phone number");
        }
    }

    private MessageDto toDto(MessageEntity m) {
        return new MessageDto(m.getId(), m.getOrderId(), m.getClientId(), m.getDirection(),
            m.getChannel(), m.getTemplateId(), m.getTriggerId(), m.getSubject(), m.getBody(),
            m.getDeliveryStatus(), m.getProviderMessageId(), m.getSentAt(), m.getCreatedAt(),
            m.getErrorCode(), m.getErrorMessage(), m.getRetryOfMessageId(),
            m.getRetryAttempt() == null ? 1 : m.getRetryAttempt(),
            m.getThreadId());
    }
}
