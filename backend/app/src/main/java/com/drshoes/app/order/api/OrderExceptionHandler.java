package com.drshoes.app.order.api;

import com.drshoes.app.order.OrderAlreadyDeletedException;
import com.drshoes.app.order.OrderItemNotFoundException;
import com.drshoes.app.order.OrderNotFoundException;
import com.drshoes.app.order.OrderVersionConflictException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps order-domain exceptions to HTTP responses.
 * Scoped exclusively to OrderController to avoid bleeding into client endpoints.
 *
 *   OrderNotFoundException          → 404 NOT_FOUND        {code:"ORDER_NOT_FOUND"}
 *   OrderVersionConflictException   → 409 CONFLICT         {code:"ORDER_VERSION_CONFLICT", currentVersion:N}
 *   OrderAlreadyDeletedException    → 400 BAD_REQUEST       {code:"ORDER_ALREADY_DELETED"}
 *   OrderItemNotFoundException      → 404 NOT_FOUND        {code:"ORDER_ITEM_NOT_FOUND"}
 */
@RestControllerAdvice(assignableTypes = OrderController.class)
public class OrderExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(OrderExceptionHandler.class);

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(OrderNotFoundException e) {
        log.info("op=orderNotFound message={} outcome=404", e.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(error("ORDER_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(OrderVersionConflictException.class)
    public ResponseEntity<Map<String, Object>> handleVersionConflict(OrderVersionConflictException e) {
        log.info("op=orderVersionConflict currentVersion={} outcome=409", e.getCurrentVersion());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", "ORDER_VERSION_CONFLICT");
        body.put("currentVersion", e.getCurrentVersion());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(OrderAlreadyDeletedException.class)
    public ResponseEntity<Map<String, Object>> handleAlreadyDeleted(OrderAlreadyDeletedException e) {
        log.info("op=orderAlreadyDeleted message={} outcome=400", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(error("ORDER_ALREADY_DELETED", e.getMessage()));
    }

    @ExceptionHandler(OrderItemNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleItemNotFound(OrderItemNotFoundException e) {
        log.info("op=orderItemNotFound message={} outcome=404", e.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(error("ORDER_ITEM_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(InvalidSortFieldException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidSort(InvalidSortFieldException e) {
        log.info("op=invalidSortField field={} outcome=400", e.getField());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", "INVALID_SORT_FIELD");
        body.put("message", e.getMessage());
        body.put("allowed", List.copyOf(e.getAllowed()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    private static Map<String, Object> error(String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("message", message);
        return body;
    }
}
