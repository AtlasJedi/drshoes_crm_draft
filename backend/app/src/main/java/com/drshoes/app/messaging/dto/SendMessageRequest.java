package com.drshoes.app.messaging.dto;

import java.util.UUID;

/**
 * Request body for POST /api/admin/orders/{orderId}/messages.
 *
 * M2 contract:
 *   - templateId: required; controller returns 400 if null.
 *   - channel: required; must be EMAIL or SMS; controller returns 400 otherwise.
 *   - body: optional override — ignored in M2 (body override without templateId is rejected at
 *     validation layer; with templateId the body field is simply not forwarded to MessageRouter).
 *   - subject: optional override — unused in M2.
 */
public record SendMessageRequest(
    UUID templateId,
    String body,
    String channel,
    String subject) {}
