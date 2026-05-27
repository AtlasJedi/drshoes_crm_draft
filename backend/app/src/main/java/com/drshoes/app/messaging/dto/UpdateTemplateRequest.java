package com.drshoes.app.messaging.dto;
public record UpdateTemplateRequest(
    String name,
    String channel,
    String subject,
    String body,
    Boolean active) {}
