package com.drshoes.app.demo;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.service.MessageThreadService;
import com.drshoes.app.order.domain.Order;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * Seeds one demo MessageThread with 4 alternating-direction messages so the
 * inbox UI has content to display in the demo environment.
 *
 * Thread creation goes through MessageThreadService.findOrCreateForClient
 * (idempotent find-or-create). Messages are inserted directly via
 * MessageRepository — no MessageRouter invocation so no real provider sends
 * are triggered during seed.
 *
 * AuditLogAspect does not fire here because seed runs outside an HTTP request
 * (ApplicationRunner, no .api. controller in the call stack).
 */
@Component
@Profile("local")
@Slf4j
@RequiredArgsConstructor
public class DemoThreadFactory {

    private final MessageThreadService threadService;
    private final MessageRepository messageRepository;

    public void createSampleThread(Client client, Order order) {
        var thread = threadService.findOrCreateForClient(client.getId(), "EMAIL");
        thread.setSubject("Zapytanie o zlecenie " + order.getCode());

        List<MessageEntity> conversations = List.of(
            msg(thread.getId(), order.getId(), client.getId(), "OUTBOUND",
                "Dzień dobry! Potwierdzamy przyjęcie zlecenia " + order.getCode()
                + ". Planowany odbiór za około 7 dni."),
            msg(thread.getId(), order.getId(), client.getId(), "INBOUND",
                "Dziękuję! Czy mogę przyjść wcześniej?"),
            msg(thread.getId(), order.getId(), client.getId(), "OUTBOUND",
                "Oczywiście, proszę zadzwonić przed przyjazdem."),
            msg(thread.getId(), order.getId(), client.getId(), "INBOUND",
                "Świetnie, zadzwonię jutro. Dziękuję!")
        );
        messageRepository.saveAll(conversations);
        log.info("op=demo.seed.threads count=1 threadId={} clientId={}",
            thread.getId(), client.getId());
    }

    private MessageEntity msg(UUID threadId, UUID orderId,
                               UUID clientId, String direction, String body) {
        var m = MessageEntity.newMessage();
        m.setThreadId(threadId);
        m.setOrderId(orderId);
        m.setClientId(clientId);
        m.setDirection(direction);
        m.setChannel("EMAIL");
        m.setBody(body);
        m.setDeliveryStatus("SENT");
        return m;
    }
}
