package com.drshoes.app.audit;

/**
 * Marker interface for request DTOs that carry an optional free-text note
 * which should be persisted on the audit_log row.
 *
 * Usage: implement this interface on any DTO that has a {@code note()} accessor.
 * The {@link AuditLogAspect} reads {@link #auditNote()} from matching method
 * arguments and threads the value through to {@link AuditLogWriter}.
 *
 * Implemented by: ChangeStatusRequest (M8 task m8-fb-1b).
 */
public interface HasAuditNote {

    /**
     * Returns the free-text note to persist on the audit row, or {@code null} when none.
     * Max 1000 characters — enforced by Jakarta validation on implementing types.
     */
    String auditNote();
}
