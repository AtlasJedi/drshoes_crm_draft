package com.drshoes.app.audit;

import java.lang.annotation.*;

/**
 * Method-level annotation that enables @Audited-triggered audit-log writes with
 * parent-entity linkage.
 *
 * When placed on a service method, AuditLogAspect evaluates the {@code parent()}
 * SpEL expression against the method's arguments after the method returns
 * successfully. The resulting UUID is stored in audit_log.parent_entity_id,
 * linking the audit row to its parent entity (e.g. an Order when an OrderItem
 * operation fires).
 *
 * SpEL sandbox: SimpleEvaluationContext (read-only data binding) is used —
 * T(...) reflection escapes and Spring bean references are blocked.
 *
 * Exception safety: if SpEL evaluation fails, the audit row is still written
 * with parent_entity_id = null and a WARN line is emitted.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    /**
     * SpEL expression evaluated against method arguments after successful return.
     * The result must be a UUID (or null, which is accepted and skipped).
     * Method parameters are bound by name (e.g. {@code #orderId}).
     * Leave empty to opt out of parent-entity linkage (no-op, annotation is ignored).
     */
    String parent() default "";
}
