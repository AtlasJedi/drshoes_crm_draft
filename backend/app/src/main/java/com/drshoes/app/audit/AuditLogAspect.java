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
import lombok.RequiredArgsConstructor;
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private final AuditedParentResolver parentResolver;
    private final AuditWriteCoordinator coordinator;
    @Around("execution(public * com.drshoes.app..api..*Controller.*(..)) "
        + "&& !@annotation(org.springframework.web.bind.annotation.ExceptionHandler)")
    public Object audit(ProceedingJoinPoint pjp) throws Throwable {
        var attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        Object[] args = pjp.getArgs();
        Object out;
        int status = 200;
        try {
            out = pjp.proceed();
            if (out instanceof ResponseEntity<?> re) status = re.getStatusCode().value();
        } catch (RuntimeException e) {
            status = 500;
            persistHttp(attrs, status, args);
            throw e;
        }
        persistHttp(attrs, status, args);
        return out;
    }
    @Around("@annotation(audited)")
    public Object auditAnnotated(ProceedingJoinPoint pjp, Audited audited) throws Throwable {
        Object out = pjp.proceed();
        Method method = ((MethodSignature) pjp.getSignature()).getMethod();
        UUID parentId = parentResolver.resolve(method, pjp.getArgs(), out, audited.parent());
        coordinator.persistAnnotated(method, parentId);
        return out;
    }

    private void persistHttp(ServletRequestAttributes attrs, int status, Object[] args) {
        if (attrs == null) return;
        HttpServletRequest r = attrs.getRequest();
        String note = AuditWriteCoordinator.extractNote(args);
        if (note == null) {
            note = (String) r.getAttribute("audit.diffNote");
        }
        String locationFrom = (String) r.getAttribute("audit.locationFrom");
        String locationTo   = (String) r.getAttribute("audit.locationTo");
        coordinator.persistHttp(r, status, note, locationFrom, locationTo);
    }
}
