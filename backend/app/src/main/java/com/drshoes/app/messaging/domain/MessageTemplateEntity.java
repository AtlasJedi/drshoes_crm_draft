package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA entity for the message_template table.
 *
 * Design notes:
 *   - channel stored as String for forward-compat with CHECK constraint and WhatsApp.
 *   - createdAt / updatedAt are managed by DB trigger; insertable=false, updatable=false for both.
 *   - No Lombok — plain getters/setters following OrderEntity precedent.
 */
@Entity
@Table(name = "message_template")
public class MessageTemplateEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    /** EMAIL / SMS / WHATSAPP — raw String to stay compatible with DB CHECK constraint. */
    @Column(nullable = false, length = 16)
    private String channel;

    /** Nullable for SMS templates. */
    @Column(columnDefinition = "text")
    private String subject;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    protected MessageTemplateEntity() {}

    // ---- accessors ----

    public UUID getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
