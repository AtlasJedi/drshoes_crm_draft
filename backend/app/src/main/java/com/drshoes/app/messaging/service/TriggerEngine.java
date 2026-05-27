package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.TriggerEntity;
import com.drshoes.app.messaging.domain.TriggerEvent;
import com.drshoes.app.messaging.repository.TriggerRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

/**
 * Evaluates and fires messaging triggers.
 *
 * Two entry points:
 *   - onStatusChange(orderId, fromStatus, toStatus): called inside an active @Transactional from
 *     OrderService.changeStatus. Registers an afterCommit hook; the actual fire happens
 *     post-commit in a new transaction (opened by MessageRouter.sendForTrigger).
 *   - fireScheduled(trg, orderId, discriminator): called by ScheduledTriggerJob for time-based
 *     triggers. No transaction registration — caller is responsible for scheduling context.
 *
 * Idempotency: every fire is guarded by IdempotencyService.claimTriggerFire. Duplicate fires
 * (e.g., status re-entered) are silently skipped with an INFO log.
 *
 * Logging contract:
 *   - trigger.skip (INFO): idempotency guard fired; fire skipped.
 *   - trigger.fire outcome=error (ERROR): gateway or parse failure during fire.
 */
@Service
@Slf4j
public class TriggerEngine {

    private final TriggerRepository triggers;
    private final OrderRepository orders;
    private final IdempotencyService idem;
    private final MessageRouter router;
    private final TransactionTemplate requiresNewTx;
    private final ObjectMapper json = new ObjectMapper();

    public TriggerEngine(
            TriggerRepository triggers,
            OrderRepository orders,
            IdempotencyService idem,
            MessageRouter router,
            PlatformTransactionManager txManager) {
        this.triggers = triggers;
        this.orders = orders;
        this.idem = idem;
        this.router = router;
        this.requiresNewTx = new TransactionTemplate(txManager);
        this.requiresNewTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Called from OrderService.changeStatus inside its @Transactional method.
     * Registers an afterCommit callback so trigger fires are skipped on rollback.
     */
    public void onStatusChange(UUID orderId, String fromStatus, String toStatus) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                fireImmediateForStatus(orderId, toStatus);
            }
        });
    }

    /**
     * Public entry for the scheduled job — fires for orders matched by the cron-aware caller.
     */
    public void fireScheduled(TriggerEntity trg, UUID orderId, String discriminator) {
        if (!idem.claimTriggerFire(trg.getId(), orderId, discriminator)) {
            log.info("op=scheduled_trigger.skip reason=idempotent triggerId={} orderId={}",
                    trg.getId(), orderId);
            return;
        }
        fireOne(trg, orderId);
    }

    // ---- private ----

    private void fireImmediateForStatus(UUID orderId, String toStatus) {
        var enabled = triggers.findAllByEventAndEnabledTrue(TriggerEvent.STATUS_CHANGE);
        for (var trg : enabled) {
            try {
                JsonNode params = json.readTree(trg.getEventParams());
                String configured = params.path("toStatus").asText("");
                if (!configured.equals(toStatus)) continue;

                String disc = "to:" + toStatus;
                if (!idem.claimTriggerFire(trg.getId(), orderId, disc)) {
                    log.info("op=trigger.skip reason=idempotent triggerId={} orderId={}",
                            trg.getId(), orderId);
                    continue;
                }
                final TriggerEntity captured = trg;
                requiresNewTx.executeWithoutResult(status -> fireOne(captured, orderId));
            } catch (Exception e) {
                log.error("op=trigger.fire outcome=error triggerId={} orderId={}",
                        trg.getId(), orderId, e);
            }
        }
    }

    private void fireOne(TriggerEntity trg, UUID orderId) {
        var order = orders.findById(orderId).orElseThrow(
                () -> new IllegalArgumentException("Order not found: " + orderId));
        UUID clientId = order.getClientId();

        JsonNode channelsNode;
        try {
            channelsNode = json.readTree(trg.getChannels());
        } catch (Exception e) {
            log.error("op=trigger.fire outcome=channels_parse_error triggerId={}", trg.getId(), e);
            return;
        }
        if (!channelsNode.isArray()) {
            log.warn("op=trigger.fire outcome=channels_not_array triggerId={}", trg.getId());
            return;
        }
        for (JsonNode chNode : channelsNode) {
            String channel = chNode.asText();
            router.sendForTrigger(orderId, clientId, trg.getTemplateId(), trg.getId(), channel);
        }
    }
}
