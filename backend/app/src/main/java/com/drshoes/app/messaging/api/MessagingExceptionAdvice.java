package com.drshoes.app.messaging.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;

/**
 * Exception advice scoped to the messaging.api package.
 *
 * Handles:
 *   ResponseStatusException  → preserve status + reason as error body
 *   IllegalArgumentException → 400 BAD_REQUEST
 */
@RestControllerAdvice(basePackages = "com.drshoes.app.messaging.api")
public class MessagingExceptionAdvice {

    private static final Logger log = LoggerFactory.getLogger(MessagingExceptionAdvice.class);

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        log.info("op=messagingError status={} reason={}", e.getStatusCode().value(), e.getReason());
        String reason = e.getReason() != null ? e.getReason() : "error";
        return ResponseEntity.status(e.getStatusCode())
            .body(error(reason));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException e) {
        log.info("op=messagingError status=400 message={}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(error(e.getMessage()));
    }

    private static Map<String, Object> error(String message) {
        return Map.of("error", message, "timestamp", Instant.now().toString());
    }
}
