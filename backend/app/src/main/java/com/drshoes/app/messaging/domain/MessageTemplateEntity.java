package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

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
@Getter
@Setter
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

    /** HTML body for multipart/alternative emails. Null for SMS/WhatsApp templates. */
    @Column(name = "body_html", columnDefinition = "text")
    private String bodyHtml;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    public MessageTemplateEntity() {}

    // ---- accessors ----
    public void setChannel(String channel) { this.channel = channel; }
    public void setBody(String body) { this.body = body; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
