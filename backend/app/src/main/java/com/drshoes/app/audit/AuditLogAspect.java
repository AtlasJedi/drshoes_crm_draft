package com.drshoes.app.audit;

import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.util.UUID;

/**
 * AOP aspect with two responsibilities:
 *
 * 1. Controller audit: intercepts all public controller methods and writes
 *    an audit row per HTTP request. Transaction REQUIRES_NEW ensures audit persists
 *    even when the wrapped operation rolls back.
 *
 * 2. @Audited service audit: intercepts methods annotated with @Audited, evaluates
 *    the parent() SpEL expression (via AuditedParentResolver) to obtain a parent UUID,
 *    and writes an audit row that links the operation to its parent entity.
 *
 * Persistence + OTel span logic delegated to AuditWriteCoordinator (task 8-7 extraction).
 *
 * PII: IP is persisted (acceptable security event per RODO exception for security logs).
 * Passwords, hashes, and session IDs are never stored or logged.
 *
 * Excludes @ExceptionHandler methods: only one audit row per failed request.
 */
@Aspect
@Component
public class AuditLogAspect {

    private final AuditedParentResolver parentResolver;
    private final AuditWriteCoordinator coordinator;

    public AuditLogAspect(AuditedParentResolver parentResolver,
                          AuditWriteCoordinator coordinator) {
        this.parentResolver = parentResolver;
        this.coordinator = coordinator;
    }

    // Exclude @ExceptionHandler methods: when the primary handler throws, the aspect
    // already logs status=500 and rethrows; Spring MVC then dispatches to the
    // exception handler, which would be intercepted again and produce a second row
    // with the actual response status (e.g. 401). Two rows per failed request — the
    // 500 one is factually wrong. The pointcut matches only the primary handler.
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
        // Pass return value so SpEL expressions like "#result.orderId" or "#result" work.
        UUID parentId = parentResolver.resolve(method, pjp.getArgs(), out, audited.parent());
        coordinator.persistAnnotated(method, parentId);
        return out;
    }

    // ---- private helpers ----

    private void persistHttp(ServletRequestAttributes attrs, int status) {
        if (attrs == null) return;
        HttpServletRequest r = attrs.getRequest();
        coordinator.persistHttp(r, status);
    }
}
