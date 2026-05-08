package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageDirection;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * Single outbound send pipeline. Two public entry points:
 *   - sendManual  — operator-initiated from MessagesController / MessageComposerModal
 *   - sendForTrigger — called by TriggerEngine after status-change post-commit hook
 *
 * Both delegate to a private send(...) that:
 *   1. loads template + builds TemplateContext
 *   2. renders subject + body
 *   3. find-or-create message thread
 *   4. persists MessageEntity with deliveryStatus=QUEUED
 *   5. invokes gateway (EMAIL or SMS)
 *   6. updates row to SENT (providerMessageId + sentAt) or FAILED (errorCode + errorMessage)
 *   7. bumps thread.lastMessageAt ONLY on SENT
 *
 * Logging contract: exactly ONE INFO log per call at step 7 with outcome=SENT|FAILED.
 *
 * LOC: ~ 100 effective lines.
 */
@Service
public class MessageRouter {

    private static final Logger log = LoggerFactory.getLogger(MessageRouter.class);

    private final MessageRepository messages;
    private final MessageTemplateRepository templates;
    private final MessageThreadService threadService;
    private final MessageThreadRepository threads;
    private final TemplateRenderer renderer;
    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final ClientRepository clients;
    private final EmailGateway email;
    private final SmsGateway sms;

    public MessageRouter(
            MessageRepository messages,
            MessageTemplateRepository templates,
            MessageThreadService threadService,
            MessageThreadRepository threads,
            TemplateRenderer renderer,
            OrderRepository orders,
            OrderItemRepository orderItems,
            ClientRepository clients,
            EmailGateway email,
            SmsGateway sms) {
        this.messages = messages;
        this.templates = templates;
        this.threadService = threadService;
        this.threads = threads;
        this.renderer = renderer;
        this.orders = orders;
        this.orderItems = orderItems;
        this.clients = clients;
        this.email = email;
        this.sms = sms;
    }

    /**
     * Manual composer entry point. Returns persisted message id.
     *
     * <p>Audit note (task 2-10): @Audited fires on THIS method, producing path
     * {@code MessageRouter#sendManual}. Task 2-10's MessageSentTimelineHandler
     * must match BOTH {@code MessageRouter#sendManual} and
     * {@code MessageRouter#sendForTrigger} — not the private {@code send(...)},
     * which Spring AOP cannot intercept.
     */
    @Transactional
    @Audited(parent = "#orderId")
    public UUID sendManual(UUID orderId, UUID clientId, UUID templateId, String channel, UUID actorId) {
        return send(orderId, clientId, templateId, null, channel, actorId);
    }

    /**
     * Trigger entry point. Returns persisted message id.
     *
     * <p>Audit note (task 2-10): @Audited fires on THIS method, producing path
     * {@code MessageRouter#sendForTrigger}. See sendManual javadoc.
     */
    @Transactional
    @Audited(parent = "#orderId")
    public UUID sendForTrigger(UUID orderId, UUID clientId, UUID templateId, UUID triggerId, String channel) {
        return send(orderId, clientId, templateId, triggerId, channel, null);
    }

    // ---- private ----

    private UUID send(UUID orderId, UUID clientId, UUID templateId, UUID triggerId,
                      String channel, UUID actorId) {
        var template = templates.findById(templateId).orElseThrow(
                () -> new IllegalArgumentException("Template not found: " + templateId));
        var ctx = buildContext(orderId, clientId);

        String renderedSubject = template.getSubject() == null
                ? null : renderer.render(template.getSubject(), ctx);
        String renderedBody = renderer.render(template.getBody(), ctx);

        var thread = threadService.findOrCreateForClient(clientId);

        var msg = MessageEntity.newMessage();
        msg.setThreadId(thread.getId());
        msg.setOrderId(orderId);
        msg.setClientId(clientId);
        msg.setDirection(MessageDirection.OUTBOUND.name());
        msg.setChannel(channel);
        msg.setTemplateId(templateId);
        msg.setTriggerId(triggerId);
        msg.setSubject(renderedSubject);
        msg.setBody(renderedBody);
        msg.setDeliveryStatus(DeliveryStatus.QUEUED.name());
        msg.setSentBy(actorId);
        var saved = messages.saveAndFlush(msg);

        Channel ch = Channel.valueOf(channel);
        String recipient = switch (ch) {
            case EMAIL -> clients.findById(clientId).map(Client::getEmail).orElse(null);
            case SMS   -> clients.findById(clientId).map(Client::getPhone).orElse(null);
            default    -> throw new IllegalArgumentException("Unsupported channel: " + channel);
        };

        if (recipient == null || recipient.isBlank()) {
            log.warn("op=message.send outcome=FAILED orderId={} messageId={} channel={} cause=null_or_blank_recipient",
                    orderId, saved.getId(), channel);
        }

        var outbound = new OutboundMessage(ch, recipient, renderedSubject, renderedBody, null, null);

        boolean sent = false;
        try {
            var receipt = switch (ch) {
                case EMAIL -> email.send(outbound);
                case SMS   -> sms.send(outbound);
                default    -> throw new IllegalArgumentException("Unsupported channel: " + channel);
            };
            saved.setDeliveryStatus(DeliveryStatus.SENT.name());
            saved.setProviderMessageId(receipt.providerMessageId());
            saved.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
            sent = true;
        } catch (RuntimeException e) {
            saved.setDeliveryStatus(DeliveryStatus.FAILED.name());
            saved.setErrorCode(truncate(e.getClass().getSimpleName(), 60));
            saved.setErrorMessage(truncate(e.getMessage(), 1000));
            log.warn("op=message.send outcome=FAILED orderId={} messageId={} channel={} cause={}",
                    orderId, saved.getId(), channel, e.toString());
        }

        messages.save(saved);

        if (sent) {
            thread.setLastMessageAt(OffsetDateTime.now(ZoneOffset.UTC));
            threads.save(thread);
        }

        log.info("op=message.send outcome={} orderId={} messageId={} channel={} triggerId={}",
                saved.getDeliveryStatus(), orderId, saved.getId(), channel, triggerId);

        return saved.getId();
    }

    private TemplateContext buildContext(UUID orderId, UUID clientId) {
        Order order = orders.findById(orderId).orElseThrow(
                () -> new IllegalArgumentException("Order not found: " + orderId));
        Client client = clients.findById(clientId).orElseThrow(
                () -> new IllegalArgumentException("Client not found: " + clientId));

        List<String> typyPracy = orderItems.findAllByOrderIdOrderByPosition(orderId).stream()
                .map(item -> polishKindLabel(item.getKind()))
                .toList();

        OffsetDateTime dataOdbioru = order.getPlannedPickupAt() == null
                ? null
                : order.getPlannedPickupAt().atOffset(ZoneOffset.UTC);

        return new TemplateContext(
                client.getFirstName(),
                order.getCode(),
                typyPracy,
                dataOdbioru,
                "Dr Shoes"
        );
    }

    private static String polishKindLabel(OrderItemKind kind) {
        return switch (kind) {
            case NAPRAWA      -> "naprawa";
            case CUSTOM_BUTY  -> "custom buty";
            case CUSTOM_KURTKA -> "custom kurtka";
        };
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
