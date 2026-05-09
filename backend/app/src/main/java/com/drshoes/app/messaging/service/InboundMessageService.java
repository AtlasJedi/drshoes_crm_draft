package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.dto.PostmarkInboundPayload;
import com.drshoes.app.messaging.dto.SmsApiInboundPayload;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.messaging.util.PhoneNormalizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.UUID;

@Service
public class InboundMessageService {

    private static final Logger log = LoggerFactory.getLogger(InboundMessageService.class);

    private final MessageRepository messageRepo;
    private final MessageThreadRepository threadRepo;
    private final ClientRepository clientRepo;
    private final MessageThreadService threadService;

    public InboundMessageService(MessageRepository messageRepo,
                                 MessageThreadRepository threadRepo,
                                 ClientRepository clientRepo,
                                 MessageThreadService threadService) {
        this.messageRepo   = messageRepo;
        this.threadRepo    = threadRepo;
        this.clientRepo    = clientRepo;
        this.threadService = threadService;
    }

    public record InboundResult(UUID messageId, UUID threadId, boolean duplicate, boolean unmatched) {}

    @Audited(parent = "#result.threadId()")
    @Transactional
    public InboundResult recordEmailInbound(PostmarkInboundPayload p) {
        var existing = messageRepo.findByProviderMessageIdAndChannel(p.messageId(), "EMAIL");
        if (existing.isPresent()) {
            log.info("op=inbound.email outcome=duplicate actor=system providerId={} threadId={}",
                p.messageId(), existing.get().getThreadId());
            return new InboundResult(existing.get().getId(), existing.get().getThreadId(), true, false);
        }
        var clientOpt = clientRepo.findByEmailIgnoreCase(p.from());
        boolean unmatched = clientOpt.isEmpty();
        MessageThreadEntity thread = unmatched
            ? threadService.findOrCreateForRawSender(p.from(), "EMAIL")
            : threadService.findOrCreateForClient(clientOpt.get().getId(), "EMAIL");
        thread.setSubject(p.subject());
        thread.setUnreadCount(thread.getUnreadCount() + 1);
        thread.setLastMessageAt(OffsetDateTime.now());
        threadRepo.save(thread);
        String body = (p.strippedTextReply() != null && !p.strippedTextReply().isBlank())
                      ? p.strippedTextReply() : p.textBody();
        var msg = buildEmailMessage(thread.getId(), unmatched ? null : clientOpt.get().getId(),
                                    unmatched ? p.from() : null, p, body);
        var saved = messageRepo.save(msg);
        log.info("op=inbound.email outcome=recorded actor=system messageId={} threadId={} unmatched={}",
            saved.getId(), thread.getId(), unmatched);
        return new InboundResult(saved.getId(), thread.getId(), false, unmatched);
    }

    @Audited(parent = "#result.threadId()")
    @Transactional
    public InboundResult recordSmsInbound(SmsApiInboundPayload p) {
        var existing = messageRepo.findByProviderMessageIdAndChannel(p.smsId(), "SMS");
        if (existing.isPresent()) {
            log.info("op=inbound.sms outcome=duplicate actor=system providerId={} threadId={}",
                p.smsId(), existing.get().getThreadId());
            return new InboundResult(existing.get().getId(), existing.get().getThreadId(), true, false);
        }
        var normalized = PhoneNormalizer.normalize(p.smsFrom());
        var clientOpt  = clientRepo.findByPhone(normalized);
        boolean unmatched = clientOpt.isEmpty();
        MessageThreadEntity thread = unmatched
            ? threadService.findOrCreateForRawSender(normalized, "SMS")
            : threadService.findOrCreateForClient(clientOpt.get().getId(), "SMS");
        thread.setUnreadCount(thread.getUnreadCount() + 1);
        thread.setLastMessageAt(OffsetDateTime.now());
        threadRepo.save(thread);
        var msg = buildSmsMessage(thread.getId(), unmatched ? null : clientOpt.get().getId(),
                                  unmatched ? normalized : null, p);
        var saved = messageRepo.save(msg);
        log.info("op=inbound.sms outcome=recorded actor=system messageId={} threadId={} unmatched={}",
            saved.getId(), thread.getId(), unmatched);
        return new InboundResult(saved.getId(), thread.getId(), false, unmatched);
    }

    private MessageEntity buildEmailMessage(UUID threadId, UUID clientId, String rawSender,
                                            PostmarkInboundPayload p, String body) {
        var msg = MessageEntity.newMessage();
        msg.setThreadId(threadId);
        msg.setClientId(clientId);
        msg.setRawSender(rawSender);
        msg.setDirection("INBOUND");
        msg.setChannel("EMAIL");
        msg.setSubject(p.subject());
        msg.setBody(body);
        msg.setProviderMessageId(p.messageId());
        OffsetDateTime sentAt = OffsetDateTime.now();
        if (p.date() != null) { try { sentAt = OffsetDateTime.parse(p.date(), DateTimeFormatter.RFC_1123_DATE_TIME); } catch (DateTimeParseException ignored) {} }
        msg.setSentAt(sentAt);
        msg.setDeliveryStatus("DELIVERED");
        return msg;
    }

    private MessageEntity buildSmsMessage(UUID threadId, UUID clientId, String rawSender,
                                          SmsApiInboundPayload p) {
        var msg = MessageEntity.newMessage();
        msg.setThreadId(threadId);
        msg.setClientId(clientId);
        msg.setRawSender(rawSender);
        msg.setDirection("INBOUND");
        msg.setChannel("SMS");
        msg.setBody(p.smsText());
        msg.setProviderMessageId(p.smsId());
        msg.setSentAt(OffsetDateTime.ofInstant(Instant.ofEpochSecond(p.smsDate()), ZoneOffset.UTC));
        msg.setDeliveryStatus("DELIVERED");
        return msg;
    }

}
