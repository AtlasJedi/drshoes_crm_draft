package com.drshoes.app.audit.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Immutable projection of a curated audit-log row into a timeline event.
 *
 * {@code labels} is a thin key-value map of display metadata (e.g. path, actorFullName).
 * Field-level diffs (before/after) are NOT present in M1 — AuditLog does not
 * capture request bodies yet. Planned for M2.
 *
 * {@code note} is the optional operator free-text note from audit_log.note (added V015).
 * Null for all non-STATUS_CHANGED rows and for status changes where no note was provided.
 *
 * {@code locationFrom} and {@code locationTo} carry the storage location before/after a
 * location-change event (added V020, M10 task 10-5). Null for all non-location-change rows.
 */
public record TimelineEvent(
    UUID id,
    TimelineEventKind kind,
    Instant occurredAt,
    String actorFullName,
    Map<String, String> labels,
    String note,
    String locationFrom,
    String locationTo
) {}
