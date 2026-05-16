package com.drshoes.app.order.api;

import com.drshoes.app.order.service.OrderNotesService.NoteValidationException;
import com.drshoes.app.order.service.OrderNotesService.OrderNotFoundException;
import com.drshoes.app.order.service.OrderNotesService.UnknownLocationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice(assignableTypes = OrderNotesController.class)
public class OrderNotesExceptionHandler {

    @ExceptionHandler(NoteValidationException.class)
    public ResponseEntity<Map<String, String>> validation(NoteValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", ex.code, "message", ex.getMessage()));
    }

    @ExceptionHandler(UnknownLocationException.class)
    public ResponseEntity<Map<String, String>> unknownLocation(UnknownLocationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("error", "unknown_location", "message", ex.getMessage()));
    }

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<Map<String, String>> notFound(OrderNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "order_not_found", "message", ex.getMessage()));
    }
}
