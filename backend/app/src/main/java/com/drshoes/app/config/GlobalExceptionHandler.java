package com.drshoes.app.config;

import com.drshoes.app.auth.service.InvalidCredentialsException;
import com.drshoes.app.auth.service.LoginThrottledException;
import com.drshoes.app.client.ClientContactMissingException;
import com.drshoes.app.client.ClientNotFoundException;
import com.drshoes.app.messaging.service.NotRetryableException;
import com.drshoes.app.order.OrderAlreadyDeletedException;
import com.drshoes.app.order.OrderItemNotFoundException;
import com.drshoes.app.order.OrderNotFoundException;
import com.drshoes.app.order.OrderVersionConflictException;
import com.drshoes.app.order.api.InvalidSortFieldException;
import com.drshoes.app.order.service.OrderNotesService;
import com.drshoes.app.photo.service.OrderItemNotInOrderException;
import com.drshoes.app.photo.service.PhotoNotFoundException;
import com.drshoes.app.photo.service.PhotoTooLargeException;
import com.drshoes.app.photo.service.UnsupportedPhotoMimeException;
import com.drshoes.app.storage.service.LocationConflictException;
import com.drshoes.app.storage.service.LocationNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ── 404 Not Found ──

    @ExceptionHandler({
        OrderNotFoundException.class,
        OrderItemNotFoundException.class,
        ClientNotFoundException.class,
        PhotoNotFoundException.class,
        LocationNotFoundException.class,
        OrderNotesService.OrderNotFoundException.class
    })
    public ResponseEntity<Map<String, Object>> handleNotFound(RuntimeException e) {
        log.info("op=notFound message={}", e.getMessage());
        return respond(HttpStatus.NOT_FOUND, errorCode(e), e.getMessage());
    }

    // ── 400 Bad Request ──

    @ExceptionHandler({
        OrderAlreadyDeletedException.class,
        ClientContactMissingException.class,
        OrderItemNotInOrderException.class,
        UnsupportedPhotoMimeException.class,
        IllegalArgumentException.class,
        OrderNotesService.NoteValidationException.class
    })
    public ResponseEntity<Map<String, Object>> handleBadRequest(RuntimeException e) {
        log.info("op=badRequest message={}", e.getMessage());
        return respond(HttpStatus.BAD_REQUEST, errorCode(e), e.getMessage());
    }

    // ── 409 Conflict ──

    @ExceptionHandler(OrderVersionConflictException.class)
    public ResponseEntity<Map<String, Object>> handleVersionConflict(OrderVersionConflictException e) {
        log.info("op=conflict currentVersion={}", e.getCurrentVersion());
        Map<String, Object> body = body("ORDER_VERSION_CONFLICT", e.getMessage());
        body.put("currentVersion", e.getCurrentVersion());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(NotRetryableException.class)
    public ResponseEntity<Map<String, Object>> handleNotRetryable(NotRetryableException e) {
        log.info("op=conflict messageId={} actualStatus={}", e.getMessageId(), e.getActualStatus());
        Map<String, Object> body = body("NOT_RETRYABLE", e.getMessage());
        body.put("messageId", e.getMessageId().toString());
        body.put("actualStatus", e.getActualStatus());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler({LocationConflictException.class, OrderNotesService.UnknownLocationException.class})
    public ResponseEntity<Map<String, Object>> handleConflict(RuntimeException e) {
        log.info("op=conflict message={}", e.getMessage());
        return respond(HttpStatus.CONFLICT, errorCode(e), e.getMessage());
    }

    // ── 401 / 413 / 429 ──

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidCredentials(InvalidCredentialsException e) {
        log.info("op=login outcome=invalid_credentials");
        return respond(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", e.getMessage());
    }

    @ExceptionHandler(LoginThrottledException.class)
    public ResponseEntity<Map<String, Object>> handleThrottled(LoginThrottledException e) {
        log.info("op=login outcome=throttled");
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .header("Retry-After", "900")
            .body(body("LOGIN_THROTTLED", e.getMessage()));
    }

    @ExceptionHandler(PhotoTooLargeException.class)
    public ResponseEntity<Map<String, Object>> handleTooLarge(PhotoTooLargeException e) {
        log.info("op=tooLarge message={}", e.getMessage());
        return respond(HttpStatus.PAYLOAD_TOO_LARGE, "PHOTO_TOO_LARGE", e.getMessage());
    }

    @ExceptionHandler(InvalidSortFieldException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidSort(InvalidSortFieldException e) {
        log.info("op=badRequest field={}", e.getField());
        Map<String, Object> body = body("INVALID_SORT_FIELD", e.getMessage());
        body.put("allowed", List.copyOf(e.getAllowed()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        log.info("op=responseStatus status={} reason={}", e.getStatusCode().value(), e.getReason());
        return respond(HttpStatus.valueOf(e.getStatusCode().value()),
            "ERROR", e.getReason() != null ? e.getReason() : "error");
    }

    // ── Helpers ──

    private static ResponseEntity<Map<String, Object>> respond(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(body(code, message));
    }

    private static Map<String, Object> body(String code, String message) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("code", code);
        map.put("message", message);
        return map;
    }

    private static String errorCode(RuntimeException e) {
        String name = e.getClass().getSimpleName()
            .replace("Exception", "")
            .replaceAll("([a-z])([A-Z])", "$1_$2")
            .toUpperCase();
        return name;
    }
}
