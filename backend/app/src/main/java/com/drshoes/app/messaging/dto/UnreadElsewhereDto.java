package com.drshoes.app.messaging.dto;

import java.util.UUID;
public record UnreadElsewhereDto(int count, UUID threadId) {}
