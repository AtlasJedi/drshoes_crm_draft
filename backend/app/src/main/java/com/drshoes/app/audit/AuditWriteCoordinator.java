package com.drshoes.app.audit;

import com.drshoes.app.auth.principal.AdminPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Component
@Slf4j
@RequiredArgsConstructor
public class AuditWriteCoordinator {

    private final AuditLogWriter writer;
    private final AuditSpanHelper spanHelper;
    public void persistHttp(HttpServletRequest r, int status) {
        persistHttp(r, status, null, null, null);
    }
    public void persistHttp(HttpServletRequest r, int status, String note) {
        persistHttp(r, status, note, null, null);
    }
    public void persistHttp(HttpServletRequest r, int status, String note,
                            String locationFrom, String locationTo) {
        String targetStatus = (String) r.getAttribute("audit.targetStatus");
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
                    null, actorId, traceId, note, locationFrom, locationTo, targetStatus));
            log.info("op=audit actor={} actorId={} method={} path={} status={} traceId={} hasNote={} hasLocationDiff={} targetStatus={} outcome=persisted",
                actorName, actorId, method, path, status, traceId, note != null,
                locationFrom != null || locationTo != null, targetStatus);
        } catch (Exception ex) {
            log.warn("op=audit actor={} method={} path={} status={} outcome=skipped reason={}",
                actorName, method, path, status, ex.getMessage());
        }
    }
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

    static String extractEntityType(String path) {
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
