package com.drshoes.app.client.api;

import com.drshoes.app.client.ClientContactMissingException;
import com.drshoes.app.client.ClientNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.Map;

/**
 * Maps client-domain exceptions to HTTP responses.
 *
 *   ClientNotFoundException        → 404 NOT_FOUND
 *   ClientContactMissingException  → 400 BAD_REQUEST
 */
@RestControllerAdvice
public class ClientExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ClientExceptionHandler.class);

    @ExceptionHandler(ClientNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ClientNotFoundException e) {
        log.info("op=clientNotFound message={} outcome=404", e.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(error("CLIENT_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(ClientContactMissingException.class)
    public ResponseEntity<Map<String, Object>> handleContactMissing(ClientContactMissingException e) {
        log.info("op=clientContactMissing message={} outcome=400", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(error("CLIENT_CONTACT_MISSING", e.getMessage()));
    }

    private static Map<String, Object> error(String code, String message) {
        return Map.of("error", Map.of("code", code, "message", message, "timestamp", Instant.now().toString()));
    }
}
