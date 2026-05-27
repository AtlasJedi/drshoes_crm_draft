package com.drshoes.app.messaging.service;

import java.util.UUID;
import lombok.Getter;

@Getter
public class NotRetryableException extends RuntimeException {
    private final UUID messageId;
    private final String actualStatus;

    public NotRetryableException(UUID messageId, String actualStatus) {
        super("Message " + messageId + " is not retryable, status: " + actualStatus);
        this.messageId = messageId;
        this.actualStatus = actualStatus;
    }
}
