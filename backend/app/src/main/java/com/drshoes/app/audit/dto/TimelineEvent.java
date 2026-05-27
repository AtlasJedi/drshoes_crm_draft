package com.drshoes.app.audit.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
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
