package com.drshoes.app.messaging.dto;

import java.util.UUID;

public record SendReplyRequest(
    String channel,
    String subject,
    String body,
    UUID orderId
) {}
