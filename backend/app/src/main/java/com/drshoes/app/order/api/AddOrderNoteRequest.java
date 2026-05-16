package com.drshoes.app.order.api;

import com.drshoes.app.audit.HasAuditNote;
import jakarta.validation.constraints.Size;

/**
 * Body for POST /api/admin/orders/{orderId}/notes.
 *
 * Validation:
 *   - at least one of (note, location) must be present and non-blank
 *     (checked in service to allow context-aware messaging).
 *   - note trimmed, max 1000 chars.
 *   - location max 64 chars; service rejects unknown / inactive.
 *
 * HasAuditNote → AuditLogAspect captures note into audit_log.note.
 * Location diff is threaded via HttpServletRequest attributes set by the
 * controller after the service call (see OrderNotesController).
 */
public record AddOrderNoteRequest(
    @Size(max = 1000) String note,
    @Size(max = 64)   String location
) implements HasAuditNote {

    /** Aspect bridge — operator note text. */
    @Override
    public String auditNote() { return note; }
}
