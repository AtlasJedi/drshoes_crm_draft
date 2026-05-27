package com.drshoes.app.audit;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import org.springframework.stereotype.Component;

/**
 * OTel helper for AuditLogAspect.
 * Provides trace ID capture and audit.write span wrapping.
 * Extracted to keep AuditLogAspect under 120 LOC after OTel changes.
 */
@Component
public class AuditSpanHelper {

    static final AttributeKey<String> ATTR_OPERATION   = AttributeKey.stringKey("audit.operation");
    static final AttributeKey<String> ATTR_ENTITY_TYPE = AttributeKey.stringKey("audit.entity_type");
    static final AttributeKey<String> ATTR_ENTITY_ID   = AttributeKey.stringKey("audit.entity_id");
    static final AttributeKey<String> ATTR_ACTOR       = AttributeKey.stringKey("audit.actor_email");

    private final Tracer tracer;

    public AuditSpanHelper(OpenTelemetry otel) {
        this.tracer = otel.getTracer("drshoes-audit");
    }

    /**
     * Returns the current trace ID as a 32-char lowercase hex string, or null if no
     * valid span context is active (all-zeros, unsampled, or no span at all).
     */
    public String currentTraceId() {
        SpanContext ctx = Span.current().getSpanContext();
        if (!ctx.isValid()) return null;
        return ctx.getTraceId(); // 32-char lowercase hex per W3C traceparent spec
    }

    /**
     * Runs {@code action} inside a span named {@code audit.write} with the provided
     * semantic attributes. The span is always ended; exceptions propagate.
     *
     * @param operation  logical operation name (e.g. "HTTP POST /api/admin/orders")
     * @param entityType entity type derived from the path (e.g. "orders")
     * @param entityId   entity UUID string, or null
     * @param actorEmail actor name from SecurityContext
     * @param action     the audit write to wrap
     */
    public void writeWithSpan(String operation, String entityType,
                              String entityId, String actorEmail, Runnable action) {
        Span span = tracer.spanBuilder("audit.write")
            .setAttribute(ATTR_OPERATION, operation)
            .setAttribute(ATTR_ENTITY_TYPE, entityType != null ? entityType : "unknown")
            .setAttribute(ATTR_ENTITY_ID, entityId != null ? entityId : "null")
            .setAttribute(ATTR_ACTOR, actorEmail != null ? actorEmail : "anonymous")
            .startSpan();
        try (Scope ignored = span.makeCurrent()) {
            action.run();
        } finally {
            span.end();
        }
    }
}
