package com.drshoes.app.order.api;

import java.time.Instant;
import java.util.UUID;

public record AddOrderNoteResponse(
    UUID auditEntryId,
    String note,
    String locationFrom,
    String locationTo,
    Instant createdAt
) {}
