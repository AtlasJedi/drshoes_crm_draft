package com.drshoes.app.audit;

import com.drshoes.app.auth.principal.AdminPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.util.UUID;

/**
 * AOP aspect with two responsibilities:
 *
 * 1. Controller audit (existing): intercepts all public controller methods and writes
 *    an audit row per HTTP request. Transaction REQUIRES_NEW ensures audit persists
 *    even when the wrapped operation rolls back.
 *
 * 2. @Audited service audit (new): intercepts methods annotated with @Audited, evaluates
 *    the parent() SpEL expression (via AuditedParentResolver) to obtain a parent UUID,
 *    and writes an audit row that links the operation to its parent entity.
 *
 * PII: IP is persisted (acceptable security event per RODO exception for security logs).
 * Passwords, hashes, and session IDs are never stored or logged.
 *
 * Logging: one INFO line per intercepted call (op=audit actor=... outcome=persisted),
 * WARN on DB or SpEL failure (never lets audit failure crash the wrapped method).
 */
@Aspect
@Component
public class AuditLogAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditLogAspect.class);

    private final AuditLogWriter writer;
    private final AuditedParentResolver parentResolver;

    public AuditLogAspect(AuditLogWriter writer, AuditedParentResolver parentResolver) {
        this.writer = writer;
        this.parentResolver = parentResolver;
    }

    // Exclude @ExceptionHandler methods: when the primary handler throws, the aspect
    // already logs status=500 and rethrows; Spring MVC then dispatches to the
    // exception handler, which would be intercepted again and produce a second row
    // with the actual response status (e.g. 401). Two rows per failed request — the
    // 500 one is factually wrong. The pointcut now matches only the primary handler;
    // the catch block in audit() captures the correct status mapping for failures.
    @Around("execution(public * com.drshoes.app..api..*Controller.*(..)) "
        + "&& !@annotation(org.springframework.web.bind.annotation.ExceptionHandler)")
    public Object audit(ProceedingJoinPoint pjp) throws Throwable {
        var attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        Object out;
        int status = 200;
        try {
            out = pjp.proceed();
            if (out instanceof ResponseEntity<?> re) status = re.getStatusCode().value();
        } catch (RuntimeException e) {
            status = 500;
            persistHttp(attrs, status);
            throw e;
        }
        persistHttp(attrs, status);
        return out;
    }

    /**
     * Intercepts service methods annotated with @Audited. Evaluates the parent()
     * SpEL expression after successful return to populate parent_entity_id.
     * If SpEL fails, the audit row still writes with parent_entity_id = null.
     * If the wrapped method throws, no audit row is written (exception propagates).
     */
    @Around("@annotation(audited)")
    public Object auditAnnotated(ProceedingJoinPoint pjp, Audited audited) throws Throwable {
        Object out = pjp.proceed();   // let exceptions propagate — no row on failure
        Method method = ((MethodSignature) pjp.getSignature()).getMethod();
        UUID parentId = parentResolver.resolve(method, pjp.getArgs(), audited.parent());
        persistAnnotated(method, parentId);
        return out;
    }

    // ---- private helpers ----

    private void persistHttp(ServletRequestAttributes attrs, int status) {
        if (attrs == null) return;
        HttpServletRequest r = attrs.getRequest();
        String actorName = resolveActorName();
        UUID actorId = resolveActorId();
        try {
            writer.write(r.getMethod(), r.getRequestURI(), status,
                         r.getRemoteAddr(), r.getHeader("User-Agent"), null, actorId);
            log.info("op=audit actor={} actorId={} method={} path={} status={} outcome=persisted",
                     actorName, actorId, r.getMethod(), r.getRequestURI(), status);
        } catch (Exception ex) {
            log.warn("op=audit actor={} method={} path={} status={} outcome=skipped reason={}",
                     actorName, r.getMethod(), r.getRequestURI(), status, ex.getMessage());
        }
    }

    private void persistAnnotated(Method method, UUID parentId) {
        String actorName = resolveActorName();
        UUID actorId = resolveActorId();
        String syntheticPath = method.getDeclaringClass().getSimpleName() + "#" + method.getName();
        try {
            writer.write("INTERNAL", syntheticPath, 0, null, null, parentId, actorId);
            log.info("op=auditAnnotated actor={} actorId={} target={} parentEntityId={} outcome=persisted",
                     actorName, actorId, syntheticPath, parentId);
        } catch (Exception ex) {
            log.warn("op=auditAnnotated actor={} target={} outcome=skipped reason={}",
                     actorName, syntheticPath, ex.getMessage());
        }
    }

    private static String resolveActorName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "anonymous";
    }

    /**
     * Resolves the actor's UUID from the current SecurityContext.
     * Returns the userId if the principal is an AdminPrincipal, null otherwise
     * (e.g. anonymous requests, login endpoint, or legacy String principals).
     */
    private static UUID resolveActorId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && auth.getPrincipal() instanceof AdminPrincipal p) {
            return p.userId();
        }
        return null;
    }
}
