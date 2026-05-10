package com.drshoes.app.messaging.dto;

public record SendNewMessageRequest(String channel, String subject, String body) {}
