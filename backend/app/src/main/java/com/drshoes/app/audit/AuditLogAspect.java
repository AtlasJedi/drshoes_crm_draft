package com.drshoes.app.audit;

import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

/**
 * AOP aspect that intercepts all public controller methods and writes an audit row.
 *
 * Transaction: REQUIRES_NEW — the audit write commits independently so evidence of
 * failed requests (e.g. bad-credential login → 401) is preserved even when the
 * audited operation's own transaction rolls back.
 *
 * PII: IP is persisted (acceptable security event per RODO exception for security logs).
 * Passwords, hashes, and session IDs are never stored or logged.
 *
 * Logging: one INFO line per intercepted request (op=audit actor=... outcome=persisted),
 * WARN on DB failure (never lets audit failure crash the request).
 */
@Aspect
@Component
public class AuditLogAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditLogAspect.class);

    private final AuditLogWriter writer;

    public AuditLogAspect(AuditLogWriter writer) {
        this.writer = writer;
    }

    @Around("execution(public * com.drshoes.app..api..*Controller.*(..))")
    public Object audit(ProceedingJoinPoint pjp) throws Throwable {
        var attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        Object out;
        int status = 200;
        try {
            out = pjp.proceed();
            if (out instanceof ResponseEntity<?> re) status = re.getStatusCode().value();
        } catch (RuntimeException e) {
            status = 500;
            persist(attrs, status);
            throw e;
        }
        persist(attrs, status);
        return out;
    }

    private void persist(ServletRequestAttributes attrs, int status) {
        if (attrs == null) return;
        HttpServletRequest r = attrs.getRequest();
        String actor = resolveActor();
        try {
            writer.write(r.getMethod(), r.getRequestURI(), status,
                         r.getRemoteAddr(), r.getHeader("User-Agent"));
            log.info("op=audit actor={} method={} path={} status={} outcome=persisted",
                     actor, r.getMethod(), r.getRequestURI(), status);
        } catch (Exception ex) {
            log.warn("op=audit actor={} method={} path={} status={} outcome=skipped reason={}",
                     actor, r.getMethod(), r.getRequestURI(), status, ex.getMessage());
        }
    }

    private static String resolveActor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "anonymous";
    }
}
