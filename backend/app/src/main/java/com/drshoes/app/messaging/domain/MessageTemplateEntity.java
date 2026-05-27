package com.drshoes.app.messaging.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
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
    @Column(nullable = false, length = 16)
    private String channel;
    @Column(columnDefinition = "text")
    private String subject;

    @Column(nullable = false, columnDefinition = "text")
    private String body;
    @Column(name = "body_html", columnDefinition = "text")
    private String bodyHtml;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    public MessageTemplateEntity() {}
    public void setChannel(String channel) { this.channel = channel; }
    public void setBody(String body) { this.body = body; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
