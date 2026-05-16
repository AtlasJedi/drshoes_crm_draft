package com.drshoes.app.audit;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * JPA entity mapped to the audit_log table (created by V001__init.sql).
 * Records every audited HTTP request: actor, method, path, status, IP.
 * PII discipline: IP is persisted (acceptable security event per RODO exception);
 * passwords, hashes, and session IDs are never stored or logged.
 *
 * Note: the ip column is type inet in Postgres. Writes use a native query
 * in AuditLogWriter with CAST(:ip AS inet). Reads map back as String via
 * Postgres JDBC returning the inet value as its text representation.
 */
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

    /** Populated by @Audited(parent=...) SpEL evaluation. Links child-entity ops to their parent. */
    @Column(name = "parent_entity_id")
    private UUID parentEntityId;

    /**
     * OpenTelemetry trace ID captured at the time of the audit event.
     * 32-char lowercase hex string (128-bit trace ID per W3C traceparent spec).
     * NULL when no active span context is present (background jobs, startup hooks).
     */
    @Column(name = "trace_id", length = 32)
    private String traceId;

    /**
     * Optional free-text note provided by the operator at the time of the action.
     * Populated only for STATUS_CHANGED rows where the operator filled the note field.
     * Max 1000 characters (enforced via @Size on ChangeStatusRequest.note).
     * Added by V015 migration (M8 task m8-fb-1b).
     */
    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    /**
     * Previous storage location of the order before a location move.
     * NULL when the audit row is not a location-change event.
     * Added by V020 migration (M10 task 10-5).
     */
    @Column(name = "location_from", length = 64)
    private String locationFrom;

    /**
     * New storage location of the order after a location move.
     * NULL when the audit row is not a location-change event.
     * Added by V020 migration (M10 task 10-5).
     */
    @Column(name = "location_to", length = 64)
    private String locationTo;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    // getters/setters
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
    public Instant getCreatedAt() { return createdAt; }
}
