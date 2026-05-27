package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.AuditLogWriter;
import com.drshoes.app.messaging.domain.WebhookEventEntity;
import com.drshoes.app.messaging.domain.WebhookEventRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.lib.messaging.Provider;
import com.drshoes.lib.messaging.WebhookEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Service
@Slf4j
@RequiredArgsConstructor
public class WebhookStatusReconciler {
    public static final String AUDIT_PATH_PREFIX    = "WebhookStatusReconciler#apply";
    public static final String AUDIT_PATH_DELIVERED = "WebhookStatusReconciler#applyDelivered";
    public static final String AUDIT_PATH_FAILED    = "WebhookStatusReconciler#applyFailed";

    private final MessageRepository      messages;
    private final WebhookEventRepository webhookEvents;
    private final ObjectMapper           objectMapper;
    private final AuditLogWriter         auditWriter;
    @Transactional
    public ReconcileResult apply(WebhookEvent event) {
        log.info("op=webhook.reconcile provider={} providerMessageId={} status={}",
                event.provider(), event.providerMessageId(), event.status());
        if (event.status() == null) {
            persistWebhookEvent(event, null, WebhookEventEntity.AppliedOutcome.DROPPED, null);
            log.info("op=webhook.reconcile provider={} providerMessageId={} outcome=DROPPED",
                    event.provider(), event.providerMessageId());
            return ReconcileResult.of(AppliedOutcome.DROPPED);
        }
        if (event.providerEventId() != null) {
            boolean exists = webhookEvents
                    .findByProviderAndProviderEventId(event.provider(), event.providerEventId())
                    .isPresent();
            if (exists) {
                log.info("op=webhook.reconcile provider={} providerEventId={} outcome=DEDUP",
                        event.provider(), event.providerEventId());
                return ReconcileResult.of(AppliedOutcome.DEDUP);
            }
        }
        String channel = channelFor(event.provider());
        var msgOpt = messages.findByProviderMessageIdAndChannel(
                event.providerMessageId(), channel);

        if (msgOpt.isEmpty()) {
            persistWebhookEvent(event, null, WebhookEventEntity.AppliedOutcome.NO_MESSAGE, null);
            log.info("op=webhook.reconcile provider={} providerMessageId={} outcome=NO_MESSAGE",
                    event.provider(), event.providerMessageId());
            return ReconcileResult.of(AppliedOutcome.NO_MESSAGE);
        }

        var msg = msgOpt.get();
        String targetStatus = event.status().name();
        OffsetDateTime deliveredAt = "DELIVERED".equals(targetStatus)
                ? event.occurredAt().atOffset(ZoneOffset.UTC) : null;
        int updated = messages.reconcileDeliveryStatus(
                msg.getId(),
                targetStatus,
                event.errorCode(),
                event.errorMessage(),
                deliveredAt);

        if (updated == 0) {
            persistWebhookEvent(event, msg.getId(),
                    WebhookEventEntity.AppliedOutcome.NO_TRANSITION, null);
            log.info("op=webhook.reconcile provider={} messageId={} outcome=NO_TRANSITION",
                    event.provider(), msg.getId());
            return ReconcileResult.of(AppliedOutcome.NO_TRANSITION);
        }
        WebhookEventEntity.AppliedStatus appliedStatus = "DELIVERED".equals(targetStatus)
                ? WebhookEventEntity.AppliedStatus.DELIVERED
                : WebhookEventEntity.AppliedStatus.FAILED;

        persistWebhookEvent(event, msg.getId(),
                WebhookEventEntity.AppliedOutcome.APPLIED, appliedStatus);
        UUID orderId = msg.getOrderId();
        String auditPath = "DELIVERED".equals(targetStatus)
                ? AUDIT_PATH_DELIVERED
                : AUDIT_PATH_FAILED;
        auditWriter.write("INTERNAL", auditPath, 0, null, null, orderId, null);

        log.info("op=webhook.reconcile provider={} messageId={} orderId={} newStatus={} outcome=APPLIED",
                event.provider(), msg.getId(), orderId, targetStatus);

        return ReconcileResult.applied(event.status(), msg.getId());
    }

    private void persistWebhookEvent(WebhookEvent event, UUID messageId,
                                     WebhookEventEntity.AppliedOutcome outcome,
                                     WebhookEventEntity.AppliedStatus appliedStatus) {
        var entity = new WebhookEventEntity();
        entity.setProvider(event.provider());
        entity.setProviderEventId(event.providerEventId());
        entity.setProviderMessageId(event.providerMessageId());
        entity.setMessageId(messageId);
        entity.setEventType(event.provider().name());
        entity.setAppliedOutcome(outcome);
        entity.setAppliedStatus(appliedStatus);
        entity.setErrorCode(event.errorCode());
        entity.setErrorMessage(event.errorMessage());
        entity.setRawPayload(parseRawPayload(event.rawPayload()));
        entity.setReceivedAt(Instant.now());
        if (outcome == WebhookEventEntity.AppliedOutcome.APPLIED) {
            entity.setAppliedAt(Instant.now());
        }
        webhookEvents.save(entity);
    }

    private JsonNode parseRawPayload(String rawPayload) {
        try {
            return objectMapper.readTree(rawPayload);
        } catch (Exception e) {
            return objectMapper.getNodeFactory().textNode(rawPayload);
        }
    }
    private static String channelFor(Provider provider) {
        return switch (provider) {
            case POSTMARK -> "EMAIL";
            case SMSAPI   -> "SMS";
        };
    }
}
