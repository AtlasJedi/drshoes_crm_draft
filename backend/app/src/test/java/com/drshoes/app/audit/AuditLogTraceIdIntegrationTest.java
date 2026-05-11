package com.drshoes.app.audit;

import com.drshoes.app.AbstractIntegrationTest;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that AuditLogWriter (called by AuditLogAspect) persists the OTel trace_id
 * when an active span is present, and persists null when no span is active.
 *
 * Bypasses the aspect directly (calls AuditLogWriter) to isolate the trace_id capture
 * logic from the AOP layer. The aspect-level trace_id flow is covered by
 * AuditLogAspectIntegrationTest (which extends AdminWebTestBase and has full HTTP context).
 */
class AuditLogTraceIdIntegrationTest extends AbstractIntegrationTest {

    @Autowired AuditLogWriter writer;
    @Autowired AuditLogRepository repo;
    @Autowired OpenTelemetry otel;

    @BeforeEach
    void clearAuditLog() {
        repo.deleteAll();
    }

    @Test
    void trace_id_is_persisted_when_active_span_present() {
        Tracer tracer = otel.getTracer("test-tracer");
        Span span = tracer.spanBuilder("test-span").startSpan();
        String expectedTraceId = span.getSpanContext().getTraceId();

        try (Scope ignored = span.makeCurrent()) {
            // AuditLogWriter.write 8-param variant receives traceId from caller —
            // here we simulate what AuditLogAspect does by passing currentTraceId from AuditSpanHelper.
            var spanHelper = new AuditSpanHelper(otel);
            String traceId = spanHelper.currentTraceId();
            writer.write("GET", "/api/admin/orders", 200, null, null, null, null, traceId);
        } finally {
            span.end();
        }

        var rows = repo.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getTraceId())
            .as("trace_id must match the active span's trace ID")
            .isEqualTo(expectedTraceId);
    }

    @Test
    void trace_id_is_null_when_no_active_span() {
        // No span active — AuditSpanHelper.currentTraceId() returns null.
        var spanHelper = new AuditSpanHelper(otel);
        String traceId = spanHelper.currentTraceId();

        writer.write("POST", "/api/admin/clients", 201, null, null, null, null, traceId);

        var rows = repo.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getTraceId())
            .as("trace_id must be null when no active span")
            .isNull();
    }
}
