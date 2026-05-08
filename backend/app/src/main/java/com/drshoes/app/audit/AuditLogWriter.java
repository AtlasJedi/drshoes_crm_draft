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
 */
@Component
public class AuditLogWriter {

    private final EntityManager em;

    public AuditLogWriter(EntityManager em) {
        this.em = em;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String method, String path, int status, String ip, String userAgent) {
        em.createNativeQuery("""
            INSERT INTO audit_log (id, method, path, status, ip, user_agent, request_id, created_at)
            VALUES (:id, :method, :path, :status, CAST(:ip AS inet), :userAgent, :requestId, :createdAt)
            """)
            .setParameter("id", UUID.randomUUID())
            .setParameter("method", method)
            .setParameter("path", path)
            .setParameter("status", status)
            .setParameter("ip", ip)
            .setParameter("userAgent", userAgent)
            .setParameter("requestId", UUID.randomUUID())
            .setParameter("createdAt", Instant.now())
            .executeUpdate();
    }
}
