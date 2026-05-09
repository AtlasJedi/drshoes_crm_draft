package com.drshoes.app.messaging.service;

import com.drshoes.lib.messaging.DeliveryStatus;

import java.util.UUID;

/**
 * Immutable result of {@link WebhookStatusReconciler#apply}.
 *
 * @param outcome       what happened (APPLIED, DEDUP, NO_MESSAGE, etc.)
 * @param appliedStatus the delivery status written to the message row,
 *                      or null when outcome is not APPLIED
 * @param messageId     UUID of the matched message row, or null when
 *                      outcome is NO_MESSAGE or DROPPED
 */
public record ReconcileResult(
        AppliedOutcome outcome,
        DeliveryStatus appliedStatus,
        UUID messageId) {

    public static ReconcileResult applied(DeliveryStatus status, UUID messageId) {
        return new ReconcileResult(AppliedOutcome.APPLIED, status, messageId);
    }

    public static ReconcileResult of(AppliedOutcome outcome) {
        return new ReconcileResult(outcome, null, null);
    }
}
