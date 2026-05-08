package com.drshoes.app.audit;

import java.lang.annotation.*;

/**
 * Marker annotation for AOP pointcut — methods annotated with @Audited
 * will have their invocations recorded in the audit_log table.
 * Currently the AuditLogAspect also intercepts all controller methods
 * via execution pointcut; this annotation enables fine-grained opt-in auditing.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {}
