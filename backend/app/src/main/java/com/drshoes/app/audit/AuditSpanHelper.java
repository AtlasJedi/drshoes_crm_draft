package com.drshoes.app.audit;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import org.springframework.stereotype.Component;
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
    public String currentTraceId() {
        SpanContext ctx = Span.current().getSpanContext();
        if (!ctx.isValid()) return null;
        return ctx.getTraceId();
    }
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
