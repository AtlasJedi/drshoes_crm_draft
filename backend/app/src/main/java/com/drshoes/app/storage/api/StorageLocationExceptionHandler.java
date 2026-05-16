package com.drshoes.app.storage.api;

import com.drshoes.app.storage.service.LocationConflictException;
import com.drshoes.app.storage.service.LocationNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice(assignableTypes = StorageLocationController.class)
public class StorageLocationExceptionHandler {

    @ExceptionHandler(LocationConflictException.class)
    public ResponseEntity<Map<String, String>> conflict(LocationConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("error", "location_name_conflict", "message", ex.getMessage()));
    }

    @ExceptionHandler(LocationNotFoundException.class)
    public ResponseEntity<Map<String, String>> notFound(LocationNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "location_not_found", "message", ex.getMessage()));
    }
}
