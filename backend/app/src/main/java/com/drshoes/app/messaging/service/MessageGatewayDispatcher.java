package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import com.drshoes.lib.whatsapp.WhatsAppGateway;
import io.opentelemetry.api.OpenTelemetry;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Service
@Slf4j
@RequiredArgsConstructor
public class MessageGatewayDispatcher {

    private final EmailGateway emailGateway;
    private final SmsGateway smsGateway;
    private final WhatsAppGateway whatsAppGateway;
    private final MessagingSpanHelper spanHelper;
    private final MessageRepository messages;
    private final MessageThreadRepository threads;
    public MessageEntity dispatch(MessageEntity saved, String recipient, String subject, String body) {
        return spanHelper.dispatchWithSpan(saved.getChannel(), saved.getId(), recipient, () -> {
            Channel ch = Channel.valueOf(saved.getChannel());
            var outbound = new OutboundMessage(ch, recipient, subject, body, null, null,
                    saved.getBodyHtml());

            try {
                DeliveryReceipt receipt = switch (ch) {
                    case EMAIL    -> emailGateway.send(outbound);
                    case SMS      -> smsGateway.send(outbound);
                    case WHATSAPP -> whatsAppGateway.send(outbound);
                };
                saved.setDeliveryStatus("SENT");
                saved.setProviderMessageId(receipt.providerMessageId());
                saved.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
                log.info("op=gateway.dispatch outcome=ok messageId={} channel={} providerId={}",
                        saved.getId(), saved.getChannel(), receipt.providerMessageId());
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                saved.setDeliveryStatus("FAILED");
                saved.setErrorCode(truncate(e.getClass().getSimpleName(), 60));
                saved.setErrorMessage(truncate(e.getMessage(), 1000));
                log.warn("op=gateway.dispatch outcome=failed messageId={} channel={} err={}",
                        saved.getId(), saved.getChannel(), e.toString());
            }

            MessageEntity persisted = messages.save(saved);

            if ("SENT".equals(persisted.getDeliveryStatus())) {
                threads.findById(persisted.getThreadId()).ifPresent(t -> {
                    t.setLastMessageAt(persisted.getSentAt());
                    threads.save(t);
                });
            }

            return persisted;
        }, persisted -> "FAILED".equals(persisted.getDeliveryStatus()));
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
