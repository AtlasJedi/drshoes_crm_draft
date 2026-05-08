package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA entity for the trigger_ table (messaging-automation triggers, not DB triggers).
 *
 * Design notes:
 *   - event stored as @Enumerated(EnumType.STRING) — matches DB CHECK constraint values exactly.
 *   - eventParams and channels stored as raw JSON strings (JSONB columns); deserialization is
 *     the service's responsibility (keeps entity simple).
 *   - templateId is a raw UUID aggregate-boundary reference (no @ManyToOne).
 *   - createdAt / updatedAt managed by DB trigger; insertable=false, updatable=false.
 */
@Entity
@Table(name = "trigger_")
public class TriggerEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TriggerEvent event;

    /** JSONB column — stored as raw JSON string; Jackson deserialization at service boundary. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "event_params", nullable = false, columnDefinition = "jsonb")
    private String eventParams = "{}";

    /** JSONB column — JSON array of channel strings e.g. '["EMAIL"]'. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "channels", nullable = false, columnDefinition = "jsonb")
    private String channels = "[\"EMAIL\"]";

    @Column(name = "template_id", nullable = false, columnDefinition = "uuid")
    private UUID templateId;

    @Column(name = "delay_minutes", nullable = false)
    private int delayMinutes = 0;

    @Column(name = "requires_manual_confirmation", nullable = false)
    private boolean requiresManualConfirmation = false;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    protected TriggerEntity() {}

    // ---- accessors ----

    public UUID getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }

    public TriggerEvent getEvent() { return event; }
    public void setEvent(TriggerEvent event) { this.event = event; }

    public String getEventParams() { return eventParams; }
    public void setEventParams(String eventParams) { this.eventParams = eventParams; }

    public String getChannels() { return channels; }
    public void setChannels(String channels) { this.channels = channels; }

    public UUID getTemplateId() { return templateId; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }

    public int getDelayMinutes() { return delayMinutes; }
    public void setDelayMinutes(int delayMinutes) { this.delayMinutes = delayMinutes; }

    public boolean isRequiresManualConfirmation() { return requiresManualConfirmation; }
    public void setRequiresManualConfirmation(boolean requiresManualConfirmation) {
        this.requiresManualConfirmation = requiresManualConfirmation;
    }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
