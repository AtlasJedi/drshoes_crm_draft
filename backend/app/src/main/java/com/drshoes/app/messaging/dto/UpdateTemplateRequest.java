package com.drshoes.app.messaging.dto;

/** All fields nullable — only non-null fields are applied in PATCH semantics. */
public record UpdateTemplateRequest(
    String name,
    String channel,
    String subject,
    String body,
    Boolean active) {}
