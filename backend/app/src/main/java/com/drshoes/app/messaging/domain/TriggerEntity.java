package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
@Entity
@Table(name = "trigger_")
@Getter
@Setter
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
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "event_params", nullable = false, columnDefinition = "jsonb")
    private String eventParams = "{}";
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
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public void setEventParams(String eventParams) { this.eventParams = eventParams; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
