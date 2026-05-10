package com.drshoes.app.client.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Summary projection for a single client — header KPI tiles on the dossier page.
 *
 * orderCount      — all-time non-soft-deleted orders for this client.
 * openOrderCount  — orders not in the closed set (WYDANE | ANULOWANE).
 * lastOrderAt     — received_at of the most recent order; null if none.
 * unreadThreadCount — non-discarded threads where unread_count > 0.
 */
public record ClientSummaryDto(
    UUID clientId,
    int orderCount,
    int openOrderCount,
    Instant lastOrderAt,
    int unreadThreadCount
) {}
