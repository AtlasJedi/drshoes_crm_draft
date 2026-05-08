package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA entity for the message_thread table.
 *
 * Design notes:
 *   - clientId is a raw UUID (aggregate boundary — no @ManyToOne).
 *   - lastMessageAt is nullable (thread may have no messages yet in practice).
 *   - createdAt / updatedAt managed by DB trigger; insertable=false, updatable=false.
 */
@Entity
@Table(name = "message_thread")
public class MessageThreadEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "client_id", nullable = false, columnDefinition = "uuid")
    private UUID clientId;

    /** Carried from the latest email subject; nullable. */
    @Column(columnDefinition = "text")
    private String subject;

    @Column(name = "last_message_at")
    private OffsetDateTime lastMessageAt;

    @Column(name = "unread_count", nullable = false)
    private int unreadCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    public MessageThreadEntity() {}

    // ---- accessors ----

    public UUID getId() { return id; }

    public UUID getClientId() { return clientId; }
    public void setClientId(UUID clientId) { this.clientId = clientId; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public OffsetDateTime getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(OffsetDateTime lastMessageAt) { this.lastMessageAt = lastMessageAt; }

    public int getUnreadCount() { return unreadCount; }
    public void setUnreadCount(int unreadCount) { this.unreadCount = unreadCount; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
