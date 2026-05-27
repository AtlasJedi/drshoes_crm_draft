package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

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
@Getter
@Setter
public class MessageThreadEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "client_id", columnDefinition = "uuid")
    private UUID clientId;

    /** Carried from the latest email subject; nullable. */
    @Column(columnDefinition = "text")
    private String subject;

    /** EMAIL / SMS / WHATSAPP — per-channel threading. Added V012. */
    @Column(nullable = false, length = 16)
    @jakarta.validation.constraints.NotNull
    private String channel = "EMAIL";

    /** Null for matched threads (client known). Set for unmatched inbound threads. Added V012. */
    @Column(name = "raw_sender", length = 255)
    private String rawSender;

    /** Non-null when operator has discarded this unmatched thread. Added V012. */
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

    // ---- accessors ----
    public void setClientId(UUID clientId) { this.clientId = clientId; }
    public void setLastMessageAt(OffsetDateTime lastMessageAt) { this.lastMessageAt = lastMessageAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setRawSender(String rawSender) { this.rawSender = rawSender; }
}
