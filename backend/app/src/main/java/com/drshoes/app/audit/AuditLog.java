package com.drshoes.app.audit;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "actor_id", columnDefinition = "uuid")
    private UUID actorId;

    @Column(nullable = false, length = 10)
    private String method;

    @Column(nullable = false, length = 255)
    private String path;

    @Column(nullable = false)
    private int status;

    @Column(columnDefinition = "inet")
    @Convert(converter = InetAddressConverter.class)
    private String ip;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "request_id", columnDefinition = "uuid")
    private UUID requestId;

    @Column(name = "body_hash", length = 64)
    private String bodyHash;
    @Column(name = "parent_entity_id")
    private UUID parentEntityId;
    @Column(name = "trace_id", length = 32)
    private String traceId;
    @Column(name = "note", columnDefinition = "TEXT")
    private String note;
    @Column(name = "location_from", length = 64)
    private String locationFrom;
    @Column(name = "location_to", length = 64)
    private String locationTo;
    @Column(name = "target_status", length = 32)
    private String targetStatus;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    public UUID getId() { return id; }
    public UUID getActorId() { return actorId; }
    public String getMethod() { return method; }
    public String getPath() { return path; }
    public int getStatus() { return status; }
    public void setActorId(UUID actorId) { this.actorId = actorId; }
    public void setMethod(String method) { this.method = method; }
    public void setPath(String path) { this.path = path; }
    public void setStatus(int status) { this.status = status; }
    public void setIp(String ip) { this.ip = ip; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public void setRequestId(UUID requestId) { this.requestId = requestId; }
    public void setBodyHash(String bodyHash) { this.bodyHash = bodyHash; }
    public UUID getParentEntityId() { return parentEntityId; }
    public void setParentEntityId(UUID parentEntityId) { this.parentEntityId = parentEntityId; }
    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getLocationFrom() { return locationFrom; }
    public void setLocationFrom(String locationFrom) { this.locationFrom = locationFrom; }
    public String getLocationTo() { return locationTo; }
    public void setLocationTo(String locationTo) { this.locationTo = locationTo; }
    public String getTargetStatus() { return targetStatus; }
    public void setTargetStatus(String targetStatus) { this.targetStatus = targetStatus; }
    public Instant getCreatedAt() { return createdAt; }
}
