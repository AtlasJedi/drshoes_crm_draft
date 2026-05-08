package com.drshoes.app.messaging.dto;

public record CreateTemplateRequest(
    String name,
    String channel,
    String subject,
    String body,
    Boolean active) {}
