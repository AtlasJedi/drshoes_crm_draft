package com.drshoes.app.audit;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Persists a single audit row in its own transaction (Propagation.REQUIRES_NEW).
 *
 * Uses a native insert with an explicit ::inet cast to avoid Hibernate's type
 * binding limitation — Hibernate 6 cannot bind a Java String to a Postgres inet
 * column without a custom UserType or PGobject. The native query bypasses that
 * and lets Postgres handle the cast directly.
 *
 * Deviation from plan: plan used repo.save(); native query used instead for
 * inet cast. Documented in dispatch log 0b-8.
 *
 * M3 (task 3-3): actorId is now accepted as a parameter so that audit_log.actor_id
 * is populated for every admin request once AdminPrincipal is in the SecurityContext.
 */
@Component
public class AuditLogWriter {

    private final EntityManager em;

    public AuditLogWriter(EntityManager em) {
        this.em = em;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent) {
        write(method, path, status, ip, userAgent, null, null);
    }

    /**
     * Variant that also persists parent_entity_id (populated by @Audited SpEL).
     * When parentEntityId is null the column is left NULL in the row.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId) {
        write(method, path, status, ip, userAgent, parentEntityId, null);
    }

    /**
     * Full variant: persists both parent_entity_id and actor_id.
     * actorId comes from AdminPrincipal.userId() resolved in AuditLogAspect.
     * Delegates to the 8-param overload with null traceId for backward compatibility.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId) {
        write(method, path, status, ip, userAgent, parentEntityId, actorId, null);
    }

    /**
     * Full variant with traceId: persists parent_entity_id, actor_id, and OTel trace_id.
     * traceId is the 32-char lowercase hex W3C trace ID; pass null when no span context is present.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId, String traceId) {
        em.createNativeQuery("""
            INSERT INTO audit_log
                (id, actor_id, method, path, status, ip, user_agent, request_id,
                 created_at, parent_entity_id, trace_id)
            VALUES
                (:id, :actorId, :method, :path, :status, CAST(:ip AS inet), :userAgent, :requestId,
                 :createdAt, :parentEntityId, :traceId)
            """)
            .setParameter("id", UUID.randomUUID())
            .setParameter("actorId", actorId)
            .setParameter("method", method)
            .setParameter("path", path)
            .setParameter("status", status)
            .setParameter("ip", ip)
            .setParameter("userAgent", userAgent)
            .setParameter("requestId", UUID.randomUUID())
            .setParameter("createdAt", Instant.now())
            .setParameter("parentEntityId", parentEntityId)
            .setParameter("traceId", traceId)
            .executeUpdate();
    }
}
