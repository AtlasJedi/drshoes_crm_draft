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
    public Instant getCreatedAt() { return createdAt; }
}
