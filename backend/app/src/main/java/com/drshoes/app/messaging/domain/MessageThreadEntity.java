package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
@Entity
@Table(name = "message_thread")
@Getter
@Setter
public class MessageThreadEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "client_id", columnDefinition = "uuid")
    private UUID clientId;
    @Column(columnDefinition = "text")
    private String subject;
    @Column(nullable = false, length = 16)
    @jakarta.validation.constraints.NotNull
    private String channel = "EMAIL";
    @Column(name = "raw_sender", length = 255)
    private String rawSender;
    @Column(name = "discarded_at")
    private OffsetDateTime discardedAt;

    @Column(name = "last_message_at")
    private OffsetDateTime lastMessageAt;

    @Column(name = "unread_count", nullable = false)
    private int unreadCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    public MessageThreadEntity() {}
    public void setClientId(UUID clientId) { this.clientId = clientId; }
    public void setLastMessageAt(OffsetDateTime lastMessageAt) { this.lastMessageAt = lastMessageAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setRawSender(String rawSender) { this.rawSender = rawSender; }
}
