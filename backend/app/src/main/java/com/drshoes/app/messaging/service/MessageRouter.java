package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageDirection;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import com.drshoes.lib.messaging.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Single outbound send pipeline. Two public entry points:
 *   - sendManual  — operator-initiated from MessagesController / MessageComposerModal
 *   - sendForTrigger — called by TriggerEngine after status-change post-commit hook
 *
 * Both delegate to a private send(...) that:
 *   1. loads template + builds TemplateContext via TemplateContextBuilder
 *   2. renders subject + body
 *   3. find-or-create message thread
 *   4. persists MessageEntity with deliveryStatus=QUEUED
 *   5. delegates to MessageGatewayDispatcher (gateway call + status update + thread bump)
 *
 * Logging contract: exactly ONE INFO log per call at step 5 with outcome=SENT|FAILED.
 */
@Service
public class MessageRouter {

    private static final Logger log = LoggerFactory.getLogger(MessageRouter.class);

    private final MessageRepository messages;
    private final MessageTemplateRepository templates;
    private final MessageThreadService threadService;
    private final TemplateRenderer renderer;
    private final TemplateContextBuilder contextBuilder;
    private final ClientRepository clients;
    private final MessageGatewayDispatcher dispatcher;

    public MessageRouter(
            MessageRepository messages,
            MessageTemplateRepository templates,
            MessageThreadService threadService,
            TemplateRenderer renderer,
            TemplateContextBuilder contextBuilder,
            ClientRepository clients,
            MessageGatewayDispatcher dispatcher) {
        this.messages = messages;
        this.templates = templates;
        this.threadService = threadService;
        this.renderer = renderer;
        this.contextBuilder = contextBuilder;
        this.clients = clients;
        this.dispatcher = dispatcher;
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

    /**
     * Retry entry point. Bypasses template lookup — uses the stored body/subject from the
     * original message directly. This is needed because seeded/manual messages may have
     * {@code templateId=null}, which would cause {@code sendManual} to throw.
     *
     * <p>The {@code @Audited} on {@code MessageRetryService#retry} handles audit for retries;
     * this method intentionally has no @Audited to avoid a double audit row.
     *
     * @param orig    the original FAILED MessageEntity (body/subject/channel/clientId/orderId)
     * @param actorId the authenticated admin's UUID
     * @return id of the newly persisted retry message row
     */
    @Transactional
    public UUID sendRetry(MessageEntity orig, UUID actorId) {
        var thread = threadService.findOrCreateForClient(orig.getClientId());

        var msg = MessageEntity.newMessage();
        msg.setThreadId(thread.getId());
        msg.setOrderId(orig.getOrderId());
        msg.setClientId(orig.getClientId());
        msg.setDirection(MessageDirection.OUTBOUND.name());
        msg.setChannel(orig.getChannel());
        msg.setTemplateId(orig.getTemplateId());   // may be null — no re-render needed
        msg.setSubject(orig.getSubject());
        msg.setBody(orig.getBody());
        msg.setDeliveryStatus(DeliveryStatus.QUEUED.name());
        msg.setSentBy(actorId);
        var saved = messages.saveAndFlush(msg);

        Channel ch = Channel.valueOf(orig.getChannel());
        String recipient = switch (ch) {
            case EMAIL -> clients.findById(orig.getClientId()).map(Client::getEmail).orElse(null);
            case SMS   -> clients.findById(orig.getClientId()).map(Client::getPhone).orElse(null);
            default    -> throw new IllegalArgumentException("Unsupported channel: " + orig.getChannel());
        };

        MessageEntity persisted = dispatcher.dispatch(saved, recipient, orig.getSubject(), orig.getBody());

        log.info("op=message.sendRetry outcome={} orderId={} newMessageId={} channel={}",
                persisted.getDeliveryStatus(), orig.getOrderId(), persisted.getId(), orig.getChannel());

        return persisted.getId();
    }

    // ---- private ----

    private UUID send(UUID orderId, UUID clientId, UUID templateId, UUID triggerId,
                      String channel, UUID actorId) {
        var template = templates.findById(templateId).orElseThrow(
                () -> new IllegalArgumentException("Template not found: " + templateId));
        var ctx = contextBuilder.buildContext(orderId, clientId);

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

        MessageEntity persisted = dispatcher.dispatch(saved, recipient, renderedSubject, renderedBody);

        log.info("op=message.send outcome={} orderId={} messageId={} channel={} triggerId={}",
                persisted.getDeliveryStatus(), orderId, persisted.getId(), channel, triggerId);

        return persisted.getId();
    }
}
