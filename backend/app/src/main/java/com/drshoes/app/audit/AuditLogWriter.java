package com.drshoes.app.audit;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
@Component
@RequiredArgsConstructor
public class AuditLogWriter {

    private final EntityManager em;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent) {
        write(method, path, status, ip, userAgent, null, null);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId) {
        write(method, path, status, ip, userAgent, parentEntityId, null);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId) {
        write(method, path, status, ip, userAgent, parentEntityId, actorId, null);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId, String traceId) {
        write(method, path, status, ip, userAgent, parentEntityId, actorId, traceId, null);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId, String traceId, String note) {
        write(method, path, status, ip, userAgent, parentEntityId, actorId, traceId, note, null, null);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent,
                      UUID parentEntityId, UUID actorId, String traceId, String note,
                      String locationFrom, String locationTo) {
        write(method, path, status, ip, userAgent, parentEntityId, actorId, traceId, note,
              locationFrom, locationTo, null);
    }
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
