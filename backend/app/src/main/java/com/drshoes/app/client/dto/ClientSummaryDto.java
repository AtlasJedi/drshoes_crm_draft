package com.drshoes.app.client.dto;

import java.time.Instant;
import java.util.UUID;
public record ClientSummaryDto(
    UUID clientId,
    int orderCount,
    int openOrderCount,
    Instant lastOrderAt,
    int unreadThreadCount
) {}
