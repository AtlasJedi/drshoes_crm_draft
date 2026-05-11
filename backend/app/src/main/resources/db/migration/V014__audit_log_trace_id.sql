-- V014: Add trace_id column to audit_log for OpenTelemetry correlation.
-- Populated by AuditLogAspect from Span.current().getSpanContext().getTraceId()
-- when an active span is present; NULL when no span context exists (e.g. background jobs).
--
-- No index this milestone: trace_id lookups are driven by Jaeger (which already has
-- the trace indexed). A DB index here adds write overhead with no current query benefit.
-- Defer index until a use case requires querying audit_log by trace_id directly.
ALTER TABLE audit_log ADD COLUMN trace_id varchar(32) NULL;
