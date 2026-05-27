package com.drshoes.app.messaging.domain;

import com.drshoes.lib.messaging.Provider;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Forensic log of every inbound webhook callback from Postmark / SMSAPI.
 * Supports state-guarded dedupe: UNIQUE(provider, provider_event_id) WHERE NOT NULL.
 * Also stores events where no transition was applied (DEDUP, DROPPED, NO_MESSAGE, etc.)
 * for operational observability.
 *
 * <p>Fields are intentionally mutable (no @Immutable) so the reconciler can
 * UPDATE applied_outcome from PROCESSING → final value in a two-phase flow if needed.</p>
 */
@Entity
@Table(name = "webhook_event")
@Getter
@Setter
public class WebhookEventEntity {

    /** Mirrors the CHECK constraint in V010. */
    public enum AppliedStatus { DELIVERED, FAILED }

    /** Mirrors the CHECK constraint in V010 (includes PROCESSING — plan errata §1). */
    public enum AppliedOutcome {
        APPLIED, DEDUP, NO_MESSAGE, NO_TRANSITION, DROPPED, PROCESSING
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Provider provider;

    @Column(name = "provider_event_id", length = 120)
    private String providerEventId;

    @Column(name = "provider_message_id", length = 120)
    private String providerMessageId;

    /** FK to message.id — nullable; ON DELETE SET NULL in schema. */
    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    /** NULL when outcome is DROPPED (no delivery decision made). */
    @Enumerated(EnumType.STRING)
    @Column(name = "applied_status", length = 16)
    private AppliedStatus appliedStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "applied_outcome", nullable = false, length = 20)
    private AppliedOutcome appliedOutcome;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload", nullable = false, columnDefinition = "jsonb")
    private JsonNode rawPayload;

    @Column(name = "error_code", length = 60)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "received_at", nullable = false, updatable = false)
    private Instant receivedAt;

    @Column(name = "applied_at")
    private Instant appliedAt;

    // ---- getters / setters ----
    public void setProviderEventId(String providerEventId) { this.providerEventId = providerEventId; }
    public void setMessageId(UUID messageId) { this.messageId = messageId; }
    public void setAppliedStatus(AppliedStatus appliedStatus) { this.appliedStatus = appliedStatus; }
    public void setRawPayload(JsonNode rawPayload) { this.rawPayload = rawPayload; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public void setAppliedAt(Instant appliedAt) { this.appliedAt = appliedAt; }
}
