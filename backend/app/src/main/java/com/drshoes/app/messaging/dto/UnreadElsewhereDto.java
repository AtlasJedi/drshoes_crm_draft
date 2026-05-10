package com.drshoes.app.messaging.dto;

import java.util.UUID;

/**
 * Response for GET /api/admin/orders/{orderId}/unread-elsewhere.
 * count=0 and threadId=null means no unread messages on other threads.
 */
public record UnreadElsewhereDto(int count, UUID threadId) {}
