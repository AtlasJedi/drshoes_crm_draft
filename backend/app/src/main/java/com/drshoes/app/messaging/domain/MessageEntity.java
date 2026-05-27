package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
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
    @Column(name = "raw_sender", length = 255)
    private String rawSender;
    @Column(nullable = false, length = 10)
    private String direction;
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
    @Column(name = "body_html", columnDefinition = "text")
    private String bodyHtml;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String attachments = "[]";
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
    @Column(name = "sent_by", columnDefinition = "uuid")
    private UUID sentBy;
    @Column(name = "retry_of_message_id", columnDefinition = "uuid")
    private UUID retryOfMessageId;
    @Column(name = "retry_attempt", nullable = false)
    private Integer retryAttempt = 1;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    protected MessageEntity() {}
    public static MessageEntity newMessage() {
        return new MessageEntity();
    }
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
