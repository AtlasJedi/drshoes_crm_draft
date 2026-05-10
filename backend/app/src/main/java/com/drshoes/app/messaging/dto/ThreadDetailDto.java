package com.drshoes.app.messaging.dto;

import java.util.List;

public record ThreadDetailDto(MessageThreadDto thread, List<MessageDto> messages) {}
