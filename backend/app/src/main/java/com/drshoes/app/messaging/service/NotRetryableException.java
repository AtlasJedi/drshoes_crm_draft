package com.drshoes.app.messaging.service;

import java.util.UUID;

/**
 * Thrown when a retry is attempted on a message that is not in FAILED state.
 * Maps to HTTP 409 Conflict in MessagesController (task 4-11).
 */
public class NotRetryableException extends RuntimeException {
    private final UUID messageId;
    private final String actualStatus;

    public NotRetryableException(UUID messageId, String actualStatus) {
        super("Message " + messageId + " is not retryable — delivery_status=" + actualStatus);
        this.messageId = messageId;
        this.actualStatus = actualStatus;
    }

    public UUID getMessageId()      { return messageId; }
    public String getActualStatus() { return actualStatus; }
}
