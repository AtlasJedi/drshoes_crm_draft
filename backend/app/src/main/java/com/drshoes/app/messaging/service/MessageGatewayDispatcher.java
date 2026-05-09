package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Extracted gateway dispatch unit. Builds an {@link OutboundMessage}, dispatches it
 * through the appropriate channel gateway, updates {@link MessageEntity} status
 * (SENT / FAILED), persists, and bumps the thread's {@code lastMessageAt} on success.
 *
 * <p>Previously this logic was duplicated between {@code MessageRouter.send(...)} and
 * {@code MessageRouter.sendRetry(...)}. M5 adds {@code sendReply} and {@code sendNewToClient},
 * so extraction is a BLOCKER before adding further methods. (M5 plan §10 debt item.)</p>
 *
 * <p>LOC target: ≤ 90. Flag if exceeded.</p>
 */
@Service
public class MessageGatewayDispatcher {

    private static final Logger log = LoggerFactory.getLogger(MessageGatewayDispatcher.class);

    private final EmailGateway emailGateway;
    private final SmsGateway smsGateway;
    private final MessageRepository messages;
    private final MessageThreadRepository threads;

    public MessageGatewayDispatcher(EmailGateway emailGateway, SmsGateway smsGateway,
                                    MessageRepository messages, MessageThreadRepository threads) {
        this.emailGateway = emailGateway;
        this.smsGateway = smsGateway;
        this.messages = messages;
        this.threads = threads;
    }

    /**
     * Dispatch a SAVED {@link MessageEntity} through its channel gateway, update status
     * (SENT / FAILED), persist, and bump the thread's {@code last_message_at} on success.
     *
     * <p>Logging contract: one INFO per call with {@code op=gateway.dispatch outcome=ok|failed}.</p>
     *
     * @param saved     a persisted MessageEntity in QUEUED state
     * @param recipient email address or phone number (validated non-blank by OutboundMessage)
     * @param subject   email subject; null for SMS
     * @param body      message body (validated non-blank by OutboundMessage)
     * @return the updated and persisted MessageEntity
     * @throws IllegalArgumentException if channel is not EMAIL or SMS, or if recipient/body blank
     */
    public MessageEntity dispatch(MessageEntity saved, String recipient, String subject, String body) {
        Channel ch = Channel.valueOf(saved.getChannel());
        var outbound = new OutboundMessage(ch, recipient, subject, body, null, null);

        try {
            DeliveryReceipt receipt = switch (ch) {
                case EMAIL -> emailGateway.send(outbound);
                case SMS   -> smsGateway.send(outbound);
                default    -> throw new IllegalArgumentException("unknown channel: " + saved.getChannel());
            };
            saved.setDeliveryStatus("SENT");
            saved.setProviderMessageId(receipt.providerMessageId());
            saved.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
            log.info("op=gateway.dispatch outcome=ok messageId={} channel={} providerId={}",
                    saved.getId(), saved.getChannel(), receipt.providerMessageId());
        } catch (IllegalArgumentException e) {
            throw e; // propagate unknown-channel and OutboundMessage validation errors
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
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
