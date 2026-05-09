package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.AuditLogWriter;
import com.drshoes.app.messaging.domain.WebhookEventEntity;
import com.drshoes.app.messaging.domain.WebhookEventRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.lib.messaging.Provider;
import com.drshoes.lib.messaging.WebhookEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Applies inbound webhook delivery events to the message table.
 *
 * <h2>State machine</h2>
 * Only messages in SENT state are eligible for transition.
 * A state-guarded UPDATE (WHERE delivery_status = 'SENT') provides idempotency:
 * if the row is already DELIVERED or FAILED, the UPDATE returns 0 rows → NO_TRANSITION.
 *
 * <h2>DROPPED events</h2>
 * When {@code event.status()} is null (non-delivery record type: Click, Open, etc.)
 * the reconciler short-circuits — no message lookup, no state change.
 * A webhook_event row is still persisted for forensic observability.
 *
 * <h2>Audit</h2>
 * This service writes its own INTERNAL audit row (via {@link AuditLogWriter}) on every
 * APPLIED outcome, with {@code path = "WebhookStatusReconciler#apply"} and
 * {@code parent_entity_id = orderId}. This allows the
 * {@link com.drshoes.app.audit.TimelineEventCurator} to emit a MESSAGE_DELIVERED
 * timeline event. Non-APPLIED outcomes do not write an audit row (no timeline event).
 *
 * Structured logging per CLAUDE.md §7: every outcome logs key=value at INFO.
 */
@Service
public class WebhookStatusReconciler {

    /** Shared prefix — both suffix constants start with this string. */
    public static final String AUDIT_PATH_PREFIX    = "WebhookStatusReconciler#apply";
    /** Audit path written on APPLIED + DELIVERED outcome. */
    public static final String AUDIT_PATH_DELIVERED = "WebhookStatusReconciler#applyDelivered";
    /** Audit path written on APPLIED + FAILED outcome. */
    public static final String AUDIT_PATH_FAILED    = "WebhookStatusReconciler#applyFailed";

    private static final Logger log = LoggerFactory.getLogger(WebhookStatusReconciler.class);

    private final MessageRepository      messages;
    private final WebhookEventRepository webhookEvents;
    private final ObjectMapper           objectMapper;
    private final AuditLogWriter         auditWriter;

    public WebhookStatusReconciler(MessageRepository messages,
                                   WebhookEventRepository webhookEvents,
                                   ObjectMapper objectMapper,
                                   AuditLogWriter auditWriter) {
        this.messages      = messages;
        this.webhookEvents = webhookEvents;
        this.objectMapper  = objectMapper;
        this.auditWriter   = auditWriter;
    }

    /**
     * Applies the webhook event and returns a {@link ReconcileResult}.
     *
     * @param event the normalised inbound webhook event
     * @return outcome of this reconciliation attempt
     */
    @Transactional
    public ReconcileResult apply(WebhookEvent event) {
        log.info("op=webhook.reconcile provider={} providerMessageId={} status={}",
                event.provider(), event.providerMessageId(), event.status());

        // ── 1. DROPPED: non-delivery event type ─────────────────────────────
        if (event.status() == null) {
            persistWebhookEvent(event, null, WebhookEventEntity.AppliedOutcome.DROPPED, null);
            log.info("op=webhook.reconcile provider={} providerMessageId={} outcome=DROPPED",
                    event.provider(), event.providerMessageId());
            return ReconcileResult.of(AppliedOutcome.DROPPED);
        }

        // ── 2. DEDUP: duplicate providerEventId (when non-null) ─────────────
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

        // ── 3. Lookup message by providerMessageId + channel ────────────────
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
        String targetStatus = event.status().name();    // "DELIVERED" or "FAILED"
        OffsetDateTime deliveredAt = "DELIVERED".equals(targetStatus)
                ? event.occurredAt().atOffset(ZoneOffset.UTC) : null;

        // ── 4. State-guarded UPDATE ──────────────────────────────────────────
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

        // ── 5. Persist forensic row + audit entry ────────────────────────────
        WebhookEventEntity.AppliedStatus appliedStatus = "DELIVERED".equals(targetStatus)
                ? WebhookEventEntity.AppliedStatus.DELIVERED
                : WebhookEventEntity.AppliedStatus.FAILED;

        persistWebhookEvent(event, msg.getId(),
                WebhookEventEntity.AppliedOutcome.APPLIED, appliedStatus);

        // Write INTERNAL audit row with orderId as parent_entity_id so the
        // TimelineEventCurator can emit MESSAGE_DELIVERED or MESSAGE_FAILED.
        UUID orderId = msg.getOrderId();
        String auditPath = "DELIVERED".equals(targetStatus)
                ? AUDIT_PATH_DELIVERED
                : AUDIT_PATH_FAILED;
        auditWriter.write("INTERNAL", auditPath, 0, null, null, orderId, null);

        log.info("op=webhook.reconcile provider={} messageId={} orderId={} newStatus={} outcome=APPLIED",
                event.provider(), msg.getId(), orderId, targetStatus);

        return ReconcileResult.applied(event.status(), msg.getId());
    }

    // ── private helpers ──────────────────────────────────────────────────────

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

    /** Maps a Provider enum value to the channel string stored in message.channel. */
    private static String channelFor(Provider provider) {
        return switch (provider) {
            case POSTMARK -> "EMAIL";
            case SMSAPI   -> "SMS";
        };
    }
}
