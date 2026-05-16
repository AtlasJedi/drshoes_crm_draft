package com.drshoes.app.audit;

import com.drshoes.app.auth.principal.AdminPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.UUID;

/**
 * Coordinates the actual persistence of audit rows by combining:
 * - traceId capture via AuditSpanHelper.currentTraceId()
 * - span wrapping via AuditSpanHelper.writeWithSpan()
 * - row persistence via AuditLogWriter
 *
 * Extracted from AuditLogAspect to keep that class under 120 LOC
 * after OTel tracing logic was added (task 8-7).
 *
 * Logging: one INFO per persisted row; WARN on any write failure
 * (never lets audit failure crash the caller).
 */
@Component
public class AuditWriteCoordinator {

    private static final Logger log = LoggerFactory.getLogger(AuditWriteCoordinator.class);

    private final AuditLogWriter writer;
    private final AuditSpanHelper spanHelper;

    public AuditWriteCoordinator(AuditLogWriter writer, AuditSpanHelper spanHelper) {
        this.writer = writer;
        this.spanHelper = spanHelper;
    }

    /** Persists an HTTP audit row, capturing the active OTel trace ID. */
    public void persistHttp(HttpServletRequest r, int status) {
        persistHttp(r, status, null, null, null);
    }

    /**
     * Persists an HTTP audit row with an optional note.
     * note is extracted from method args by AuditLogAspect when a HasAuditNote arg is present.
     */
    public void persistHttp(HttpServletRequest r, int status, String note) {
        persistHttp(r, status, note, null, null);
    }

    /**
     * Persists an HTTP audit row with an optional note and optional location diff.
     * locationFrom/locationTo come from request attributes set by OrderNotesController
     * after the service call computes the old/new location. Both null for all other endpoints.
     */
    public void persistHttp(HttpServletRequest r, int status, String note,
                            String locationFrom, String locationTo) {
        String actorName = resolveActorName();
        UUID actorId = resolveActorId();
        String traceId = spanHelper.currentTraceId();
        String path = r.getRequestURI();
        String method = r.getMethod();
        try {
            spanHelper.writeWithSpan(method + " " + path, extractEntityType(path),
                null, actorName,
                () -> writer.write(method, path, status,
                    r.getRemoteAddr(), r.getHeader("User-Agent"),
                    null, actorId, traceId, note, locationFrom, locationTo));
            log.info("op=audit actor={} actorId={} method={} path={} status={} traceId={} hasNote={} hasLocationDiff={} outcome=persisted",
                actorName, actorId, method, path, status, traceId, note != null,
                locationFrom != null || locationTo != null);
        } catch (Exception ex) {
            log.warn("op=audit actor={} method={} path={} status={} outcome=skipped reason={}",
                actorName, method, path, status, ex.getMessage());
        }
    }

    /** Persists an @Audited service-method audit row, capturing the active OTel trace ID. */
    public void persistAnnotated(Method method, UUID parentId) {
        String actorName = resolveActorName();
        UUID actorId = resolveActorId();
        String traceId = spanHelper.currentTraceId();
        String syntheticPath = method.getDeclaringClass().getSimpleName() + "#" + method.getName();
        try {
            spanHelper.writeWithSpan("INTERNAL " + syntheticPath, "internal",
                null, actorName,
                () -> writer.write("INTERNAL", syntheticPath, 0, null, null,
                    parentId, actorId, traceId));
            log.info("op=auditAnnotated actor={} actorId={} target={} parentEntityId={} traceId={} outcome=persisted",
                actorName, actorId, syntheticPath, parentId, traceId);
        } catch (Exception ex) {
            log.warn("op=auditAnnotated actor={} target={} outcome=skipped reason={}",
                actorName, syntheticPath, ex.getMessage());
        }
    }

    // ---- private helpers ----

    static String extractEntityType(String path) {
        // e.g. /api/admin/orders/uuid -> "orders", /api/admin/clients -> "clients"
        if (path == null) return "unknown";
        String[] parts = path.split("/");
        for (int i = parts.length - 1; i >= 0; i--) {
            String p = parts[i];
            if (!p.isBlank() && !p.matches("[0-9a-f\\-]{36}")
                && !p.equals("api") && !p.equals("admin")) {
                return p;
            }
        }
        return "unknown";
    }

    private static String resolveActorName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "anonymous";
    }

    private static UUID resolveActorId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
            && auth.getPrincipal() instanceof AdminPrincipal p) {
            return p.userId();
        }
        return null;
    }

    /**
     * Scans joinpoint args for the first {@link HasAuditNote} instance and returns its note.
     * Returns null if no arg implements HasAuditNote or the note itself is null/blank.
     */
    static String extractNote(Object[] args) {
        if (args == null) return null;
        for (Object arg : args) {
            if (arg instanceof HasAuditNote h) {
                String n = h.auditNote();
                return (n != null && !n.isBlank()) ? n : null;
            }
        }
        return null;
    }
}
