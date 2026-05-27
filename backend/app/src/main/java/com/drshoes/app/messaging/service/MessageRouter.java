package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageDirection;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * Single outbound send pipeline. Five public entry points:
 *   - sendManual         — operator-initiated from MessagesController / MessageComposerModal
 *   - sendForTrigger     — called by TriggerEngine after status-change post-commit hook
 *   - sendRetry          — called by MessageRetryService; bypasses template re-render
 *   - sendReply          — operator reply on an existing thread
 *   - sendNewToClient    — cross-thread first-contact compose
 *
 * EMAIL sends (sendReply + sendNewToClient) are wrapped in the followup HTML template (v2-E).
 * Stored body = user plain text (for bubble display); bodyHtml = rendered wrapper (for gateway).
 *
 * Recipient resolution is delegated to {@link MessageRecipientResolver}.
 * Gateway dispatch is delegated to {@link MessageGatewayDispatcher}.
 * Logging contract: exactly ONE INFO log per public call with outcome=SENT|FAILED.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class MessageRouter {

    private final MessageRepository messages;
    private final MessageTemplateRepository templates;
    private final MessageThreadService threadService;
    private final TemplateRenderer renderer;
    private final TemplateContextBuilder contextBuilder;
    private final MessageRecipientResolver recipientResolver;
    private final MessageGatewayDispatcher dispatcher;

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
     * Retry entry point. Bypasses template lookup — uses stored body/subject from the original
     * message. No @Audited here; MessageRetryService#retry handles the audit row.
     */
    @Transactional
    public UUID sendRetry(MessageEntity orig, UUID actorId) {
        var thread = threadService.findOrCreateForClient(orig.getClientId());
        String recipient = recipientResolver.resolve(orig.getClientId(), orig.getChannel());

        var msg = buildOutbound(thread.getId(), orig.getOrderId(), orig.getClientId(),
                orig.getChannel(), orig.getTemplateId(), null,
                orig.getSubject(), orig.getBody(), orig.getBodyHtml(), actorId);
        var persisted = dispatcher.dispatch(msg, recipient, orig.getSubject(), orig.getBody());

        log.info("op=message.sendRetry outcome={} orderId={} newMessageId={} channel={}",
                persisted.getDeliveryStatus(), orig.getOrderId(), persisted.getId(), orig.getChannel());
        return persisted.getId();
    }

    /**
     * Reply send entry point — operator freeform message on an existing thread.
     * EMAIL channel: body is stored as plain text for bubble display; outbound
     * email is wrapped in the followup HTML template (v2-E). SMS: sent as-is.
     */
    @Transactional
    public UUID sendReply(UUID threadId, UUID clientId, String channel, String subject,
                          String body, UUID orderId, AdminPrincipal actor) {
        String recipient = recipientResolver.resolve(clientId, channel);
        UUID actorId = actor == null ? null : actor.userId();

        WrappedEmail wrap = "EMAIL".equals(channel)
                ? wrapWithFollowupTemplate(clientId, orderId, body)
                : new WrappedEmail(subject, null);

        var msg = buildOutbound(threadId, orderId, clientId, channel,
                null, null, wrap.subject(), body, wrap.bodyHtml(), actorId);
        var persisted = dispatcher.dispatch(msg, recipient, wrap.subject(), body);

        log.info("op=message.sendReply outcome={} threadId={} messageId={} channel={} actor={}",
                persisted.getDeliveryStatus(), threadId, persisted.getId(), channel,
                actor == null ? "system" : actor.email());
        return persisted.getId();
    }

    /**
     * Cross-thread "Nowa wiadomość" compose — first-contact with a client on a given channel.
     * EMAIL channel: body is stored as plain text for bubble display; outbound email is
     * wrapped in the followup HTML template (v2-E). SMS: sent as-is.
     */
    @Transactional
    public UUID sendNewToClient(UUID clientId, String channel, String subject,
                                String body, AdminPrincipal actor) {
        String recipient = recipientResolver.resolve(clientId, channel);
        var thread = threadService.findOrCreateForClient(clientId, channel);
        UUID actorId = actor == null ? null : actor.userId();

        WrappedEmail wrap = "EMAIL".equals(channel)
                ? wrapWithFollowupTemplate(clientId, null, body)
                : new WrappedEmail(subject, null);

        var msg = buildOutbound(thread.getId(), null, clientId, channel,
                null, null, wrap.subject(), body, wrap.bodyHtml(), actorId);
        var persisted = dispatcher.dispatch(msg, recipient, wrap.subject(), body);

        log.info("op=message.sendNewToClient outcome={} clientId={} channel={} threadId={} messageId={} actor={}",
                persisted.getDeliveryStatus(), clientId, channel, thread.getId(), persisted.getId(),
                actor == null ? "system" : actor.email());
        return persisted.getId();
    }

    // ---- private ----

    /**
     * Wraps a free-form operator message in the "Dr Shoes - followup (EMAIL)" template.
     * Returns rendered subject + bodyHtml. The caller stores the original user text as
     * {@code body} (for bubble display) and this rendered HTML as {@code bodyHtml} (for gateway).
     */
    private WrappedEmail wrapWithFollowupTemplate(UUID clientId, UUID orderId, String userMessage) {
        var tpl = templates.findByName("Dr Shoes - followup (EMAIL)")
                .orElseThrow(() -> new IllegalStateException(
                        "Followup template not seeded — run V026 migration"));
        var ctx = contextBuilder.buildContext(orderId, clientId, userMessage);
        String renderedSubject = renderer.render(tpl.getSubject(), ctx);
        String renderedHtml = renderer.render(tpl.getBodyHtml(), ctx);
        log.info("op=message.wrapFollowup clientId={} orderId={} subject={} outcome=ok",
                clientId, orderId, renderedSubject);
        return new WrappedEmail(renderedSubject, renderedHtml);
    }

    /** Carrier for the wrapped EMAIL subject + bodyHtml pair. */
    private record WrappedEmail(String subject, String bodyHtml) {}

    private UUID send(UUID orderId, UUID clientId, UUID templateId, UUID triggerId,
                      String channel, UUID actorId) {
        var template = templates.findById(templateId).orElseThrow(
                () -> new IllegalArgumentException("Template not found: " + templateId));
        var ctx = contextBuilder.buildContext(orderId, clientId);

        String renderedSubject = template.getSubject() == null
                ? null : renderer.render(template.getSubject(), ctx);
        String renderedBody = renderer.render(template.getBody(), ctx);
        String renderedHtml = template.getBodyHtml() == null
                ? null : renderer.render(template.getBodyHtml(), ctx);

        var thread = threadService.findOrCreateForClient(clientId);
        String recipient = recipientResolver.resolve(clientId, channel);

        if (recipient == null || recipient.isBlank()) {
            log.warn("op=message.send outcome=FAILED orderId={} channel={} cause=null_or_blank_recipient",
                    orderId, channel);
        }

        var msg = buildOutbound(thread.getId(), orderId, clientId, channel,
                templateId, triggerId, renderedSubject, renderedBody, renderedHtml, actorId);
        var persisted = dispatcher.dispatch(msg, recipient, renderedSubject, renderedBody);

        log.info("op=message.send outcome={} orderId={} messageId={} channel={} triggerId={}",
                persisted.getDeliveryStatus(), orderId, persisted.getId(), channel, triggerId);
        return persisted.getId();
    }

    private MessageEntity buildOutbound(UUID threadId, UUID orderId, UUID clientId,
                                        String channel, UUID templateId, UUID triggerId,
                                        String subject, String body, String bodyHtml, UUID actorId) {
        var msg = MessageEntity.newMessage();
        msg.setThreadId(threadId);
        msg.setOrderId(orderId);
        msg.setClientId(clientId);
        msg.setDirection(MessageDirection.OUTBOUND.name());
        msg.setChannel(channel);
        msg.setTemplateId(templateId);
        msg.setTriggerId(triggerId);
        msg.setSubject(subject);
        msg.setBody(body);
        msg.setBodyHtml(bodyHtml);
        msg.setDeliveryStatus(DeliveryStatus.QUEUED.name());
        msg.setSentBy(actorId);
        return messages.saveAndFlush(msg);
    }
}
