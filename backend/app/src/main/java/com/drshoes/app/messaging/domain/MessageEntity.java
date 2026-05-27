package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * JPA entity for the message table.
 *
 * Design notes:
 *   - direction and channel stored as String for forward-compat with DB CHECK constraints.
 *   - deliveryStatus stored as String; default "QUEUED" to match DB DEFAULT.
 *   - scheduledMessageId is intentionally omitted — V001 reserved the FK but no M2 service
 *     writes to it. Left out entirely to keep the entity clean; add in M3 when needed.
 *   - threadId / clientId / orderId are raw UUIDs (aggregate boundaries).
 *   - attachments stored as raw JSON string (JSONB column); deserialization at service boundary.
 *   - createdAt managed by DB DEFAULT; insertable=false, updatable=false.
 *   - No updatedAt on message table (append-only per V001 schema).
 */
@Entity
@Table(name = "message")
@Getter
@Setter
public class MessageEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "thread_id", nullable = false, columnDefinition = "uuid")
    private UUID threadId;

    @Column(name = "order_id", columnDefinition = "uuid")
    private UUID orderId;

    @Column(name = "client_id", columnDefinition = "uuid")
    private UUID clientId;

    /** Null for matched messages (client known). Set for unmatched inbound messages. Added V012. */
    @Column(name = "raw_sender", length = 255)
    private String rawSender;

    /** OUTBOUND or INBOUND — raw String for forward-compat with DB CHECK constraint. */
    @Column(nullable = false, length = 10)
    private String direction;

    /** EMAIL / SMS / WHATSAPP — raw String for forward-compat. */
    @Column(nullable = false, length = 16)
    private String channel;

    @Column(name = "template_id", columnDefinition = "uuid")
    private UUID templateId;

    @Column(name = "trigger_id", columnDefinition = "uuid")
    private UUID triggerId;

    @Column(columnDefinition = "text")
    private String subject;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    /** Rendered HTML body for multipart/alternative emails. Null for SMS/WhatsApp messages. */
    @Column(name = "body_html", columnDefinition = "text")
    private String bodyHtml;

    /** JSONB column — array of s3_keys; raw JSON string. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String attachments = "[]";

    /** QUEUED / SENT / DELIVERED / FAILED / READ — raw String for forward-compat. */
    @Column(name = "delivery_status", nullable = false, length = 16)
    private String deliveryStatus = "QUEUED";

    @Column(name = "provider_message_id", length = 120)
    private String providerMessageId;

    @Column(name = "error_code", length = 60)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    @Column(name = "read_at")
    private OffsetDateTime readAt;

    /** Null for inbound and trigger-fired messages. */
    @Column(name = "sent_by", columnDefinition = "uuid")
    private UUID sentBy;

    /** V010: FK to the original message that this row retried. Null for original sends. */
    @Column(name = "retry_of_message_id", columnDefinition = "uuid")
    private UUID retryOfMessageId;

    /** V010: Attempt count. Defaults to 1 for all original sends. */
    @Column(name = "retry_attempt", nullable = false)
    private Integer retryAttempt = 1;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    protected MessageEntity() {}

    /**
     * Factory for use by services in other packages.
     * Constructor remains {@code protected} to match the project convention for
     * JPA entity no-arg constructors (all other entities: TriggerEntity,
     * TriggerFireEntity, MessageTemplateEntity use {@code protected}).
     */
    public static MessageEntity newMessage() {
        return new MessageEntity();
    }

    // ---- accessors ----
    public void setThreadId(UUID threadId) { this.threadId = threadId; }
    public void setClientId(UUID clientId) { this.clientId = clientId; }
    public void setDirection(String direction) { this.direction = direction; }
    public void setTemplateId(UUID templateId) { this.templateId = templateId; }
    public void setSubject(String subject) { this.subject = subject; }
    public void setBodyHtml(String bodyHtml) { this.bodyHtml = bodyHtml; }
    public void setDeliveryStatus(String deliveryStatus) { this.deliveryStatus = deliveryStatus; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
    public void setSentAt(OffsetDateTime sentAt) { this.sentAt = sentAt; }
    public void setReadAt(OffsetDateTime readAt) { this.readAt = readAt; }
    public void setRetryOfMessageId(UUID retryOfMessageId) { this.retryOfMessageId = retryOfMessageId; }
}
