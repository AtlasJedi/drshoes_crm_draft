package com.drshoes.app.audit;

/**
 * Companion to {@link HasAuditNote} — request DTOs implement this when they
 * carry a location change (orders.location move). AuditLogAspect reads both
 * fields from the first matching arg and writes them to audit_log.
 *
 * Returning null from either method means "no change" / "no value" — the
 * audit row gets a NULL in the corresponding column.
 */
public interface HasAuditLocationDiff {
    String auditLocationFrom();
    String auditLocationTo();
}
