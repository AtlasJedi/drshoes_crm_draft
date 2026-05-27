package com.drshoes.app.audit;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;

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
@RequiredArgsConstructor
public class AuditLogWriter {

    private final EntityManager em;

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
     * Delegates to the 9-param overload with null note for backward compatibility.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId, String traceId) {
        write(method, path, status, ip, userAgent, parentEntityId, actorId, traceId, null);
    }

    /**
     * Full variant with note: persists all fields including the operator's free-text note.
     * note is stored in audit_log.note (TEXT NULL, added by V015 migration).
     * Pass null when no note is present (all non-status-change audit rows).
     * Delegates to the 11-param overload with null location fields for backward compatibility.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId, String traceId, String note) {
        write(method, path, status, ip, userAgent, parentEntityId, actorId, traceId, note, null, null);
    }

    /**
     * Full variant with location diff: persists all fields including optional location move.
     * locationFrom/locationTo are stored in audit_log.location_from/location_to (VARCHAR(64) NULL,
     * added by V020 migration, M10 task 10-5). Both null for non-location-change rows.
     * Delegates to the 12-param overload with null targetStatus for backward compatibility.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId, String traceId, String note,
                      String locationFrom, String locationTo) {
        write(method, path, status, ip, userAgent, parentEntityId, actorId, traceId, note,
              locationFrom, locationTo, null);
    }

    /**
     * Full variant with targetStatus: persists all fields including the status-change target.
     * targetStatus is stored in audit_log.target_status (VARCHAR(32) NULL, added by V027
     * migration, v2-F task). NULL for all non-status-change audit rows.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId, String traceId, String note,
                      String locationFrom, String locationTo, String targetStatus) {
        em.createNativeQuery("""
            INSERT INTO audit_log
                (id, actor_id, method, path, status, ip, user_agent, request_id,
                 created_at, parent_entity_id, trace_id, note, location_from, location_to,
                 target_status)
            VALUES
                (:id, :actorId, :method, :path, :status, CAST(:ip AS inet), :userAgent, :requestId,
                 :createdAt, :parentEntityId, :traceId, :note, :locationFrom, :locationTo,
                 :targetStatus)
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
            .setParameter("note", note)
            .setParameter("locationFrom", locationFrom)
            .setParameter("locationTo", locationTo)
            .setParameter("targetStatus", targetStatus)
            .executeUpdate();
    }
}
