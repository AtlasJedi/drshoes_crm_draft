package com.drshoes.app.messaging.service;

import com.drshoes.lib.messaging.DeliveryStatus;

import java.util.UUID;
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
