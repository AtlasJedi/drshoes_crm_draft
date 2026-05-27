package com.drshoes.app.messaging.dto;

import java.util.UUID;
public record SendMessageRequest(
    UUID templateId,
    String body,
    String channel,
    String subject) {}
